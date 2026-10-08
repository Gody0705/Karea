'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Sparkles, Video, User, Users, Flame } from 'lucide-react'

export default function GalleryPlaceholderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<{ first_name: string; gender: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, gender')
        .eq('id', user.id)
        .maybeSingle<{ first_name: string; gender: string | null }>()

      // Si le genre n'a pas encore été choisi, redirection immédiate vers l'onboarding
      if (!userProfile?.gender) {
        router.push('/onboarding')
        return
      }

      setProfile({
        first_name: userProfile.first_name,
        gender: userProfile.gender,
      })
      setIsLoading(false)
    }

    loadProfile()
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#E05A47] border-t-transparent animate-spin" />
      </div>
    )
  }

  const oppositeGenderLabel = profile?.gender === 'female' ? 'Hommes' : 'Femmes'

  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between p-6 max-w-md mx-auto">
      {/* En-tête */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#E05A47] to-[#F59E0B] bg-clip-text text-transparent">
            Karea
          </h1>
          <p className="text-[11px] text-stone-400">
            Connecté en tant que <span className="font-semibold text-stone-200">{profile?.first_name}</span> (
            {profile?.gender === 'female' ? 'Femme' : 'Homme'})
          </p>
        </div>
        <SignOutButton />
      </div>

      {/* Contenu principal */}
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white mx-auto flex items-center justify-center shadow-lg shadow-red-950/40">
          <Video className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight">Galerie Vidéo Directe</h2>
          <p className="text-xs text-stone-400 max-w-xs mx-auto leading-relaxed">
            Vous avez choisi le genre <strong>{profile?.gender === 'female' ? 'Femme' : 'Homme'}</strong>. La galerie affichera les profils du sexe opposé ({oppositeGenderLabel}) avec statut en temps réel (En ligne, En appel, Hors ligne).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 text-left space-y-1">
            <div className="flex items-center gap-2 text-stone-300 font-semibold text-xs">
              <Users className="w-4 h-4 text-[#E05A47]" />
              <span>Galerie {oppositeGenderLabel}</span>
            </div>
            <p className="text-[11px] text-stone-500">Appels vidéo directs 1-to-1</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 text-left space-y-1">
            <div className="flex items-center gap-2 text-stone-300 font-semibold text-xs">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Salon Aléatoire</span>
            </div>
            <p className="text-[11px] text-stone-500">Rencontres instantanées</p>
          </div>
        </div>
      </div>

      {/* Pied de page info */}
      <div className="p-3.5 rounded-2xl bg-stone-900/90 border border-stone-800 text-xs text-stone-400 flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Étape 3 Onboarding Profil complétée avec succès !</span>
      </div>
    </main>
  )
}
