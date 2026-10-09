-- ==============================================================================
-- KAREA - MIGRATION 20261009180000_FIX_BILLING_CREDITS_SECURITY
-- 1. Sécurisation stricte des colonnes token_balance et earned_tokens contre
--    les modifications clientes directes via REST/GraphQL, tout en permettant
--    aux fonctions serveurs SECURITY DEFINER d'effectuer les débits/crédits.
-- 2. DÉBIT IMMÉDIAT AU DÉCROCHAGE :
--    Dès que le profil féminin accepte l'appel (accept_direct_call), un premier
--    bloc de 5 secondes est immédiatement débité du solde de l'homme, crédité
--    à la femme (40%) et consigné dans transactions.
-- 3. FACTURATION CONTINUE PENDANT L'APPEL (process_call_billing_tick) :
--    Débit régulier calculé à la seconde (prorata), alerte à 15s de la fin,
--    et interruption automatique côté serveur quand le solde atteint 0.
-- 4. RÉCONCILIATION FINALE (end_direct_call) :
--    Décompte exact des dernières secondes écoulées à la fermeture de l'appel.
-- ==============================================================================

-- 0. AJUSTEMENT DE LA CONTRAINTE DES TYPES DE TRANSACTIONS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check'
    ) THEN
        ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
    END IF;
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
        CHECK (type IN ('call_per_second', 'call_pickup', 'call_final_reconcile', 'call_final', 'gift', 'unlock'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 1. SÉCURITÉ : TRIGGER DE PROTECTION DES SOLDES
-- N'autorise la modification de token_balance et earned_tokens QUE si la fonction
-- a défini karea.internal_billing = 'true' pour la transaction courante.
CREATE OR REPLACE FUNCTION public.protect_profile_financial_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Si l'opération provient d'une fonction interne autorisée (SECURITY DEFINER)
    IF current_setting('karea.internal_billing', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Sinon (requête directe du client web via l'API REST/GraphQL de Supabase)
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

-- 2. DÉBIT DIRECT DÈS LE DÉCROCHAGE (accept_direct_call)
CREATE OR REPLACE FUNCTION public.accept_direct_call(p_session_id UUID)
RETURNS public.call_sessions
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
    
    v_rate_per_sec NUMERIC;
    v_initial_seconds INTEGER := 5; -- Facturation immédiate d'un premier bloc de 5 secondes dès le décrochage
    v_initial_cost NUMERIC(12, 4);
    v_female_share NUMERIC(12, 4);
    v_platform_share NUMERIC(12, 4);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    -- Activer le drapeau interne pour autoriser la mise à jour des soldes
    PERFORM set_config('karea.internal_billing', 'true', true);

    -- Verrouiller et récupérer la session d'appel
    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
      AND receiver_id = v_user_id
      AND status = 'ringing'
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Cet appel n''est plus disponible.';
    END IF;

    -- Charger les profils
    SELECT * INTO v_caller FROM public.profiles WHERE id = v_session.caller_id FOR UPDATE;
    SELECT * INTO v_receiver FROM public.profiles WHERE id = v_session.receiver_id FOR UPDATE;

    -- Déterminer qui paie (l'homme) et qui reçoit (la femme)
    IF v_caller.gender = 'male' THEN
        v_man := v_caller;
        v_woman := v_receiver;
    ELSE
        v_man := v_receiver;
        v_woman := v_caller;
    END IF;

    -- Pourcentage de partage
    SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
    IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
    v_platform_pct := 100.0 - v_female_pct;

    -- Tarif de la femme à la seconde (ex: 25 tokens / 60 = 0.4167 tok/sec)
    v_rate_per_sec := (COALESCE(v_session.price_per_minute, v_woman.price_per_minute, 25)::NUMERIC) / 60.0;
    v_initial_cost := ROUND((v_rate_per_sec * v_initial_seconds)::NUMERIC, 4);

    -- Si l'homme a moins que le coût initial
    IF v_man.token_balance < v_initial_cost THEN
        IF v_rate_per_sec > 0 AND v_man.token_balance > 0 THEN
            v_initial_seconds := FLOOR(v_man.token_balance / v_rate_per_sec)::INTEGER;
            v_initial_cost := v_man.token_balance;
        ELSE
            v_initial_seconds := 0;
            v_initial_cost := 0;
        END IF;
    END IF;

    v_female_share := ROUND((v_initial_cost * (v_female_pct / 100.0))::NUMERIC, 4);
    v_platform_share := v_initial_cost - v_female_share;

    -- Débiter l'homme et créditer la femme immédiatement au décrochage
    IF v_initial_cost > 0 THEN
        UPDATE public.profiles
        SET token_balance = GREATEST(0, token_balance - v_initial_cost),
            in_call = TRUE,
            updated_at = NOW()
        WHERE id = v_man.id;

        UPDATE public.profiles
        SET earned_tokens = earned_tokens + v_female_share,
            in_call = TRUE,
            updated_at = NOW()
        WHERE id = v_woman.id;

        -- Enregistrer la transaction initiale
        INSERT INTO public.transactions (
            session_id,
            payer_id,
            payee_id,
            amount,
            payee_earnings,
            platform_fee,
            type,
            seconds_billed
        )
        VALUES (
            p_session_id,
            v_man.id,
            v_woman.id,
            v_initial_cost,
            v_female_share,
            v_platform_share,
            'call_pickup',
            v_initial_seconds
        );
    ELSE
        UPDATE public.profiles
        SET in_call = TRUE, updated_at = NOW()
        WHERE id IN (v_session.caller_id, v_session.receiver_id);
    END IF;

    -- Activer la session avec statut in_progress et les premières secondes facturées
    UPDATE public.call_sessions
    SET status = 'in_progress',
        started_at = NOW(),
        duration_seconds = v_initial_seconds,
        total_cost = v_initial_cost,
        female_earnings = v_female_share,
        platform_fee = v_platform_share
    WHERE id = p_session_id
    RETURNING * INTO v_session;

    RETURN v_session;
END;
$$;

-- 3. FACTURATION EN COURS D'APPEL À LA SECONDE (process_call_billing_tick)
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

    -- Calculer les secondes écoulées non encore facturées
    v_seconds_to_bill := p_elapsed_seconds - COALESCE(v_session.duration_seconds, 0);

    -- Si aucun temps supplémentaire n'est à facturer
    IF v_seconds_to_bill <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'billed_seconds', 0,
            'man_balance', v_man.token_balance,
            'woman_earnings', v_woman.earned_tokens,
            'should_hangup', (v_man.token_balance <= 0)
        );
    END IF;

    -- Récupérer le partage depuis app_config
    SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
    IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
    v_platform_pct := 100.0 - v_female_pct;

    -- Calculer le coût selon le tarif à la seconde (price_per_minute / 60)
    v_rate_per_sec := (COALESCE(v_session.price_per_minute, 25)::NUMERIC) / 60.0;
    v_total_cost_chunk := ROUND((v_rate_per_sec * v_seconds_to_bill)::NUMERIC, 4);

    -- Si le solde de l'homme est inférieur au coût demandé
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

        -- Débiter l'homme
        UPDATE public.profiles
        SET token_balance = GREATEST(0, token_balance - v_total_cost_chunk),
            updated_at = NOW()
        WHERE id = v_man.id
        RETURNING token_balance INTO v_new_man_balance;

        -- Créditer la femme
        UPDATE public.profiles
        SET earned_tokens = earned_tokens + v_female_chunk,
            updated_at = NOW()
        WHERE id = v_woman.id
        RETURNING earned_tokens INTO v_new_woman_earned;

        -- Mettre à jour la session d'appel
        UPDATE public.call_sessions
        SET duration_seconds = COALESCE(duration_seconds, 0) + v_seconds_to_bill,
            total_cost = COALESCE(total_cost, 0) + v_total_cost_chunk,
            female_earnings = COALESCE(female_earnings, 0) + v_female_chunk,
            platform_fee = COALESCE(platform_fee, 0) + v_platform_chunk,
            status = 'in_progress'
        WHERE id = p_session_id;

        -- Enregistrer la transaction dans la table transactions
        INSERT INTO public.transactions (
            session_id,
            payer_id,
            payee_id,
            amount,
            payee_earnings,
            platform_fee,
            type,
            seconds_billed
        )
        VALUES (
            p_session_id,
            v_man.id,
            v_woman.id,
            v_total_cost_chunk,
            v_female_chunk,
            v_platform_chunk,
            'call_per_second',
            v_seconds_to_bill
        );
    ELSE
        v_new_man_balance := v_man.token_balance;
        v_new_woman_earned := v_woman.earned_tokens;
    END IF;

    -- Si le solde de l'homme est tombé à 0, couper proprement l'appel en base
    IF v_new_man_balance <= 0 THEN
        v_should_hangup := TRUE;
        PERFORM public.end_direct_call(p_session_id, 'ended');
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

-- 4. RÉCONCILIATION FINALE À LA FIN DE L'APPEL (end_direct_call)
CREATE OR REPLACE FUNCTION public.end_direct_call(p_session_id UUID, p_reason TEXT DEFAULT 'ended')
RETURNS VOID
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
    v_final_status TEXT;
    
    v_female_pct NUMERIC := 40.0;
    v_platform_pct NUMERIC := 60.0;
    v_rate_per_sec NUMERIC;
    v_actual_elapsed INTEGER;
    v_unbilled_seconds INTEGER;
    v_remaining_cost NUMERIC(12, 4);
    v_female_chunk NUMERIC(12, 4);
    v_platform_chunk NUMERIC(12, 4);
BEGIN
    PERFORM set_config('karea.internal_billing', 'true', true);

    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RETURN;
    END IF;

    -- Vérifier que l'appelant est participant ou appel interne
    IF v_user_id IS NOT NULL AND v_session.caller_id <> v_user_id AND v_session.receiver_id <> v_user_id THEN
        RETURN;
    END IF;

    IF v_session.status IN ('ringing', 'in_progress', 'initiated') THEN
        v_final_status := CASE
            WHEN v_session.status = 'in_progress' THEN 'ended'
            WHEN p_reason IN ('rejected', 'missed') THEN p_reason
            ELSE 'missed'
        END;

        -- Réconciliation des secondes finales non encore débitées si l'appel était en cours
        IF v_session.status = 'in_progress' AND v_session.started_at IS NOT NULL THEN
            v_actual_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_session.started_at))::INTEGER);
            v_unbilled_seconds := v_actual_elapsed - COALESCE(v_session.duration_seconds, 0);

            IF v_unbilled_seconds > 0 THEN
                SELECT * INTO v_caller FROM public.profiles WHERE id = v_session.caller_id FOR UPDATE;
                SELECT * INTO v_receiver FROM public.profiles WHERE id = v_session.receiver_id FOR UPDATE;

                IF v_caller.gender = 'male' THEN
                    v_man := v_caller;
                    v_woman := v_receiver;
                ELSE
                    v_man := v_receiver;
                    v_woman := v_caller;
                END IF;

                SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
                IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
                v_platform_pct := 100.0 - v_female_pct;

                v_rate_per_sec := (COALESCE(v_session.price_per_minute, 25)::NUMERIC) / 60.0;
                v_remaining_cost := ROUND((v_rate_per_sec * v_unbilled_seconds)::NUMERIC, 4);

                IF v_man.token_balance < v_remaining_cost THEN
                    v_remaining_cost := GREATEST(0, v_man.token_balance);
                END IF;

                IF v_remaining_cost > 0 THEN
                    v_female_chunk := ROUND((v_remaining_cost * (v_female_pct / 100.0))::NUMERIC, 4);
                    v_platform_chunk := v_remaining_cost - v_female_chunk;

                    UPDATE public.profiles
                    SET token_balance = GREATEST(0, token_balance - v_remaining_cost),
                        updated_at = NOW()
                    WHERE id = v_man.id;

                    UPDATE public.profiles
                    SET earned_tokens = earned_tokens + v_female_chunk,
                        updated_at = NOW()
                    WHERE id = v_woman.id;

                    UPDATE public.call_sessions
                    SET duration_seconds = COALESCE(duration_seconds, 0) + v_unbilled_seconds,
                        total_cost = COALESCE(total_cost, 0) + v_remaining_cost,
                        female_earnings = COALESCE(female_earnings, 0) + v_female_chunk,
                        platform_fee = COALESCE(platform_fee, 0) + v_platform_chunk
                    WHERE id = p_session_id;

                    INSERT INTO public.transactions (
                        session_id,
                        payer_id,
                        payee_id,
                        amount,
                        payee_earnings,
                        platform_fee,
                        type,
                        seconds_billed
                    )
                    VALUES (
                        p_session_id,
                        v_man.id,
                        v_woman.id,
                        v_remaining_cost,
                        v_female_chunk,
                        v_platform_chunk,
                        'call_final_reconcile',
                        v_unbilled_seconds
                    );
                END IF;
            END IF;
        END IF;

        UPDATE public.call_sessions
        SET status = v_final_status,
            ended_at = NOW()
        WHERE id = p_session_id;
    END IF;

    UPDATE public.profiles
    SET in_call = FALSE, updated_at = NOW()
    WHERE id IN (v_session.caller_id, v_session.receiver_id);
END;
$$;

-- 5. DROITS D'EXÉCUTION
REVOKE ALL ON FUNCTION public.accept_direct_call(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_direct_call(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.end_direct_call(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_direct_call(UUID, TEXT) TO authenticated;
