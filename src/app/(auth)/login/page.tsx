'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('message') === 'check_email') {
      setInfoMessage('Un email de confirmation vous a été envoyé. Vérifiez votre boîte de réception.')
    }
    if (searchParams.get('error') === 'auth_failed') {
      setErrorMessage('La connexion a échoué. Veuillez réessayer.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Email ou mot de passe incorrect.')
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('Veuillez confirmer votre adresse email avant de vous connecter.')
        } else {
          setErrorMessage(error.message)
        }
        setIsLoading(false)
        return
      }

      if (data?.user) {
        // Vérifier si le profil existe et est complété
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_profile_completed')
          .eq('id', data.user.id)
          .maybeSingle<{ is_profile_completed: boolean }>()

        if (!profile || !profile.is_profile_completed) {
          router.push('/onboarding')
        } else {
          router.push('/discover')
        }
        router.refresh()
      }
    } catch {
      setErrorMessage('Une erreur de connexion est survenue.')
      setIsLoading(false)
    }
  }

  return (
    <div className="relative z-10 w-full">
      <AuthHeader
        title="Bon retour sur Karea"
        subtitle="Connectez-vous pour retrouver vos correspondances et vos vidéos"
      />

      {/* Bouton Google OAuth */}
      <div className="mb-6">
        <GoogleButton text="Se connecter avec Google" />
      </div>

      {/* Séparateur */}
      <div className="relative flex items-center justify-center my-6">
        <div className="border-t border-stone-800 w-full" />
        <span className="bg-[#0D0B0B] px-3 text-xs text-stone-500 uppercase tracking-wider font-medium">
          ou avec votre email
        </span>
        <div className="border-t border-stone-800 w-full" />
      </div>

      {/* Notifications d'information ou d'erreur */}
      {infoMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>{infoMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulaire de connexion */}
      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Adresse email"
          type="email"
          placeholder="votre.email@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          leftIcon={<Mail className="w-4 h-4" />}
        />

        <Input
          label="Mot de passe"
          type="password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          leftIcon={<Lock className="w-4 h-4" />}
        />

        <Button type="submit" size="lg" className="w-full mt-2" isLoading={isLoading}>
          Se connecter
        </Button>
      </form>

      {/* Lien vers inscription */}
      <p className="text-center text-xs text-stone-400 mt-6">
        Pas encore de compte ?{' '}
        <Link
          href="/register"
          className="text-[#E05A47] hover:text-[#F59E0B] font-semibold transition-colors"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-center p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Halos lumineux chaleureux */}
      <div className="absolute -top-32 -left-32 w-72 h-72 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-20 text-stone-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#E05A47]" />
            <span className="text-xs">Chargement de la page...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  )
}
