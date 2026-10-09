// ==============================================================================
// KAREA - Supabase Edge Function : agora-token
// ------------------------------------------------------------------------------
// Génère un token RTC Agora (valable 1 heure) pour l'utilisateur connecté.
//
// - Refuse toute requête sans utilisateur Supabase authentifié (401).
// - Vérifie que l'utilisateur participe bien à l'appel correspondant au canal
//   demandé (canal = "karea_<id de call_sessions>") afin qu'on ne puisse pas
//   rejoindre l'appel de quelqu'un d'autre (403).
// - Le certificat Agora (AGORA_APP_CERTIFICATE) reste exclusivement côté serveur :
//   seul le token signé et l'App ID (public) sont renvoyés au client.
//
// Secrets requis (Supabase > Edge Functions > Secrets) :
//   AGORA_APP_ID, AGORA_APP_CERTIFICATE
// Variables fournies automatiquement par Supabase :
//   SUPABASE_URL, SUPABASE_ANON_KEY
// ==============================================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { RtcRole, RtcTokenBuilder } from 'npm:agora-token@2.0.6'

const TOKEN_TTL_SECONDS = 60 * 60 // 1 heure
const CHANNEL_REGEX = /^karea_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIVE_CALL_STATUSES = ['ringing', 'in_progress']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405)
  }

  // 1. Vérification de l'utilisateur connecté
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Authentification requise.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const appId = Deno.env.get('AGORA_APP_ID')
  const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')

  if (!supabaseUrl || !supabaseAnonKey || !appId || !appCertificate) {
    console.error('agora-token: variables d’environnement manquantes')
    return json({ error: 'Configuration serveur incomplète.' }, 500)
  }

  // Client Supabase agissant AVEC les droits de l'utilisateur (RLS appliquée)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const jwt = authHeader.replace('Bearer ', '')
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt)

  if (authError || !user) {
    return json({ error: 'Session invalide ou expirée.' }, 401)
  }

  // 2. Validation du canal demandé
  let channelName = ''
  try {
    const body = await req.json()
    channelName = typeof body?.channelName === 'string' ? body.channelName : ''
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400)
  }

  if (!CHANNEL_REGEX.test(channelName)) {
    return json({ error: 'Nom de canal invalide.' }, 400)
  }

  // 3. L'utilisateur doit participer à cet appel (et l'appel doit être actif)
  const sessionId = channelName.slice('karea_'.length)
  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .select('id, caller_id, receiver_id, status')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError || !session) {
    return json({ error: 'Appel introuvable.' }, 403)
  }

  const isParticipant = session.caller_id === user.id || session.receiver_id === user.id
  if (!isParticipant || !ACTIVE_CALL_STATUSES.includes(session.status)) {
    return json({ error: 'Accès à cet appel refusé.' }, 403)
  }

  // 4. Génération du token RTC (uid = identifiant Supabase de l'utilisateur)
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    channelName,
    user.id,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS
  )

  return json({
    token,
    appId,
    channelName,
    uid: user.id,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
  })
})
