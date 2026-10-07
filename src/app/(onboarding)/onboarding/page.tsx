'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { CheckCircle2, User, Sparkles } from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function OnboardingPlaceholderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setCurrentUser(user)
      setIsLoading(false)
    }

    loadUser()
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-white flex items-center justify-center">
        <p className="text-sm text-stone-400">Vérification de la session...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-stone-300">Session active</span>
        </div>
        <SignOutButton />
      </div>

      <div className="py-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] mx-auto flex items-center justify-center shadow-lg shadow-red-950/40">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold">Authentification réussie !</h1>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-stone-300 font-semibold">
            <User className="w-4 h-4 text-[#E05A47]" />
            <span>Utilisateur connecté</span>
          </div>
          <p className="text-stone-400 font-mono break-all">{currentUser?.email}</p>
          <p className="text-stone-500">ID: {currentUser?.id}</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2.5 text-left">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Étape 2 validée avec succès !</strong> La prochaine étape (Étape 3) transformera cet écran en formulaire complet de création de profil (Photo avec upload & compression, Prénom, Genre, Bio, Ville/Pays).
          </span>
        </div>
      </div>

      <div className="pb-4">
        <SignOutButton className="w-full justify-center py-3 bg-stone-900 rounded-2xl border border-stone-800" />
      </div>
    </main>
  )
}
