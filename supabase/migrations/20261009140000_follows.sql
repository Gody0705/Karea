-- ==============================================================================
-- KAREA - MIGRATION : TABLE DES ABONNEMENTS / PROFILS SUIVIS (FOLLOWS)
-- Date : 2026-10-09
-- ==============================================================================

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

-- RLS
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

-- Publication Realtime sur follows
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
