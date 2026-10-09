-- ==============================================================================
-- KAREA - MIGRATION MESSAGERIE EN TEMPS RÉEL & RÈGLES DE DÉBLOCAGE ASYMÉTRIQUE
-- ==============================================================================

-- 1. TABLES CONVERSATIONS & MESSAGES (vérification existence et colonnes)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    man_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    woman_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_unlocked_by_man BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMPTZ,
    unlock_price NUMERIC(10, 2) DEFAULT 500,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_conversation_pair UNIQUE (man_id, woman_id),
    CONSTRAINT different_users CHECK (man_id <> woman_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_man ON public.conversations(man_id);
CREATE INDEX IF NOT EXISTS idx_conversations_woman ON public.conversations(woman_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

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

-- 2. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations RLS
DROP POLICY IF EXISTS "Les participants voient leurs conversations" ON public.conversations;
CREATE POLICY "Les participants voient leurs conversations"
ON public.conversations FOR SELECT TO authenticated
USING (auth.uid() = man_id OR auth.uid() = woman_id);

DROP POLICY IF EXISTS "Les participants peuvent initialiser une conversation" ON public.conversations;
CREATE POLICY "Les participants peuvent initialiser une conversation"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (auth.uid() = man_id OR auth.uid() = woman_id);

DROP POLICY IF EXISTS "Les participants peuvent mettre à jour une conversation" ON public.conversations;
CREATE POLICY "Les participants peuvent mettre à jour une conversation"
ON public.conversations FOR UPDATE TO authenticated
USING (auth.uid() = man_id OR auth.uid() = woman_id);

-- Messages RLS
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
        -- Cas A : La femme peut TOUJOURS envoyer des messages gratuitement
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.id = auth.uid() AND p.gender = 'female'
        )
        OR
        -- Cas B : L'homme ne peut envoyer que si la discussion est débloquée
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

-- 3. FONCTIONS RPC
-- 3.1 Créer ou retrouver une conversation entre l'utilisateur connecté et un autre profil
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_gender TEXT;
    v_other_gender TEXT;
    v_man_id UUID;
    v_woman_id UUID;
    v_conversation_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    IF auth.uid() = p_other_user_id THEN
        RAISE EXCEPTION 'Impossible de créer une conversation avec soi-même.';
    END IF;

    SELECT gender INTO current_user_gender FROM public.profiles WHERE id = auth.uid();
    SELECT gender INTO v_other_gender FROM public.profiles WHERE id = p_other_user_id;

    IF current_user_gender IS NULL OR v_other_gender IS NULL THEN
        RAISE EXCEPTION 'Profil introuvable.';
    END IF;

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
$$;

-- 3.2 Débloquer la discussion par l'homme
CREATE OR REPLACE FUNCTION public.unlock_conversation(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    UPDATE public.conversations
    SET is_unlocked_by_man = TRUE,
        unlocked_at = NOW(),
        updated_at = NOW()
    WHERE id = p_conversation_id 
      AND man_id = auth.uid();
      
    RETURN FOUND;
END;
$$;

-- 3.3 Marquer les messages d'une conversation comme lus
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.messages
    SET is_read = TRUE
    WHERE conversation_id = p_conversation_id
      AND receiver_id = auth.uid()
      AND is_read = FALSE;
END;
$$;

-- 4. REALTIME PUBLICATION
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
