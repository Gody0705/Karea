-- ==============================================================================
-- KAREA - MIGRATION 20261009160000_CREDITS_BILLING_TRANSACTIONS
-- Système de crédits (tokens), tarification par paliers, facturation à la seconde
-- et historique des transactions pour les appels vidéo normaux
-- ==============================================================================

-- 1. TABLE DE CONFIGURATION DU SYSTÈME (app_config)
CREATE TABLE IF NOT EXISTS public.app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion / Initialisation des valeurs par défaut configurables
INSERT INTO public.app_config (key, value, description)
VALUES 
    (
        'female_share_percentage', 
        '40'::jsonb, 
        'Pourcentage de tokens reversé à la femme lors d''un appel (ex: 40)'
    ),
    (
        'platform_share_percentage', 
        '60'::jsonb, 
        'Pourcentage de tokens conservé par la plateforme lors d''un appel (ex: 60)'
    ),
    (
        'default_call_price_per_minute', 
        '25'::jsonb, 
        'Tarif de départ en tokens par minute pour une femme débutante (ex: 25)'
    ),
    (
        'min_call_price_per_minute', 
        '25'::jsonb, 
        'Tarif minimum autorisé en tokens par minute'
    ),
    (
        'max_call_price_per_minute', 
        '60'::jsonb, 
        'Tarif maximum autorisé en tokens par minute'
    ),
    (
        'call_price_step', 
        '5'::jsonb, 
        'Palier d''augmentation du tarif (ex: 5 -> 25, 30, 35, 40, 45, 50, 55, 60)'
    ),
    (
        'min_precall_seconds_required', 
        '60'::jsonb, 
        'Nombre minimum de secondes requises pour pouvoir initier un appel (ex: 60 = 1 minute)'
    )
ON CONFLICT (key) DO NOTHING;

