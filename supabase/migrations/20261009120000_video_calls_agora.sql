-- ==============================================================================
-- KAREA - MIGRATION : APPELS VIDÉO 1-TO-1 (AGORA)
-- Date : 2026-10-09
-- À exécuter une fois dans le SQL Editor de Supabase (idempotent).
-- Le même contenu est intégré dans supabase/schema.sql (section 10).
-- ==============================================================================

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
