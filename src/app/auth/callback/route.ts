import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route de callback OAuth (Google) et confirmation email Supabase
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Vérifier si le profil de l'utilisateur est déjà complété
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_profile_completed')
          .eq('id', user.id)
          .maybeSingle<{ is_profile_completed: boolean }>()

        // Si le profil n'existe pas encore ou n'est pas complété -> Onboarding
        if (!profile || !profile.is_profile_completed) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }

        // Sinon vers la découverte
        return NextResponse.redirect(`${origin}/discover`)
      }
    }
  }

  // En cas d'erreur ou d'absence de code, rediriger vers login
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
