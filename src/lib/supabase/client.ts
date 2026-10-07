import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

/**
 * Client Supabase côté navigateur (CSR)
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-anon-key'

  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
}
