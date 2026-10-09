-- ==============================================================================
-- KAREA - MIGRATION 20261009180000_FIX_BILLING_CREDITS_SECURITY
-- 1. Sécurisation stricte des colonnes token_balance et earned_tokens (empêche
--    toute modification directe depuis le client / navigateur).
-- 2. Fonction RPC process_call_billing_tick robuste :
--    - Détermine dynamiquement l'homme et la femme (par genre et rôle)
--    - Autorise le participant authentifié à débiter
--    - Enregistre chaque débit dans transactions
--    - Déclenche la fin d'appel propre (end_direct_call) côté serveur quand solde = 0
-- ==============================================================================

-- 1. SÉCURITÉ : VERROUILLER token_balance et earned_tokens CONTRE TOUTE MODIFICATION CLIENT
CREATE OR REPLACE FUNCTION public.protect_profile_financial_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la mise à jour provient d'un utilisateur standard (requête cliente via l'API REST/GraphQL)
    -- et tente d'altérer les soldes ou gains
    IF (current_setting('role', true) = 'authenticated' OR current_setting('role', true) = 'anon') THEN
        IF NEW.token_balance IS DISTINCT FROM OLD.token_balance THEN
            RAISE EXCEPTION 'Modification non autorisée du solde de tokens.';
        END IF;
        IF NEW.earned_tokens IS DISTINCT FROM OLD.earned_tokens THEN
            RAISE EXCEPTION 'Modification non autorisée des gains.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_financial_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_financial_columns
BEFORE UPDATE OF token_balance, earned_tokens ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_financial_columns();

-- 2. FONCTION RPC DE FACTURATION SERVEUR À LA SECONDE / PAR INTERVALLE
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

-- Droits d'exécution RPC
REVOKE ALL ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_call_billing_tick(UUID, INTEGER) TO authenticated;
