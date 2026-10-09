-- ==============================================================================
-- KAREA - MIGRATION 20261009190000_ADMIN_GRANT_TOKENS
-- Fonction d'administration sécurisée pour créditer des tokens à un utilisateur
-- ==============================================================================

-- 1. Ajout de la colonne description si inexistante et mise à jour des types de transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check'
    ) THEN
        ALTER TABLE public.transactions DROP CONSTRAINT transactions_type_check;
    END IF;
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
        CHECK (type IN ('call_per_second', 'call_pickup', 'call_final_reconcile', 'call_final', 'gift', 'unlock', 'admin_credit'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 2. Fonction admin_grant_tokens
CREATE OR REPLACE FUNCTION public.admin_grant_tokens(
    p_user_id UUID,
    p_amount NUMERIC,
    p_reason TEXT DEFAULT 'Crédit administrateur'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_balance NUMERIC(12, 4);
    v_profile public.profiles;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Le montant doit être strictement supérieur à 0.';
    END IF;

    -- Activer le drapeau local de transaction pour franchir le trigger de protection
    PERFORM set_config('karea.internal_billing', 'true', true);

    -- Vérifier et verrouiller le profil utilisateur
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_profile.id IS NULL THEN
        RAISE EXCEPTION 'Profil utilisateur introuvable pour l''ID %', p_user_id;
    END IF;

    -- Créditer le solde de tokens
    UPDATE public.profiles
    SET token_balance = token_balance + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING token_balance INTO v_new_balance;

    -- Enregistrer la transaction administrative
    INSERT INTO public.transactions (
        payer_id,
        payee_id,
        amount,
        payee_earnings,
        platform_fee,
        type,
        seconds_billed,
        description
    )
    VALUES (
        p_user_id,
        p_user_id,
        p_amount,
        p_amount,
        0,
        'admin_credit',
        0,
        COALESCE(p_reason, 'Crédit administrateur')
    );

    RETURN v_new_balance;
END;
$$;

-- 3. Sécurité stricte : Interdiction totale d'appel depuis le navigateur
REVOKE ALL ON FUNCTION public.admin_grant_tokens(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_tokens(UUID, NUMERIC, TEXT) TO service_role;