-- 2. COLONNES DE SOLDES SUR PROFILES
-- token_balance: solde de tokens utilisable par l'homme (ou n'importe quel profil)
-- earned_tokens: solde de tokens gagnés par la femme
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS token_balance NUMERIC(12, 4) NOT NULL DEFAULT 100 CHECK (token_balance >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS earned_tokens NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (earned_tokens >= 0);

-- Mettre à jour les femmes pour avoir par défaut le tarif de départ de 25 tokens/min
-- si leur tarif était l'ancien 100 par défaut
UPDATE public.profiles 
SET price_per_minute = 25 
WHERE gender = 'female' AND (price_per_minute = 100 OR price_per_minute IS NULL OR price_per_minute < 25);

-- Pour les hommes, s'assurer qu'ils ont un solde de départ (par exemple 100 tokens de bienvenue)
UPDATE public.profiles
SET token_balance = 150
WHERE gender = 'male' AND token_balance < 25;

-- 3. TABLE DES TRANSACTIONS FINANCIÈRES (transactions)
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

-- 4. RLS POUR APP_CONFIG ET TRANSACTIONS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique de la configuration de l'application" ON public.app_config;
CREATE POLICY "Lecture publique de la configuration de l'application"
ON public.app_config FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Les utilisateurs voient leurs propres transactions" ON public.transactions;
CREATE POLICY "Les utilisateurs voient leurs propres transactions"
ON public.transactions FOR SELECT TO authenticated
USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- 5. RPC : VÉRIFICATION ET DÉMARRAGE D'APPEL DIRECT (AVEC VÉRIFICATION DU SOLDE >= 1 MIN)
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
    v_callee_rate INTEGER;
    v_required_tokens NUMERIC;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentification requise.';
    END IF;

    IF v_caller_id = p_callee_id THEN
        RAISE EXCEPTION 'Vous ne pouvez pas vous appeler vous-même.';
    END IF;

    -- Verrouillage des deux lignes (caller et callee)
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

    -- Déterminer le tarif effectif de la femme (par paliers de 25 à 60)
    v_callee_rate := COALESCE(v_callee.price_per_minute, 25);
    IF v_callee_rate < 25 THEN
        v_callee_rate := 25;
    ELSIF v_callee_rate > 60 THEN
        v_callee_rate := 60;
    END IF;

    -- RÈGLE PRÉ-APPEL : L'homme doit avoir au moins 1 minute de tokens
    v_required_tokens := v_callee_rate;
    IF v_caller.gender = 'male' AND COALESCE(v_caller.token_balance, 0) < v_required_tokens THEN
        RAISE EXCEPTION 'Solde insuffisant : vous devez posséder au moins % tokens pour 1 minute d''appel.', v_required_tokens;
    END IF;

    INSERT INTO public.call_sessions (
        id, 
        caller_id, 
        receiver_id, 
        call_type, 
        status, 
        price_per_minute, 
        channel_name,
        total_cost,
        female_earnings,
        platform_fee
    )
    VALUES (
        v_session_id, 
        v_caller_id, 
        p_callee_id, 
        'direct', 
        'ringing', 
        v_callee_rate, 
        'karea_' || v_session_id::text,
        0,
        0,
        0
    )
    RETURNING * INTO v_session;

    UPDATE public.profiles
    SET in_call = TRUE, updated_at = NOW()
    WHERE id IN (v_caller_id, p_callee_id);

    RETURN v_session;
END;
$$;

-- 6. RPC : FACTURATION EN TEMPS RÉEL À LA SECONDE (PRORATA) PENDANT L'APPEL
-- Appelé périodiquement pendant l'appel (ex: chaque 3 ou 5 secondes) ou par seconde
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

    -- Récupérer la session d'appel
    SELECT * INTO v_session
    FROM public.call_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Session d''appel introuvable.';
    END IF;

    IF v_session.status <> 'in_progress' THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'call_not_active',
            'should_hangup', true
        );
    END IF;

    -- Calculer les secondes non encore facturées
    v_seconds_to_bill := p_elapsed_seconds - COALESCE(v_session.duration_seconds, 0);
    IF v_seconds_to_bill <= 0 THEN
        -- Déjà à jour
        SELECT token_balance INTO v_new_man_balance FROM public.profiles WHERE id = v_session.caller_id;
        SELECT earned_tokens INTO v_new_woman_earned FROM public.profiles WHERE id = v_session.receiver_id;
        RETURN jsonb_build_object(
            'success', true,
            'billed_seconds', 0,
            'man_balance', v_new_man_balance,
            'woman_earnings', v_new_woman_earned,
            'should_hangup', false
        );
    END IF;

    -- Récupérer les pourcentages depuis app_config si définis
    SELECT (value->>0)::NUMERIC INTO v_female_pct FROM public.app_config WHERE key = 'female_share_percentage';
    IF v_female_pct IS NULL THEN v_female_pct := 40.0; END IF;
    v_platform_pct := 100.0 - v_female_pct;

    -- Verrouiller les profils
    SELECT * INTO v_man FROM public.profiles WHERE id = v_session.caller_id FOR UPDATE;
    SELECT * INTO v_woman FROM public.profiles WHERE id = v_session.receiver_id FOR UPDATE;

    -- Tarif par seconde (price_per_minute / 60)
    v_rate_per_sec := (COALESCE(v_session.price_per_minute, 25)::NUMERIC) / 60.0;
    v_total_cost_chunk := ROUND((v_rate_per_sec * v_seconds_to_bill)::NUMERIC, 4);

    -- Si le solde de l'homme est inférieur au coût total demandé
    IF v_man.token_balance < v_total_cost_chunk THEN
        -- Ajuster aux secondes restantes payables
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

        -- Mettre à jour la session
        UPDATE public.call_sessions
        SET duration_seconds = COALESCE(duration_seconds, 0) + v_seconds_to_bill,
            total_cost = COALESCE(total_cost, 0) + v_total_cost_chunk,
            female_earnings = COALESCE(female_earnings, 0) + v_female_chunk,
            platform_fee = COALESCE(platform_fee, 0) + v_platform_chunk
        WHERE id = p_session_id;

        -- Enregistrer la transaction
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

    -- Vérifier si le solde restant est épuisé
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

-- 7. REALTIME SUR PROFILES, CALL_SESSIONS ET TRANSACTIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'app_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;
  END IF;
END $$;
