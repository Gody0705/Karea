'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GalleryProfileCard } from '@/components/gallery/GalleryProfileCard'
import { SignOutButton } from '@/components/auth/SignOutButton'
import {
  Sparkles,
  Users,
  AlertCircle,
  Video,
  Flame,
  Radio,
  Clock,
  Search,
  X,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

export default function DiscoverGalleryPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Tri intelligent : En ligne en premier, puis Occupé, puis Hors ligne, puis par dernière activité
  const sortProfiles = useCallback((list: Profile[]): Profile[] => {
    const statusWeight: Record<string, number> = {
      online: 1,
      busy: 2,
      in_call: 2,
      offline: 3,
    }

    return [...list].sort((a, b) => {
      const weightA = statusWeight[a.status] ?? 3
      const weightB = statusWeight[b.status] ?? 3

      if (weightA !== weightB) {
        return weightA - weightB
      }

      const timeA = new Date(a.last_seen_at || a.created_at || 0).getTime()
      const timeB = new Date(b.last_seen_at || b.created_at || 0).getTime()
      return timeB - timeA
    })
  }, [])

  // 1. Chargement de l'utilisateur et du profil
  useEffect(() => {
    let isMounted = true

    async function initSessionAndPresence() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!isMounted) return

        if (!user) {
          router.push('/login')
          return
        }

        setCurrentUser(user)

        // Récupérer le profil connecté
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle<Profile>()

        if (!isMounted) return

        // Si le genre n'a pas encore été choisi, redirection vers l'onboarding
        if (!profile?.gender) {
          router.push('/onboarding')
          return
        }

        setMyProfile(profile)

        // Définir le statut de l'utilisateur sur 'online' à l'ouverture de l'application
        await supabase
          .from('profiles')
          .update({
            status: 'online',
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        // Déterminer le genre opposé
        const oppositeGender = profile.gender === 'male' ? 'female' : 'male'

        // Charger les profils du genre opposé (hors profil personnel)
        const { data: oppositeProfiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('gender', oppositeGender)
          .neq('id', user.id)

        if (isMounted) {
          setProfiles(sortProfiles(oppositeProfiles || []))
          setIsLoading(false)
        }
      } catch {
        if (isMounted) setIsLoading(false)
      }
    }

    initSessionAndPresence()

    // 2. Gestionnaire de départ / fermeture de page (passage à 'offline')
    const handleVisibilityChange = () => {
      if (!currentUser) return
      const nextStatus = document.visibilityState === 'visible' ? 'online' : 'offline'
      supabase
        .from('profiles')
        .update({
          status: nextStatus,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, supabase, sortProfiles])

  // 3. Supabase Realtime : Écoute en direct des changements de statut sur profiles
  useEffect(() => {
    if (!myProfile || !currentUser) return

    const targetGender = myProfile.gender === 'male' ? 'female' : 'male'

    const channel = supabase
      .channel('karea_profiles_presence_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedProfile = payload.new as Profile

            // Ignorer si c'est mon propre profil
            if (updatedProfile.id === currentUser.id) return

            // Vérifier si le profil appartient bien au genre opposé
            if (updatedProfile.gender === targetGender) {
              setProfiles((prev) => {
                const exists = prev.some((p) => p.id === updatedProfile.id)
                const nextList = exists
                  ? prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
                  : [...prev, updatedProfile]
                return sortProfiles(nextList)
              })
            } else {
              // Si le profil n'est plus du genre ciblé, le retirer
              setProfiles((prev) => prev.filter((p) => p.id !== updatedProfile.id))
            }
          } else if (payload.eventType === 'INSERT') {
            const newProfile = payload.new as Profile
            if (newProfile.gender === targetGender && newProfile.id !== currentUser.id) {
              setProfiles((prev) =>
                sortProfiles([...prev.filter((p) => p.id !== newProfile.id), newProfile])
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string })?.id
            if (deletedId) {
              setProfiles((prev) => prev.filter((p) => p.id !== deletedId))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [myProfile, currentUser, supabase, sortProfiles])

  // Clic sur l'icône d'appel vidéo
  const handleCallClick = (profile: Profile) => {
    const name = profile.first_name || 'cet utilisateur'
    setToastMessage(`Bientôt disponible — Les appels vidéo en direct avec ${name} arrivent très bientôt !`)
    setTimeout(() => {
      setToastMessage(null)
    }, 4500)
  }

  // Filtrage par recherche
  const filteredProfiles = profiles.filter((p) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    const nameMatch = p.first_name?.toLowerCase().includes(query)
    const cityMatch = p.city?.toLowerCase().includes(query)
    const countryMatch = p.country?.toLowerCase().includes(query)
    return nameMatch || cityMatch || countryMatch
  })

  const onlineCount = profiles.filter((p) => p.status === 'online').length
  const oppositeGenderLabel = myProfile?.gender === 'female' ? 'Hommes' : 'Femmes'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 rounded-full border-2 border-[#E05A47] border-t-transparent animate-spin" />
        <p className="text-xs text-stone-400 font-medium tracking-wide">
          Chargement de la galerie en direct...
        </p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden pb-10">
      {/* Halos lumineux d'ambiance */}
      <div className="absolute top-0 -left-20 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Notification Toast Bientôt Disponible */}
      {toastMessage && (
        <div className="fixed top-5 inset-x-4 max-w-md mx-auto z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="p-3.5 rounded-2xl bg-stone-900/95 border border-[#E05A47]/50 text-white text-xs flex items-center justify-between shadow-2xl shadow-red-950/80 backdrop-blur-xl gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center shrink-0">
                <Video className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-medium text-stone-200">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-stone-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* En-tête de la Galerie */}
      <header className="sticky top-0 z-40 bg-[#0D0B0B]/85 backdrop-blur-md px-5 pt-4 pb-3 border-b border-stone-800/80 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center shadow shadow-red-950/40">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-stone-100 to-stone-400 bg-clip-text text-transparent">
                Karea
              </h1>
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Vous êtes en ligne ({myProfile?.first_name || 'Moi'})</span>
              </div>
            </div>
          </div>

          <SignOutButton />
        </div>

        {/* Barre de recherche et statistiques en temps réel */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Rechercher parmi les ${oppositeGenderLabel.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900/90 border border-stone-800 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#E05A47]/60 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shrink-0">
            <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
            <span>{onlineCount} en direct</span>
          </div>
        </div>
      </header>

      {/* Grille 2 colonnes de profils */}
      <div className="p-4 flex-1">
        {filteredProfiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredProfiles.map((profile) => (
              <GalleryProfileCard
                key={profile.id}
                profile={profile}
                onCallClick={handleCallClick}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-4 space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-stone-900 border border-stone-800 mx-auto flex items-center justify-center text-stone-400">
              <Users className="w-7 h-7 text-stone-500" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-200">
                {searchQuery
                  ? 'Aucun résultat correspondant'
                  : `Aucun profil de ${oppositeGenderLabel.toLowerCase()} pour l’instant`}
              </h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                {searchQuery
                  ? 'Essayez de rechercher avec un autre mot-clé ou une autre ville.'
                  : `Dès qu’un profil de type ${oppositeGenderLabel.toLowerCase()} s'inscrit, il apparaîtra automatiquement ici en temps réel.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
