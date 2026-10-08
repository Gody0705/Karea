'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sparkles, User, AlertCircle, ArrowRight, ShieldAlert, Check } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [selectedGender, setSelectedGender] = useState<'female' | 'male' | null>(null)
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function checkExistingProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        setCurrentUser(user)

        // Vérifier si l'utilisateur a déjà choisi son genre
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender, first_name')
          .eq('id', user.id)
          .maybeSingle<{ gender: string | null; first_name: string | null }>()

        if (profile?.gender) {
          // Genre déjà configuré : accès direct à la galerie
          router.push('/discover')
          return
        }

        // Pré-remplir le pseudo si déjà renseigné dans user metadata
        if (user.user_metadata?.full_name || user.user_metadata?.name) {
          setUsername(user.user_metadata.full_name || user.user_metadata.name)
        }
      } catch {
        // En cas d'erreur de chargement
      } finally {
        setIsLoading(false)
      }
    }

    checkExistingProfile()
  }, [router, supabase])

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) return

    if (!selectedGender) {
      setErrorMessage('Veuillez sélectionner votre genre pour continuer.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    // Attribution d'un pseudo par défaut unique si non renseigné
    const defaultUserCode = currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()
    const finalFirstName = username.trim() || `User_${defaultUserCode}`

    try {
      const profileData: Database['public']['Tables']['profiles']['Insert'] = {
        id: currentUser.id,
        first_name: finalFirstName,
        gender: selectedGender,
        is_profile_completed: true,
        status: 'online',
        last_seen_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('profiles').upsert(profileData)

      if (error) {
        setErrorMessage(error.message || "Une erreur est survenue lors de l'enregistrement.")
        setIsSubmitting(false)
        return
      }

      // Redirection immédiate vers la galerie
      router.push('/discover')
      router.refresh()
    } catch {
      setErrorMessage("Impossible d'enregistrer votre profil. Veuillez réessayer.")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#E05A47] border-t-transparent animate-spin" />
          <p className="text-xs text-stone-400">Préparation de votre espace...</p>
        </div>
      </div>
    )
  }

  const defaultSuggestedName = currentUser
    ? `User_${currentUser.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
    : 'User_123456'

  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-center p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Halos lumineux d'ambiance */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full space-y-6">
        {/* En-tête */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-300 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#E05A47]" />
            <span>Étape unique • Accès immédiat</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Bienvenue sur Karea</h1>
          <p className="text-xs text-stone-400 max-w-xs mx-auto">
            Pour vous présenter la galerie adaptée, indiquez votre genre.
          </p>
        </div>

        {/* Message d'erreur éventuel */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-950/50 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleCompleteOnboarding} className="space-y-6">
          {/* Sélection du Genre (Obligatoire) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider">
              Votre genre <span className="text-[#E05A47]">*</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* Option Femme */}
              <button
                type="button"
                onClick={() => setSelectedGender('female')}
                className={`relative p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer flex flex-col items-center gap-3 ${
                  selectedGender === 'female'
                    ? 'bg-gradient-to-b from-rose-950/40 to-stone-900 border-rose-500 text-white shadow-lg shadow-rose-950/50 scale-[1.02]'
                    : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform ${
                    selectedGender === 'female'
                      ? 'bg-rose-500/20 scale-110'
                      : 'bg-stone-800'
                  }`}
                >
                  👩
                </div>
                <div>
                  <span className="block text-sm font-bold text-stone-100">Femme</span>
                  <span className="block text-[11px] text-stone-400 mt-0.5">
                    Découvrir les hommes
                  </span>
                </div>

                {selectedGender === 'female' && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Option Homme */}
              <button
                type="button"
                onClick={() => setSelectedGender('male')}
                className={`relative p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer flex flex-col items-center gap-3 ${
                  selectedGender === 'male'
                    ? 'bg-gradient-to-b from-blue-950/40 to-stone-900 border-blue-500 text-white shadow-lg shadow-blue-950/50 scale-[1.02]'
                    : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform ${
                    selectedGender === 'male'
                      ? 'bg-blue-500/20 scale-110'
                      : 'bg-stone-800'
                  }`}
                >
                  👨
                </div>
                <div>
                  <span className="block text-sm font-bold text-stone-100">Homme</span>
                  <span className="block text-[11px] text-stone-400 mt-0.5">
                    Découvrir les femmes
                  </span>
                </div>

                {selectedGender === 'male' && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </div>
                )}
              </button>
            </div>

            {/* Avertissement de verrouillage */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 flex items-start gap-2.5 text-[11px] text-amber-300/90">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Important :</strong> Ce choix est définitif et ne pourra plus être modifié après validation.
              </span>
            </div>
          </div>

          {/* Pseudo ou Prénom (Facultatif) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider">
                Prénom ou Pseudo
              </label>
              <span className="text-[11px] text-stone-500 font-medium">Optionnel</span>
            </div>

            <Input
              type="text"
              placeholder={`Ex : Alex (ou par défaut : ${defaultSuggestedName})`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User className="w-4 h-4 text-stone-400" />}
            />
            <p className="text-[11px] text-stone-500">
              Vous pourrez ajouter votre photo, ville et bio plus tard depuis votre profil.
            </p>
          </div>

          {/* Bouton de confirmation */}
          <Button
            type="submit"
            size="lg"
            className="w-full mt-4 flex items-center justify-center gap-2 group"
            disabled={!selectedGender || isSubmitting}
            isLoading={isSubmitting}
          >
            <span>Accéder à la galerie</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </form>
      </div>
    </main>
  )
}
