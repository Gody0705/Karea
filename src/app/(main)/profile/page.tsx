'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/navigation/BottomNav'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { getCountryFlag } from '@/lib/utils/country'
import {
  User,
  Coins,
  Wallet,
  Sparkles,
  MapPin,
  Lock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import type { Profile } from '@/types/database'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle<Profile>()

        if (!p?.gender) {
          router.push('/onboarding')
          return
        }

        if (isMounted) {
          setProfile(p)
          setIsLoading(false)
        }
      } catch {
        if (isMounted) setIsLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-[#E05A47] border-t-transparent animate-spin" />
        <p className="text-xs text-stone-400 font-medium">Chargement du profil...</p>
      </div>
    )
  }

  const displayName = profile?.first_name || 'Utilisateur'
  const isFemale = profile?.gender === 'female'
  const countryInfo = getCountryFlag(profile?.country || profile?.city || 'CI')
  const formattedId = profile?.id ? `ID-${profile.id.slice(0, 8).toUpperCase()}` : 'ID-000000'

  // Soldes réels en base Supabase (entiers stricts)
  const tokenBalance = Math.floor(Number(profile?.token_balance || 0))
  const femaleEarnedTokens = Math.floor(Number(profile?.earned_tokens || 0))
  // Conversion illustrative en FCFA (par exemple 1 token = 20 FCFA ou affichage tokens)
  const femaleEarningsFCFA = Math.round(femaleEarnedTokens * 20)

  return (
    <main className="min-h-screen w-full max-w-md mx-auto bg-[#0D0B0B] text-stone-100 flex flex-col relative pb-32 sm:pb-36">
      {/* Halos lumineux d'ambiance */}
      <div className="absolute top-0 -left-20 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-[#0D0B0B]/85 backdrop-blur-md px-5 pt-4 pb-3 border-b border-stone-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center shadow shadow-red-950/40">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-stone-100 to-stone-400 bg-clip-text text-transparent">
              Mon Profil
            </h1>
            <p className="text-[10px] text-stone-400 font-medium">
              Paramètres du compte et portefeuille
            </p>
          </div>
        </div>

        <SignOutButton />
      </header>

      {/* Contenu principal */}
      <div className="p-5 space-y-5 flex-1">
        {/* Carte d'identité principale */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-stone-900 to-[#141111] border border-stone-800 shadow-xl shadow-black/60 relative overflow-hidden space-y-4">
          <div className="flex items-center gap-4">
            {/* Photo de profil */}
            <div className="relative w-20 h-20 rounded-full border-2 border-[#E05A47]/60 overflow-hidden shrink-0 shadow-lg shadow-red-950/40">
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center text-2xl font-extrabold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Infos texte */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg font-extrabold text-white truncate drop-shadow">
                  {displayName}
                </h2>
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>

              <p className="text-xs font-mono text-stone-400">{formattedId}</p>

              {/* Pays avec drapeau */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-base leading-none">{countryInfo.flag}</span>
                <span className="text-xs text-stone-300 font-medium">
                  {profile?.city ? `${profile.city}, ` : ''}
                  {countryInfo.name}
                </span>
              </div>
            </div>
          </div>

          {/* Badge Genre verrouillé */}
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs">
            <span className="text-stone-400">Genre (verrouillé)</span>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-800/70 border border-stone-700/60 text-stone-300 font-semibold text-[11px]">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>{isFemale ? 'Femme' : 'Homme'}</span>
            </div>
          </div>
        </div>

        {/* Section Portefeuille / Tokens */}
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wider font-bold text-stone-400 px-1 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-[#E05A47]" />
            <span>Portefeuille & Soldes</span>
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {/* Solde de Tokens */}
            <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-stone-400 font-medium">Solde de Tokens</span>
                  <p className="text-lg font-black text-white">{tokenBalance} Tokens</p>
                </div>
              </div>

              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white text-xs font-bold shadow-md shadow-red-950 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Recharger
              </button>
            </div>

            {/* POUR UN COMPTE FEMME : VALEUR EN ARGENT DES GAINS */}
            {isFemale && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-stone-900 to-stone-900 border border-emerald-500/30 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Gains Vidéo Générés
                    </span>
                    <p className="text-xl font-black text-emerald-300">
                      {femaleEarnedTokens} <span className="text-sm font-semibold text-emerald-400">tokens</span>
                    </p>
                    <p className="text-[11px] text-emerald-300/80 font-medium">
                      ≈ {femaleEarningsFCFA.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/80 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>Retirer</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre de navigation du bas */}
      <BottomNav />
    </main>
  )
}
