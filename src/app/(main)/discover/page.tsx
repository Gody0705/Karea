'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GalleryProfileCard } from '@/components/gallery/GalleryProfileCard'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { VideoCallRoom } from '@/components/video/VideoCallRoom'
import { IncomingCallModal } from '@/components/video/IncomingCallModal'
import { BottomNav } from '@/components/navigation/BottomNav'
import { fetchAgoraToken } from '@/lib/agora/token'
import {
  Users,
  Video,
  Flame,
  Radio,
  Search,
  X,
  Loader2,
  Heart,
  Sparkles,
} from 'lucide-react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Profile, CallSession } from '@/types/database'

interface ActiveCallState {
  session: CallSession
  partner: Profile
  isCaller: boolean
  token: string
  appId: string
  channelName: string
}

interface IncomingCallState {
  session: CallSession
  caller: Profile
}

type GallerySubTab = 'popular' | 'following'

export default function DiscoverGalleryPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null)
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSubTab, setActiveSubTab] = useState<GallerySubTab>('popular')
  const [isLoading, setIsLoading] = useState(true)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Gestion des appels vidéo
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null)
  const [isCalling, setIsCalling] = useState(false)

  const activeCallRef = useRef<ActiveCallState | null>(null)
  activeCallRef.current = activeCall

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current))
    }, 4500)
  }, [])

  // Tri intelligent : En ligne et libre en premier, puis Occupé, puis Hors ligne
  const sortProfiles = useCallback((list: Profile[]): Profile[] => {
    const getWeight = (p: Profile) => {
      const isOccupied = p.in_call || p.status === 'busy' || p.status === 'in_call'
      if (p.status === 'online' && !isOccupied) return 1
      if (isOccupied) return 2
      return 3
    }

    return [...list].sort((a, b) => {
      const weightA = getWeight(a)
      const weightB = getWeight(b)

      if (weightA !== weightB) {
        return weightA - weightB
      }

      const timeA = new Date(a.last_seen_at || a.created_at || 0).getTime()
      const timeB = new Date(b.last_seen_at || b.created_at || 0).getTime()
      return timeB - timeA
    })
  }, [])

  // 1. Initialisation de la session et présence
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

        // Nettoyage des appels précédents éventuellement orphelins (crash, perte réseau)
        // et passage du profil à online
        try {
          await supabase.rpc('reset_my_call_state')
        } catch {
          // Fallback direct
        }

        await supabase
          .from('profiles')
          .update({
            status: 'online',
            in_call: false,
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

    // Gestionnaire de départ / fermeture de page (passage à 'offline')
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

  // 2. Supabase Realtime : Écoute en direct des statuts de présence sur profiles
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

            // Si c'est mon propre profil
            if (updatedProfile.id === currentUser.id) {
              setMyProfile(updatedProfile)
              return
            }

            // Si c'est un profil du genre opposé
            if (updatedProfile.gender === targetGender) {
              setProfiles((prev) => {
                const exists = prev.some((p) => p.id === updatedProfile.id)
                const nextList = exists
                  ? prev.map((p) => (p.id === updatedProfile.id ? updatedProfile : p))
                  : [...prev, updatedProfile]
                return sortProfiles(nextList)
              })
            } else {
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

  // 3. Supabase Realtime : Écoute des sessions d'appel (Appels entrants, fin d'appel)
  useEffect(() => {
    if (!currentUser) return

    const callChannel = supabase
      .channel(`karea_calls_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_sessions',
        },
        async (payload) => {
          const session = payload.new as CallSession

          if (!session) return

          // A. Réception d'un appel entrant sonnant pour moi
          if (
            session.receiver_id === currentUser.id &&
            session.status === 'ringing' &&
            !activeCallRef.current
          ) {
            // Récupérer les informations de l'appelant
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.caller_id)
              .maybeSingle<Profile>()

            if (callerProfile) {
              setIncomingCall({ session, caller: callerProfile })
            }
          }

          // B. L'appel entrant a été annulé ou manqué
          if (
            session.receiver_id === currentUser.id &&
            ['ended', 'rejected', 'missed', 'busy'].includes(session.status)
          ) {
            setIncomingCall((curr) => (curr?.session.id === session.id ? null : curr))
          }

          // C. Mon appel en cours a été terminé par l'autre participant
          if (
            activeCallRef.current &&
            activeCallRef.current.session.id === session.id &&
            ['ended', 'rejected', 'missed', 'busy'].includes(session.status)
          ) {
            showToast('L’appel est terminé.')
            setActiveCall(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(callChannel)
    }
  }, [currentUser, supabase, showToast])

  // 4. Lancer un appel vidéo vers un profil
  const handleCallClick = async (callee: Profile) => {
    if (!currentUser || !myProfile) return

    const calleeName = callee.first_name || 'cet utilisateur'

    // Vérifier si le profil est occupé ou hors ligne
    if (callee.in_call || callee.status === 'busy' || callee.status === 'in_call') {
      showToast(`${calleeName} est actuellement déjà en appel.`)
      return
    }

    if (callee.status !== 'online') {
      showToast(`${calleeName} n'est pas en ligne pour le moment.`)
      return
    }

    if (activeCall || isCalling) return

    setIsCalling(true)

    try {
      // 1. Appel de la fonction RPC pour créer la session d'appel et passer les statuts en in_call = true
      const { data: sessionData, error: sessionError } = await supabase.rpc(
        'start_direct_call',
        {
          p_callee_id: callee.id,
        }
      )

      if (sessionError || !sessionData) {
        throw new Error(sessionError?.message || 'Impossible d’initialiser l’appel.')
      }

      const createdSession = sessionData as CallSession
      const channelName = createdSession.channel_name || `karea_${createdSession.id}`

      // 2. Obtenir le token Agora RTC sécurisé depuis l'Edge Function agora-token
      const agoraData = await fetchAgoraToken(supabase, channelName)

      // 3. Ouvrir l'écran de visioconférence
      setActiveCall({
        session: createdSession,
        partner: callee,
        isCaller: true,
        token: agoraData.token,
        appId: agoraData.appId,
        channelName,
      })
    } catch (err: any) {
      console.error('Erreur appel:', err)
      showToast(err?.message || 'Échec de la connexion à l’appel vidéo.')
    } finally {
      setIsCalling(false)
    }
  }

  // 5. Accepter un appel entrant
  const handleAcceptIncomingCall = async () => {
    if (!incomingCall || !currentUser) return

    const session = incomingCall.session
    const caller = incomingCall.caller
    setIncomingCall(null)
    setIsCalling(true)

    try {
      // Confirmer l'acceptation via RPC
      const { data: sessionData, error: acceptError } = await supabase.rpc(
        'accept_direct_call',
        {
          p_session_id: session.id,
        }
      )

      if (acceptError || !sessionData) {
        throw new Error(acceptError?.message || 'Cet appel n’est plus disponible.')
      }

      const activeSession = sessionData as CallSession
      const channelName = activeSession.channel_name || `karea_${activeSession.id}`

      // Obtenir le token Agora RTC
      const agoraData = await fetchAgoraToken(supabase, channelName)

      setActiveCall({
        session: activeSession,
        partner: caller,
        isCaller: false,
        token: agoraData.token,
        appId: agoraData.appId,
        channelName,
      })
    } catch (err: any) {
      console.error('Erreur acceptation appel:', err)
      showToast(err?.message || 'Impossible de rejoindre l’appel.')
    } finally {
      setIsCalling(false)
    }
  }

  // 6. Refuser un appel entrant
  const handleRejectIncomingCall = async () => {
    if (!incomingCall) return
    const sessionId = incomingCall.session.id
    setIncomingCall(null)

    try {
      await supabase.rpc('end_direct_call', {
        p_session_id: sessionId,
        p_reason: 'rejected',
      })
    } catch (err) {
      console.error('Erreur rejet appel:', err)
    }
  }

  // 7. Terminer un appel en cours (raccrocher)
  const handleEndActiveCall = async () => {
    const currentActive = activeCallRef.current
    setActiveCall(null)

    if (currentActive) {
      try {
        await supabase.rpc('end_direct_call', {
          p_session_id: currentActive.session.id,
          p_reason: 'ended',
        })
      } catch (err) {
        console.error('Erreur fin d’appel:', err)
      }
    }
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

  const onlineCount = profiles.filter(
    (p) => p.status === 'online' && !p.in_call
  ).length
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
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden pb-20">
      {/* 1. ÉCRAN D'APPEL VIDÉO EN COURS (AGORA RTC - Plein écran) */}
      {activeCall && currentUser && (
        <VideoCallRoom
          session={activeCall.session}
          partner={activeCall.partner}
          isCaller={activeCall.isCaller}
          token={activeCall.token}
          appId={activeCall.appId}
          channelName={activeCall.channelName}
          currentUserId={currentUser.id}
          onEndCall={handleEndActiveCall}
        />
      )}

      {/* 2. MODAL D'APPEL ENTRANT */}
      {incomingCall && !activeCall && (
        <IncomingCallModal
          session={incomingCall.session}
          caller={incomingCall.caller}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}

      {/* Halos lumineux d'ambiance */}
      <div className="absolute top-0 -left-20 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Overlay de chargement pendant l'initialisation de l'appel */}
      {isCalling && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 text-[#E05A47] animate-spin" />
          <p className="text-xs font-semibold text-stone-200">
            Connexion au serveur vidéo en cours...
          </p>
        </div>
      )}

      {/* Notification Toast */}
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
              className="text-stone-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* En-tête de la Galerie */}
      <header className="sticky top-0 z-40 bg-[#0D0B0B]/85 backdrop-blur-md px-5 pt-4 pb-2 border-b border-stone-800/80 space-y-3">
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

        {/* Sous-onglets : Populaire / Suivre */}
        <div className="flex items-center gap-6 pt-1 border-b border-stone-800/50 pb-0.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('popular')}
            className={`text-sm font-extrabold pb-2 relative transition-all cursor-pointer ${
              activeSubTab === 'popular'
                ? 'text-white'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <span>Populaire</span>
            {activeSubTab === 'popular' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#E05A47] to-[#F59E0B] rounded-full shadow-sm shadow-red-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('following')}
            className={`text-sm font-extrabold pb-2 relative transition-all cursor-pointer ${
              activeSubTab === 'following'
                ? 'text-white'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            <span>Suivre</span>
            {activeSubTab === 'following' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#E05A47] to-[#F59E0B] rounded-full shadow-sm shadow-red-500" />
            )}
          </button>
        </div>

        {/* Barre de recherche et statistiques en temps réel (Visible sur Populaire) */}
        {activeSubTab === 'popular' && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 shrink-0">
              <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
              <span>{onlineCount} disponibles</span>
            </div>
          </div>
        )}
      </header>

      {/* Contenu principal */}
      <div className="p-4 flex-1">
        {/* SOUS-ONGLET 1 : POPULAIRE (Grille de profils) */}
        {activeSubTab === 'popular' && (
          <>
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
          </>
        )}

        {/* SOUS-ONGLET 2 : SUIVRE (Abonnements / Favoris mutuels - État vide) */}
        {activeSubTab === 'following' && (
          <div className="text-center py-24 px-6 space-y-4 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 shadow-inner">
              <Heart className="w-8 h-8 text-stone-500" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-base font-bold text-stone-200">
                Aucun profil suivi pour l’instant
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed font-medium">
                Les profils que vous suivez ou avec lesquels vous échangez régulièrement apparaîtront dans cette liste dédiée.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('popular')}
                className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-[#E05A47] font-bold hover:border-[#E05A47]/40 transition-all cursor-pointer"
              >
                Explorer la galerie populaire
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barre de navigation du bas (masquée pendant un appel vidéo) */}
      {!activeCall && <BottomNav />}
    </main>
  )
}
