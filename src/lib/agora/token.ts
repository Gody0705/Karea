import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface AgoraTokenResponse {
  token: string
  appId: string
  channelName: string
  uid: string
  expiresAt: string
}

/**
 * Récupère un token RTC Agora sécurisé depuis l'Edge Function Supabase `agora-token`.
 * Le certificat Agora reste strictement secret côté serveur.
 */
export async function fetchAgoraToken(
  supabase: SupabaseClient<Database>,
  channelName: string
): Promise<AgoraTokenResponse> {
  const { data, error } = await supabase.functions.invoke<AgoraTokenResponse>(
    'agora-token',
    {
      body: { channelName },
    }
  )

  if (error) {
    let errorMessage = 'Impossible de générer le token d’appel vidéo.'
    try {
      if (typeof error === 'object' && error !== null && 'context' in error) {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json()
          if (body?.error) errorMessage = body.error
        }
      }
    } catch {
      // Ignore json parse fallback
    }
    throw new Error(errorMessage)
  }

  if (!data?.token || !data?.appId) {
    throw new Error('Réponse invalide du serveur de visioconférence.')
  }

  return data
}
