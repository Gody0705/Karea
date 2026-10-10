-- ==============================================================================
-- KAREA - MIGRATION 20261010033000_BILLING_PER_MINUTE
-- Passage à la facturation PAR MINUTE COMMENCÉE (entiers, anti double-débit)
-- ==============================================================================

-- 1. ARRONDIS DES SOLDES EXISTANTS À L'ENTIER INFÉRIEUR (Bypass temporaire du verrou)
DO $$
BEGIN
    PERFORM set_config('karea.internal_billing', 'true', true);
    
    UPDATE public.profiles
    SET token_balance = FLOOR(token_balance)::BIGINT,
        earned_tokens = FLOOR(earned_tokens)::BIGINT;
END $$;

-- 2. PASSAGE DES COLONNES DE SOLDES EN BIGINT (ENTIERS STRICTS)
ALTER TABLE public.profiles 
    ALTER COLUMN token_balance TYPE BIGINT USING FLOOR(token_balance)::BIGINT,
    ALTER COLUMN token_balance SET DEFAULT 0;

ALTER TABLE public.profiles 
    ALTER COLUMN earned_tokens TYPE BIGINT USING FLOOR(earned_tokens)::BIGINT,
    ALTER COLUMN earned_tokens SET DEFAULT 0;

-- 3. MISE À JOUR DE LA TABLE TRANSACTIONS (Montants entiers + numéro de minute)
ALTER TABLE public.transactions 
    ALTER COLUMN amount TYPE BIGINT USING ROUND(amount)::BIGINT,
    ALTER COLUMN payee_earnings TYPE BIGINT USING ROUND(payee_earnings)::BIGINT,
    ALTER COLUMN platform_fee TYPE BIGINT USING ROUND(platform_fee)::BIGINT;

-- Ajout de la colonne minute_number si inexistante
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS minute_number INTEGER;

