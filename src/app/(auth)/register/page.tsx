'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Mail, Lock, Calendar, AlertCircle } from 'lucide-react'
import { isAtLeast18YearsOld, getMaxBirthdateAllowed, calculateAge } from '@/lib/utils/age'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [birthdate, setBirthdate] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ageError, setAgeError] = useState<string | null>(null)

  // Validation de l'âge en temps réel à la modification de la date
  const handleBirthdateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value
    setBirthdate(selectedDate)

    if (selectedDate) {
      if (!isAtLeast18YearsOld(selectedDate)) {
        const calculatedAge = calculateAge(selectedDate)
        setAgeError(
          `Vous devez avoir au moins 18 ans (${calculatedAge >= 0 ? calculatedAge : 0} an(s) détecté(s)). L'inscription est réservée aux adultes.`
        )
      } else {
        setAgeError(null)
      }
    } else {
      setAgeError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // 1. Validation de l'âge (18 ans minimum)
    if (!birthdate || !isAtLeast18YearsOld(birthdate)) {
      setAgeError('Vous devez avoir au moins 18 ans pour vous inscrire sur Karea.')
      return
    }

    // 2. Vérification des mots de passe
    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.')
      return
    }

    setIsLoading(true)

    try {
      const redirectOrigin =
        typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      // Inscription Supabase avec stockage de la date de naissance dans les métadonnées
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectOrigin}/auth/callback`,
          data: {
            birthdate: birthdate,
          },
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setErrorMessage('Cette adresse email est déjà utilisée. Connectez-vous plutôt.')
        } else {
          setErrorMessage(error.message)
        }
        setIsLoading(false)
        return
      }

      // Si l'utilisateur est créé et connecté immédiatement (confirmation email désactivée ou session active)
      if (data?.session) {
        router.push('/onboarding')
      } else {
        // Si confirmation d'email requise par le projet Supabase
        router.push('/login?message=check_email')
      }
    } catch {
      setErrorMessage("Une erreur imprévue est survenue lors de l'inscription.")
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-center p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Halos lumineux chaleureux */}
      <div className="absolute -top-32 -right-32 w-72 h-72 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full">
        <AuthHeader
          title="Créer un compte Karea"
          subtitle="Rejoignez la première communauté de rencontres par appel vidéo en Afrique"
        />

        {/* Bouton Google OAuth */}
        <div className="mb-6">
          <GoogleButton text="S'inscrire avec Google" />
        </div>

        {/* Séparateur */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-stone-800 w-full" />
          <span className="bg-[#0D0B0B] px-3 text-xs text-stone-500 uppercase tracking-wider font-medium">
            ou avec votre email
          </span>
          <div className="border-t border-stone-800 w-full" />
        </div>

        {/* Formulaire d'inscription */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Input
            label="Adresse email"
            type="email"
            placeholder="votre.email@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            leftIcon={<Mail className="w-4 h-4" />}
          />

          {/* Date de naissance avec contrainte stricte des 18 ans */}
          <div className="space-y-1">
            <Input
              label="Date de naissance (18 ans minimum)"
              type="date"
              max={getMaxBirthdateAllowed()}
              value={birthdate}
              onChange={handleBirthdateChange}
              required
              error={ageError || undefined}
              hint={!ageError ? "Obligatoire pour garantir la majorité de tous les membres." : undefined}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
          </div>

          <Input
            label="Mot de passe"
            type="password"
            placeholder="Au moins 6 caractères"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Input
            label="Confirmer le mot de passe"
            type="password"
            placeholder="Répétez votre mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full mt-2"
            isLoading={isLoading}
            disabled={!!ageError}
          >
            Créer mon compte
          </Button>
        </form>

        {/* Lien de redirection vers connexion */}
        <p className="text-center text-xs text-stone-400 mt-6">
          Vous avez déjà un compte ?{' '}
          <Link
            href="/login"
            className="text-[#E05A47] hover:text-[#F59E0B] font-semibold transition-colors"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
