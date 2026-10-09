-- ==============================================================================
-- KAREA - SCHÉMA DE BASE DE DONNÉES POSTGRESQL (SUPABASE 2.0)
-- Version : 2.3.0 - Galerie Vidéo Directe, Appels Vidéo Agora, Salon au Hasard & Messagerie Asymétrique
-- Ce script est 100% exécutable d'un coup dans le SQL Editor de Supabase.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. NETTOYAGE ANCIEN SYSTÈME (SUPPRESSION MATCHES ET LIKES)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_like CASCADE;

-- Auto-confirmer tous les utilisateurs existants pour débloquer la connexion
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ------------------------------------------------------------------------------
-- 3. TABLE DES PROFILS UTILISATEURS (SEULS ID ET GENRE SONT OBLIGATOIRES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    first_name TEXT DEFAULT 'User',
    birthdate DATE,
    bio TEXT CHECK (char_length(bio) <= 300),
    city TEXT,
    country TEXT,
    avatar_url TEXT,
    is_profile_completed BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline', 'in_call')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    price_per_minute INTEGER NOT NULL DEFAULT 100 CHECK (price_per_minute >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rendre explicitement toutes les colonnes facultatives (sauf id et gender)
ALTER TABLE public.profiles ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN birthdate DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN country DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN first_name SET DEFAULT 'User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline', 'in_call'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_per_minute INTEGER NOT NULL DEFAULT 25 CHECK (price_per_minute >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS token_balance NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (token_balance >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS earned_tokens NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (earned_tokens >= 0);

CREATE INDEX IF NOT EXISTS idx_profiles_gender_status ON public.profiles(gender, status);
CREATE INDEX IF NOT EXISTS idx_profiles_completed ON public.profiles(is_profile_completed);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen_at DESC);

-- Activation de Supabase Realtime sur la table profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. VÉRIFICATION DE LA MAJORITÉ & VERROUILLAGE DU GENRE (LOCK_GENDER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_min_age()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.birthdate IS NOT NULL AND NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'Vous devez avoir au moins 18 ans pour vous inscrire sur Karea.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_min_age ON public.profiles;
CREATE TRIGGER enforce_min_age
BEFORE INSERT OR UPDATE OF birthdate ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_user_min_age();

-- Verrouillage du genre : fonction public.lock_gender()
CREATE OR REPLACE FUNCTION public.lock_gender()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.gender IS NOT NULL AND NEW.gender IS NOT NULL AND OLD.gender <> NEW.gender THEN
        RAISE EXCEPTION 'Le genre ne peut plus être modifié une fois défini.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger lock_gender_trigger sur public.profiles
DROP TRIGGER IF EXISTS lock_gender_trigger ON public.profiles;
DROP TRIGGER IF EXISTS trg_prevent_gender_change ON public.profiles;
CREATE TRIGGER lock_gender_trigger
BEFORE UPDATE OF gender ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.lock_gender();

-- ------------------------------------------------------------------------------
-- 5. MESSAGERIE ASYMÉTRIQUE : CONVERSATIONS & DÉBLOCAGE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    man_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    woman_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_unlocked_by_man BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMPTZ,
    unlock_price NUMERIC(10, 2) DEFAULT 500, -- Exemple : 500 FCFA pour débloquer
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_pair UNIQUE (man_id, woman_id),
    CONSTRAINT different_users CHECK (man_id <> woman_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_man ON public.conversations(man_id);
CREATE INDEX IF NOT EXISTS idx_conversations_woman ON public.conversations(woman_id);

-- ------------------------------------------------------------------------------
-- 6. MESSAGERIE ASYMÉTRIQUE : TABLE DES MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 2000),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id, is_read);

-- ------------------------------------------------------------------------------
-- 7. FONCTIONS RPC POUR LA MESSAGERIE (RÉCUPÉRATION ET DÉBLOCAGE)
-- ------------------------------------------------------------------------------

-- 7.1 Obtenir ou créer une conversation facilement entre un homme et une femme
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    current_user_gender TEXT;
    v_man_id UUID;
    v_woman_id UUID;
    v_conversation_id UUID;
BEGIN
    SELECT gender INTO current_user_gender FROM public.profiles WHERE id = auth.uid();
    
    IF current_user_gender = 'male' THEN
        v_man_id := auth.uid();
        v_woman_id := p_other_user_id;
    ELSE
        v_woman_id := auth.uid();
        v_man_id := p_other_user_id;
    END IF;

    SELECT id INTO v_conversation_id 
    FROM public.conversations 
    WHERE man_id = v_man_id AND woman_id = v_woman_id;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (man_id, woman_id, is_unlocked_by_man)
        VALUES (v_man_id, v_woman_id, FALSE)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Débloquer la discussion payée par l'homme
CREATE OR REPLACE FUNCTION public.unlock_conversation(p_conversation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.conversations
    SET is_unlocked_by_man = TRUE,
        unlocked_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conversation_id 
      AND man_id = auth.uid();
      
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Marquer les messages d'une conversation comme lus
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.messages
    SET is_read = TRUE
    WHERE conversation_id = p_conversation_id
      AND receiver_id = auth.uid()
      AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 8. FILE D'ATTENTE POUR LE SALON AU HASARD (RANDOM VIDEO CALL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.random_call_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
    matched_partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    room_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_random_queue_lookup ON public.random_call_queue(gender, status, created_at);

-- ------------------------------------------------------------------------------
-- 9. TABLE DES SESSIONS D'APPELS VIDÉO & MONÉTISATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'direct' CHECK (call_type IN ('direct', 'random')),
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'in_progress', 'ended', 'rejected', 'missed', 'busy')),
    
    price_per_minute INTEGER NOT NULL DEFAULT 100,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    
    total_cost NUMERIC(10, 2) DEFAULT 0,
    female_earnings NUMERIC(10, 2) DEFAULT 0,
    platform_fee NUMERIC(10, 2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_users ON public.call_sessions(caller_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON public.call_sessions(status);

-- ------------------------------------------------------------------------------
-- 10. APPELS VIDÉO 1-TO-1 (AGORA) : IN_CALL, CANAL UNIQUE & RPC D'APPEL
--     (identique à supabase/migrations/20261009120000_video_calls_agora.sql)
-- ------------------------------------------------------------------------------
-- 1. Colonne in_call sur les profils (indépendante du statut de présence)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS in_call BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_in_call ON public.profiles(in_call);

-- 2. Canal Agora unique par appel
ALTER TABLE public.call_sessions ADD COLUMN IF NOT EXISTS channel_name TEXT UNIQUE;

-- 3. L'ancien trigger modifiait profiles.status ('in_call' / 'online') : il est
--    remplacé par la colonne in_call gérée par les fonctions RPC ci-dessous.
DROP TRIGGER IF EXISTS on_call_status_change ON public.call_sessions;
DROP FUNCTION IF EXISTS public.sync_profile_status_on_call();

-- 4. Démarrer un appel : vérifie que l'appelé est en ligne et libre, crée la
--    session + le canal unique, et passe les deux profils en in_call = true.
CREATE OR REPLACE FUNCTION public.start_direct_call(p_callee_id UUID)
RETURNS public.call_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller public.profiles;
    v_callee public.profiles;
    v_session_id UUID := gen_random_uuid();
    v_session public.call_sessions;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    IF v_caller_id = p_callee_id THEN
        RAISE EXCEPTION 'Vous ne pouvez pas vous appeler vous-même.';
    END IF;

    -- Verrouillage des deux lignes (ordre stable pour éviter les deadlocks)
    PERFORM 1 FROM public.profiles
    WHERE id IN (v_caller_id, p_callee_id)
    ORDER BY id
    FOR UPDATE;

    SELECT * INTO v_caller FROM public.profiles WHERE id = v_caller_id;
    SELECT * INTO v_callee FROM public.profiles WHERE id = p_callee_id;

    IF v_caller.id IS NULL OR v_callee.id IS NULL THEN
        RAISE EXCEPTION 'Profil introuvable.';
    END IF;

    IF v_caller.gender = v_callee.gender THEN
        RAISE EXCEPTION 'Appel non autorisé.';
    END IF;

    IF v_caller.in_call THEN
        RAISE EXCEPTION 'Vous êtes déjà en appel.';
    END IF;

    IF v_callee.status <> 'online' THEN
        RAISE EXCEPTION 'Ce profil n''est pas en ligne.';
    END IF;

    IF v_callee.in_call THEN
        RAISE EXCEPTION 'Ce profil est déjà en appel.';
    END IF;

    INSERT INTO public.call_sessions (id, caller_id, receiver_id, call_type, status, price_per_minute, channel_name)
    VALUES (v_session_id, v_caller_id, p_callee_id, 'direct', 'ringing', v_callee.price_per_minute, 'karea_' || v_session_id::text)
    RETURNING * INTO v_session;

    UPDATE public.profiles
    SET in_call = TRUE, updated_at = NOW()
    WHERE id IN (v_caller_id, p_callee_id);

    RETURN v_session;
END;
$$;

-- 5. Accepter un appel (réservé au destinataire)
CREATE OR REPLACE FUNCTION public.accept_direct_call(p_session_id UUID)
RETURNS public.call_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.call_sessions;
BEGIN
    UPDATE public.call_sessions
    SET status = 'in_progress', started_at = NOW()
    WHERE id = p_session_id
      AND receiver_id = auth.uid()
      AND status = 'ringing'
    RETURNING * INTO v_session;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Cet appel n''est plus disponible.';
    END IF;

    -- S'assurer que les deux profils sont bien en in_call = TRUE
    UPDATE public.profiles
    SET in_call = TRUE, updated_at = NOW()
    WHERE id IN (v_session.caller_id, v_session.receiver_id);

    RETURN v_session;
END;
$$;

-- 6. Terminer un appel (raccrocher, refuser, sans réponse, fermeture de page,
--    perte de connexion). Idempotent : remet toujours les deux in_call à false.
CREATE OR REPLACE FUNCTION public.end_direct_call(p_session_id UUID, p_reason TEXT DEFAULT 'ended')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session public.call_sessions;
    v_final_status TEXT;
BEGIN
    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
      AND (caller_id = auth.uid() OR receiver_id = auth.uid())
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RETURN;
    END IF;

    IF v_session.status IN ('ringing', 'in_progress', 'initiated') THEN
        v_final_status := CASE
            WHEN v_session.status = 'in_progress' THEN 'ended'
            WHEN p_reason IN ('rejected', 'missed') THEN p_reason
            ELSE 'missed'
        END;

        UPDATE public.call_sessions
        SET status = v_final_status,
            ended_at = NOW(),
            duration_seconds = CASE
                WHEN started_at IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
                ELSE 0
            END
        WHERE id = p_session_id;
    END IF;

    UPDATE public.profiles
    SET in_call = FALSE, updated_at = NOW()
    WHERE id IN (v_session.caller_id, v_session.receiver_id);
END;
$$;

-- 7. Nettoyage à l'ouverture de l'appli : termine les appels restés ouverts
--    (crash, perte de réseau) et remet in_call = false.
CREATE OR REPLACE FUNCTION public.reset_my_call_state()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    FOR v_session IN
        SELECT id FROM public.call_sessions
        WHERE (caller_id = auth.uid() OR receiver_id = auth.uid())
          AND status IN ('initiated', 'ringing', 'in_progress')
    LOOP
        PERFORM public.end_direct_call(v_session.id, 'ended');
    END LOOP;

    UPDATE public.profiles SET in_call = FALSE WHERE id = auth.uid() AND in_call = TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.start_direct_call(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_direct_call(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_direct_call(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_my_call_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_call(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_direct_call(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_direct_call(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_my_call_state() TO authenticated;

-- 8. Realtime sur call_sessions (sonnerie de l'appel entrant, fin d'appel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 11. POLITIQUES DE SÉCURITÉ (ROW LEVEL SECURITY - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.random_call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- 11.1 Profiles
DROP POLICY IF EXISTS "Les profils sont visibles par tous les utilisateurs connectés" ON public.profiles;
CREATE POLICY "Les profils sont visibles par tous les utilisateurs connectés"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Chaque utilisateur crée son propre profil" ON public.profiles;
CREATE POLICY "Chaque utilisateur crée son propre profil"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Chaque utilisateur met à jour son propre profil" ON public.profiles;
CREATE POLICY "Chaque utilisateur met à jour son propre profil"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 11.2 Conversations
DROP POLICY IF EXISTS "Les participants voient leurs conversations" ON public.conversations;
CREATE POLICY "Les participants voient leurs conversations"
ON public.conversations FOR SELECT TO authenticated
USING (auth.uid() = man_id OR auth.uid() = woman_id);

DROP POLICY IF EXISTS "Les participants peuvent initialiser une conversation" ON public.conversations;
CREATE POLICY "Les participants peuvent initialiser une conversation"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
    (auth.uid() = man_id OR auth.uid() = woman_id)
);

DROP POLICY IF EXISTS "Les participants peuvent modifier leur conversation" ON public.conversations;
CREATE POLICY "Les participants peuvent modifier leur conversation"
ON public.conversations FOR UPDATE TO authenticated
USING (auth.uid() = man_id OR auth.uid() = woman_id);

-- 11.3 Messages (RLS ASYMÉTRIQUE STRICTE)
DROP POLICY IF EXISTS "Les participants lisent les messages de leur conversation" ON public.messages;
CREATE POLICY "Les participants lisent les messages de leur conversation"
ON public.messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Envoi asymétrique des messages" ON public.messages;
CREATE POLICY "Envoi asymétrique des messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = sender_id
    AND (
        -- Cas A : La femme peut TOUJOURS envoyer des messages sans condition
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.gender = 'female'
        )
        OR
        -- Cas B : L'homme ne peut envoyer que si la discussion a été débloquée
        EXISTS (
            SELECT 1 FROM public.conversations c 
            WHERE c.id = conversation_id 
              AND c.man_id = auth.uid() 
              AND c.is_unlocked_by_man = TRUE
        )
    )
);

DROP POLICY IF EXISTS "Les destinataires peuvent marquer les messages comme lus" ON public.messages;
CREATE POLICY "Les destinataires peuvent marquer les messages comme lus"
ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 11.4 Random Queue
DROP POLICY IF EXISTS "Gestion personnelle de la file d'attente aléatoire" ON public.random_call_queue;
CREATE POLICY "Gestion personnelle de la file d'attente aléatoire"
ON public.random_call_queue FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 11.5 Call Sessions
DROP POLICY IF EXISTS "Les participants voient leurs sessions d'appels" ON public.call_sessions;
CREATE POLICY "Les participants voient leurs sessions d'appels"
ON public.call_sessions FOR SELECT TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Seuls les hommes/appelants peuvent créer une session d'appel" ON public.call_sessions;
CREATE POLICY "Seuls les hommes/appelants peuvent créer une session d'appel"
ON public.call_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "Les deux participants peuvent mettre à jour l'appel" ON public.call_sessions;
CREATE POLICY "Les deux participants peuvent mettre à jour l'appel"
ON public.call_sessions FOR UPDATE TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- ------------------------------------------------------------------------------
-- 12. STORAGE BUCKET AVATARS & POLITIQUES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Photos de profil publiques en lecture" ON storage.objects;
CREATE POLICY "Photos de profil publiques en lecture"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Chaque utilisateur peut uploader sa propre photo" ON storage.objects;
CREATE POLICY "Chaque utilisateur peut uploader sa propre photo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (
        auth.uid()::text = (storage.foldername(name))[1] 
        OR name LIKE (auth.uid()::text || '/%')
    )
);

DROP POLICY IF EXISTS "Chaque utilisateur peut modifier sa propre photo" ON storage.objects;
CREATE POLICY "Chaque utilisateur peut modifier sa propre photo"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (
        auth.uid()::text = (storage.foldername(name))[1] 
        OR name LIKE (auth.uid()::text || '/%')
    )
);

DROP POLICY IF EXISTS "Chaque utilisateur peut supprimer sa propre photo" ON storage.objects;
CREATE POLICY "Chaque utilisateur peut supprimer sa propre photo"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (
        auth.uid()::text = (storage.foldername(name))[1] 
        OR name LIKE (auth.uid()::text || '/%')
    )
);

-- ------------------------------------------------------------------------------
-- 13. ABONNEMENTS / PROFILS SUIVIS (FOLLOWS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id),
    CONSTRAINT different_follow_users CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les utilisateurs voient leurs abonnements" ON public.follows;
CREATE POLICY "Les utilisateurs voient leurs abonnements"
ON public.follows FOR SELECT TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id);

DROP POLICY IF EXISTS "Un utilisateur peut suivre quelqu'un" ON public.follows;
CREATE POLICY "Un utilisateur peut suivre quelqu'un"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Un utilisateur peut ne plus suivre quelqu'un" ON public.follows;
CREATE POLICY "Un utilisateur peut ne plus suivre quelqu'un"
ON public.follows FOR DELETE TO authenticated
USING (auth.uid() = follower_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'follows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 14. CONFIGURATION (APP_CONFIG), TRANSACTIONS & FACTURATION D'APPEL À LA SECONDE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.app_config (key, value, description)
VALUES 
    ('female_share_percentage', '40'::jsonb, 'Part reversée à la femme (40%)'),
    ('platform_share_percentage', '60'::jsonb, 'Part conservée par la plateforme (60%)'),
    ('default_call_price_per_minute', '25'::jsonb, 'Tarif de départ en tokens/min'),
    ('min_call_price_per_minute', '25'::jsonb, 'Tarif minimum en tokens/min'),
    ('max_call_price_per_minute', '60'::jsonb, 'Tarif maximum en tokens/min'),
    ('call_price_step', '5'::jsonb, 'Palier d''augmentation du tarif (5 tokens)'),
    ('min_precall_seconds_required', '60'::jsonb, 'Pré-requis de 60s de solde avant appel')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    payee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 4) NOT NULL CHECK (amount > 0),
    payee_earnings NUMERIC(12, 4) NOT NULL CHECK (payee_earnings >= 0),
    platform_fee NUMERIC(12, 4) NOT NULL CHECK (platform_fee >= 0),
    type TEXT NOT NULL DEFAULT 'call_per_second' CHECK (type IN ('call_per_second', 'call_final', 'gift', 'unlock')),
    seconds_billed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_payer ON public.transactions(payer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON public.transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON public.transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique de la configuration" ON public.app_config;
CREATE POLICY "Lecture publique de la configuration"
ON public.app_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Les utilisateurs voient leurs transactions" ON public.transactions;
CREATE POLICY "Les utilisateurs voient leurs transactions"
ON public.transactions FOR SELECT TO authenticated
USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- Facturation en temps réel à la seconde (prorata)
CREATE OR REPLACE FUNCTION public.process_call_billing_tick(
    p_session_id UUID,
    p_elapsed_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session public.call_sessions;
    v_man public.profiles;
    v_woman public.profiles;
    v_female_pct NUMERIC := 40.0;
    v_platform_pct NUMERIC := 60.0;
    v_rate_per_sec NUMERIC;
    v_seconds_to_bill INTEGER;
    v_total_cost_chunk NUMERIC(12, 4);
    v_female_chunk NUMERIC(12, 4);
    v_platform_chunk NUMERIC(12, 4);
    v_new_man_balance NUMERIC(12, 4);
    v_new_woman_earned NUMERIC(12, 4);
    v_should_hangup BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    SELECT * INTO v_session FROM public.call_sessions WHERE id = p_session_id FOR UPDATE;
    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session introuvable.';
    END IF;

    IF v_session.status <> 'in_progress' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'call_not_active', 'should_hangup', true);
    END IF;

    v_seconds_to_bill := p_elapsed_seconds - COALESCE(v_session.duration_seconds, 0);
    IF v_seconds_to_bill <= 0 THEN
        SELECT token_balance INTO v_new_man_balance FROM public.profiles WHERE id = v_session.caller_id;
        SELECT earned_tokens INTO v_new_woman_earned FROM public.profiles WHERE id = v_session.receiver_id;
        RETURN jsonb_build_object('success', true, 'billed_seconds', 0, 'man_balance', v_new_man_balance, 'woman_earnings', v_new_woman_earned, 'should_hangup', false);
    END IF;

    SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
    IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
    v_platform_pct := 100.0 - v_female_pct;

    SELECT * INTO v_man FROM public.profiles WHERE id = v_session.caller_id FOR UPDATE;
    SELECT * INTO v_woman FROM public.profiles WHERE id = v_session.receiver_id FOR UPDATE;

    v_rate_per_sec := (COALESCE(v_session.price_per_minute, 25)::NUMERIC) / 60.0;
    v_total_cost_chunk := ROUND((v_rate_per_sec * v_seconds_to_bill)::NUMERIC, 4);

    IF v_man.token_balance < v_total_cost_chunk THEN
        IF v_rate_per_sec > 0 AND v_man.token_balance > 0 THEN
            v_seconds_to_bill := FLOOR(v_man.token_balance / v_rate_per_sec)::INTEGER;
            v_total_cost_chunk := v_man.token_balance;
        ELSE
            v_seconds_to_bill := 0;
            v_total_cost_chunk := 0;
        END IF;
        v_should_hangup := TRUE;
    END IF;

    IF v_total_cost_chunk > 0 THEN
        v_female_chunk := ROUND((v_total_cost_chunk * (v_female_pct / 100.0))::NUMERIC, 4);
        v_platform_chunk := v_total_cost_chunk - v_female_chunk;

        UPDATE public.profiles SET token_balance = GREATEST(0, token_balance - v_total_cost_chunk), updated_at = NOW() WHERE id = v_man.id RETURNING token_balance INTO v_new_man_balance;
        UPDATE public.profiles SET earned_tokens = earned_tokens + v_female_chunk, updated_at = NOW() WHERE id = v_woman.id RETURNING earned_tokens INTO v_new_woman_earned;

        UPDATE public.call_sessions
        SET duration_seconds = COALESCE(duration_seconds, 0) + v_seconds_to_bill,
            total_cost = COALESCE(total_cost, 0) + v_total_cost_chunk,
            female_earnings = COALESCE(female_earnings, 0) + v_female_chunk,
            platform_fee = COALESCE(platform_fee, 0) + v_platform_chunk
        WHERE id = p_session_id;

        INSERT INTO public.transactions (session_id, payer_id, payee_id, amount, payee_earnings, platform_fee, type, seconds_billed)
        VALUES (p_session_id, v_man.id, v_woman.id, v_total_cost_chunk, v_female_chunk, v_platform_chunk, 'call_per_second', v_seconds_to_bill);
    ELSE
        v_new_man_balance := v_man.token_balance;
        v_new_woman_earned := v_woman.earned_tokens;
    END IF;

    IF v_new_man_balance <= 0 THEN
        v_should_hangup := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'billed_seconds', v_seconds_to_bill,
        'total_cost_chunk', v_total_cost_chunk,
        'female_earnings_chunk', COALESCE(v_female_chunk, 0),
        'man_balance', v_new_man_balance,
        'woman_earnings', v_new_woman_earned,
        'should_hangup', v_should_hangup
    );
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'app_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;
  END IF;
END $$;