-- Contrainte de type autorisant 'call_minute'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check'
    ) THEN
        ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
    END IF;
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
        CHECK (type IN ('call_minute', 'call_per_second', 'call_pickup', 'call_final_reconcile', 'call_final', 'gift', 'unlock', 'admin_credit'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 4. CONTRAINTE UNIQUE ANTI-DOUBLE DÉBIT (session_id + minute_number pour call_minute)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_session_minute_unique 
ON public.transactions(session_id, minute_number) 
WHERE (minute_number IS NOT NULL AND type = 'call_minute');

-- 5. TRIGGER DE PROTECTION DES COLONNES FINANCIÈRES (Inchangé et actif)
CREATE OR REPLACE FUNCTION public.protect_profile_financial_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('karea.internal_billing', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF NEW.token_balance IS DISTINCT FROM OLD.token_balance THEN
        RAISE EXCEPTION 'Modification directe du solde de tokens non autorisée.';
    END IF;

    IF NEW.earned_tokens IS DISTINCT FROM OLD.earned_tokens THEN
        RAISE EXCEPTION 'Modification directe des gains non autorisée.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_financial_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_financial_columns
BEFORE UPDATE OF token_balance, earned_tokens ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_financial_columns();

-- 6. ACCEPTATION DE L'APPEL (accept_direct_call)
-- Active l'appel et démarre le chronomètre SANS débiter à l'avance.
-- Le premier débit se fait dès que les flux sont connectés dans la salle vidéo.
CREATE OR REPLACE FUNCTION public.accept_direct_call(p_session_id UUID)
RETURNS public.call_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session public.call_sessions;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
      AND receiver_id = v_user_id
      AND status = 'ringing'
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Cet appel n''est plus disponible.';
    END IF;

    UPDATE public.call_sessions
    SET status = 'in_progress',
        started_at = NOW()
    WHERE id = p_session_id
    RETURNING * INTO v_session;

    UPDATE public.profiles
    SET in_call = TRUE, updated_at = NOW()
    WHERE id IN (v_session.caller_id, v_session.receiver_id);

    RETURN v_session;
END;
$$;

-- 7. FACTURATION PAR MINUTE COMMENCÉE (process_call_billing_tick)
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
    v_caller public.profiles;
    v_receiver public.profiles;
    v_man public.profiles;
    v_woman public.profiles;
    
    v_female_pct NUMERIC := 40.0;
    v_platform_pct NUMERIC := 60.0;
    
    v_rate_per_min BIGINT;
    v_female_share BIGINT;
    v_platform_share BIGINT;
    
    v_target_minute INTEGER;
    v_min INTEGER;
    v_already_billed BOOLEAN;
    v_can_afford_next BOOLEAN;
    v_billed_any BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    -- Activer le drapeau interne pour autoriser la mise à jour des soldes
    PERFORM set_config('karea.internal_billing', 'true', true);

    -- Récupérer la session d'appel
    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session d''appel introuvable.';
    END IF;

    -- Vérifier que l'utilisateur est bien participant de cet appel
    IF v_session.caller_id <> v_user_id AND v_session.receiver_id <> v_user_id THEN
        RAISE EXCEPTION 'Accès refusé pour cet appel.';
    END IF;

    -- Si l'appel est terminé, refuser la facturation
    IF v_session.status IN ('ended', 'rejected', 'missed', 'busy') THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'call_ended',
            'should_hangup', true
        );
    END IF;

    -- Charger les profils
    SELECT * INTO v_caller FROM public.profiles WHERE id = v_session.caller_id FOR UPDATE;
    SELECT * INTO v_receiver FROM public.profiles WHERE id = v_session.receiver_id FOR UPDATE;

    -- Identifier qui paie (l'homme) et qui reçoit (la femme)
    IF v_caller.gender = 'male' THEN
        v_man := v_caller;
        v_woman := v_receiver;
    ELSE
        v_man := v_receiver;
        v_woman := v_caller;
    END IF;

    -- Pourcentage de partage (40% pour la femme)
    SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
    IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
    v_platform_pct := 100.0 - v_female_pct;

    -- Tarif de la minute (entier)
    v_rate_per_min := COALESCE(v_session.price_per_minute, v_woman.price_per_minute, 25)::BIGINT;
    IF v_rate_per_min < 25 THEN v_rate_per_min := 25; END IF;

    -- Calcul de la minute commencée (0 à 59s = min 1, 60 à 119s = min 2, etc.)
    v_target_minute := (GREATEST(0, p_elapsed_seconds) / 60) + 1;

    -- Partage en tokens entiers
    v_female_share := ROUND(v_rate_per_min * (v_female_pct / 100.0))::BIGINT;
    v_platform_share := v_rate_per_min - v_female_share;

    -- Facturer chaque minute commencée non encore réglée
    FOR v_min IN 1..v_target_minute LOOP
        SELECT EXISTS (
            SELECT 1 FROM public.transactions
            WHERE session_id = p_session_id
              AND minute_number = v_min
              AND type = 'call_minute'
        ) INTO v_already_billed;

        IF NOT v_already_billed THEN
            -- Si l'homme n'a pas assez pour régler cette minute
            IF v_man.token_balance < v_rate_per_min THEN
                -- Couper l'appel des deux côtés
                PERFORM public.end_direct_call(p_session_id, 'ended');
                
                RETURN jsonb_build_object(
                    'success', true,
                    'should_hangup', true,
                    'reason', 'insufficient_balance',
                    'current_minute', v_min,
                    'rate_per_minute', v_rate_per_min,
                    'man_balance', v_man.token_balance,
                    'woman_earnings', v_woman.earned_tokens
                );
            END IF;

            -- Débiter l'homme
            UPDATE public.profiles
            SET token_balance = token_balance - v_rate_per_min,
                updated_at = NOW()
            WHERE id = v_man.id
            RETURNING token_balance INTO v_man.token_balance;

            -- Créditer la femme
            UPDATE public.profiles
            SET earned_tokens = earned_tokens + v_female_share,
                updated_at = NOW()
            WHERE id = v_woman.id
            RETURNING earned_tokens INTO v_woman.earned_tokens;

            -- Mettre à jour la session d'appel
            UPDATE public.call_sessions
            SET total_cost = COALESCE(total_cost, 0) + v_rate_per_min,
                female_earnings = COALESCE(female_earnings, 0) + v_female_share,
                platform_fee = COALESCE(platform_fee, 0) + v_platform_share,
                duration_seconds = GREATEST(COALESCE(duration_seconds, 0), p_elapsed_seconds),
                status = 'in_progress'
            WHERE id = p_session_id;

            -- Enregistrer la transaction pour la minute
            INSERT INTO public.transactions (
                session_id,
                payer_id,
                payee_id,
                amount,
                payee_earnings,
                platform_fee,
                type,
                minute_number,
                seconds_billed,
                description
            )
            VALUES (
                p_session_id,
                v_man.id,
                v_woman.id,
                v_rate_per_min,
                v_female_share,
                v_platform_share,
                'call_minute',
                v_min,
                60,
                'Minute ' || v_min || ' de l''appel'
            );

            v_billed_any := TRUE;
        END IF;
    END LOOP;

    -- Vérifier si le solde permet de payer la minute suivante
    v_can_afford_next := (v_man.token_balance >= v_rate_per_min);

    RETURN jsonb_build_object(
        'success', true,
        'billed_this_tick', v_billed_any,
        'current_minute', v_target_minute,
        'rate_per_minute', v_rate_per_min,
        'man_balance', v_man.token_balance,
        'woman_earnings', v_woman.earned_tokens,
        'can_afford_next_minute', v_can_afford_next,
        'should_hangup', false
    );
END;
$$;

-- 8. FIN DE L'APPEL (end_direct_call)
CREATE OR REPLACE FUNCTION public.end_direct_call(p_session_id UUID, p_reason TEXT DEFAULT 'ended')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_session public.call_sessions;
    v_final_status TEXT;
    v_actual_elapsed INTEGER;
BEGIN
    PERFORM set_config('karea.internal_billing', 'true', true);

    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RETURN;
    END IF;

    IF v_user_id IS NOT NULL AND v_session.caller_id <> v_user_id AND v_session.receiver_id <> v_user_id THEN
        RETURN;
    END IF;

    IF v_session.status IN ('ringing', 'in_progress', 'initiated') THEN
        v_final_status := CASE
            WHEN v_session.status = 'in_progress' THEN 'ended'
            WHEN p_reason IN ('rejected', 'missed') THEN p_reason
            ELSE 'missed'
        END;

        IF v_session.status = 'in_progress' AND v_session.started_at IS NOT NULL THEN
            v_actual_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INTEGER);
        ELSE
            v_actual_elapsed := COALESCE(v_session.duration_seconds, 0);
        END IF;

        UPDATE public.call_sessions
        SET status = v_final_status,
            duration_seconds = v_actual_elapsed,
            ended_at = NOW()
        WHERE id = p_session_id;

        UPDATE public.profiles
        SET in_call = FALSE, updated_at = NOW()
        WHERE id IN (v_session.caller_id, v_session.receiver_id);
    END IF;
END;
$$;

-- 9. FONCTION D'ADMINISTRATION POUR CRÉDITER DES TOKENS ENTIERS (admin_grant_tokens)
CREATE OR REPLACE FUNCTION public.admin_grant_tokens(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT DEFAULT 'Crédit administrateur'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_amount_int BIGINT;
    v_new_balance BIGINT;
    v_profile public.profiles;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant doit être strictement supérieur à 0.';
    END IF;

    v_amount_int := FLOOR(p_amount)::BIGINT;
    IF v_amount_int <= 0 THEN
        RAISE EXCEPTION 'Le montant arrondi doit être supérieur à 0.';
    END IF;

    PERFORM set_config('karea.internal_billing', 'true', true);

    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur introuvable.';
    END IF;

    UPDATE public.profiles
    SET token_balance = token_balance + v_amount_int,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING token_balance INTO v_new_balance;

    INSERT INTO public.transactions (
        payer_id,
        payee_id,
        amount,
        payee_earnings,
        platform_fee,
        type,
        description
    )
    VALUES (
        p_user_id,
        p_user_id,
        v_amount_int,
        0,
        0,
        'admin_credit',
        p_reason
    );

    RETURN v_new_balance;
END;
$$;

-- 10. SÉCURITÉ ET DROITS D'EXÉCUTION
REVOKE ALL ON FUNCTION public.accept_direct_call(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_direct_call(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.end_direct_call(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_direct_call(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_grant_tokens(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_tokens(UUID, NUMERIC, TEXT) TO service_role;
