-- ==============================================================================
-- KAREA - SCHÉMA DE BASE DE DONNÉES POSTGRESQL (SUPABASE 2.0)
-- Version : 2.1.0 - Galerie Vidéo Directe, Salon au Hasard & Messagerie Asymétrique
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
-- 3. TABLE DES PROFILS UTILISATEURS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    birthdate DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    bio TEXT CHECK (char_length(bio) <= 300),
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    avatar_url TEXT,
    is_profile_completed BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'in_call', 'offline')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    price_per_minute INTEGER NOT NULL DEFAULT 100 CHECK (price_per_minute >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajout sécurisé des nouvelles colonnes si la table profiles existait déjà
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'in_call', 'offline'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_per_minute INTEGER NOT NULL DEFAULT 100 CHECK (price_per_minute >= 0);

CREATE INDEX IF NOT EXISTS idx_profiles_gender_status ON public.profiles(gender, status);
CREATE INDEX IF NOT EXISTS idx_profiles_completed ON public.profiles(is_profile_completed);

-- ------------------------------------------------------------------------------
-- 4. VÉRIFICATION DE LA MAJORITÉ (18 ANS RÉVOLUS OBLIGATOIRES SUR BIRTHDATE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_min_age()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.birthdate > (CURRENT_DATE - INTERVAL '18 years') THEN
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
-- 10. SYNCHRONISATION DU STATUT DES PROFILS PENDANT L'APPEL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_status_on_call()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'in_progress' AND (OLD.status IS DISTINCT FROM 'in_progress') THEN
        UPDATE public.profiles SET status = 'in_call' WHERE id IN (NEW.caller_id, NEW.receiver_id);
    END IF;

    IF NEW.status IN ('ended', 'rejected', 'missed', 'busy') AND (OLD.status NOT IN ('ended', 'rejected', 'missed', 'busy')) THEN
        UPDATE public.profiles SET status = 'online' WHERE id IN (NEW.caller_id, NEW.receiver_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_call_status_change ON public.call_sessions;
CREATE TRIGGER on_call_status_change
AFTER INSERT OR UPDATE OF status ON public.call_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_status_on_call();

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
    AND is_unlocked_by_man = FALSE
);

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
