'use client'

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  AlertTriangle,
  MapPin,
  ArrowLeftRight,
  Coins,
  Sparkles,
} from 'lucide-react'
import type { Profile, CallSession } from '@/types/database'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

interface VideoCallRoomProps {
  session: CallSession
  partner: Profile
  currentProfile: Profile
  isCaller: boolean
  token: string
  appId: string
  channelName: string
  currentUserId: string
  onEndCall: () => void
}

export const VideoCallRoom: React.FC<VideoCallRoomProps> = ({
  session,
  partner,
  currentProfile,
  isCaller,
  token,
  appId,
  channelName,
  currentUserId,
  onEndCall,
}) => {
  const supabase = useMemo(() => createClient(), [])

  // Références d'instances Agora
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null)
  const isJoinedRef = useRef(false)
  const isLeavingRef = useRef(false)
  const isCleaningUpRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const billingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isBillingTickRunningRef = useRef(false)

  // Éléments DOM pour l'affichage vidéo
  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)

  // États React pour l'interface utilisateur
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null)
  const [remoteHasVideo, setRemoteHasVideo] = useState(false)
  const [localTracksReady, setLocalTracksReady] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isSwapped, setIsSwapped] = useState(false) // Permet d'inverser vidéo principale / vignette PiP
  const [callStatusText, setCallStatusText] = useState<string>(
    isCaller ? 'Sonnerie chez votre correspondant...' : 'Connexion à la salle...'
  )
  const [callDuration, setCallDuration] = useState(0)
  const [isJoined, setIsJoined] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // --- Gestion de la facturation & soldes en temps réel ---
  // Qui est l'homme (celui qui paie) et qui est la femme (celle qui reçoit) ?
  const isMan = currentProfile.gender === 'male'
  const womanProfile = currentProfile.gender === 'female' ? currentProfile : partner
  const ratePerMinute = Number(session.price_per_minute || womanProfile?.price_per_minute || 25)
  const ratePerSecond = ratePerMinute / 60

  // Soldes dynamiques
  const [callerRemainingTokens, setCallerRemainingTokens] = useState<number | null>(
    currentProfile.gender === 'male' ? Number(currentProfile.token_balance ?? 0) : null
  )
  const [calleeEarnedTokens, setCalleeEarnedTokens] = useState<number>(
    currentProfile.gender === 'female' ? Number(currentProfile.earned_tokens ?? 0) : 0
  )
  const [showLowBalanceWarning, setShowLowBalanceWarning] = useState(false)
  const [isCallTerminatedByBalance, setIsCallTerminatedByBalance] = useState(false)

  // Formatage de la durée d'appel (MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Nettoyage complet des pistes et du client Agora
  const cleanupAgora = useCallback(async () => {
    if (isCleaningUpRef.current) return
    isCleaningUpRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (billingTimerRef.current) {
      clearInterval(billingTimerRef.current)
      billingTimerRef.current = null
    }

    try {
      if (audioTrackRef.current) {
        audioTrackRef.current.stop()
        audioTrackRef.current.close()
        audioTrackRef.current = null
      }

      if (videoTrackRef.current) {
        videoTrackRef.current.stop()
        videoTrackRef.current.close()
        videoTrackRef.current = null
      }

      const client = clientRef.current
      if (client) {
        client.removeAllListeners()
        if (
          client.connectionState === 'CONNECTED' ||
          client.connectionState === 'CONNECTING' ||
          client.connectionState === 'RECONNECTING'
        ) {
          await client.leave()
        }
        clientRef.current = null
      }
    } catch (err) {
      console.error('Erreur nettoyage Agora:', err)
    } finally {
      isJoinedRef.current = false
      isCleaningUpRef.current = false
    }
  }, [])

  // Raccrocher déclenché par l'utilisateur
  const handleHangup = useCallback(async () => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true

    await cleanupAgora()
    onEndCall()
  }, [cleanupAgora, onEndCall])

  // 1. Initialisation unique du client Agora RTC
  useEffect(() => {
    let isCancelled = false
    isLeavingRef.current = false
    isCleaningUpRef.current = false

    async function initAgora() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(2)

        if (isCancelled) return

        const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        clientRef.current = agoraClient

        agoraClient.on('user-published', async (user, mediaType) => {
          if (isCancelled || !clientRef.current) return
          await agoraClient.subscribe(user, mediaType)
          if (isCancelled) return

          setRemoteUser(user)

          if (mediaType === 'video') {
            setRemoteHasVideo(true)
            setCallStatusText('En direct')
          }

          if (mediaType === 'audio') {
            user.audioTrack?.play()
          }
        })

        agoraClient.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteHasVideo(false)
          }
        })

        agoraClient.on('user-left', () => {
          setRemoteUser(null)
          setRemoteHasVideo(false)
          setCallStatusText('Votre correspondant a raccroché.')
          setTimeout(() => {
            handleHangup()
          }, 1200)
        })

        // Création résiliente des pistes audio et vidéo
        let micTrack: IMicrophoneAudioTrack | null = null
        let camTrack: ICameraVideoTrack | null = null

        try {
          micTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'speech_standard' })
        } catch (micErr) {
          console.warn('Microphone non détecté ou accès refusé:', micErr)
        }

        try {
          camTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: '720p_1',
            facingMode: 'user',
          })
        } catch (camErr) {
          console.warn('Caméra non détectée ou accès refusé:', camErr)
        }

        if (isCancelled) {
          micTrack?.stop()
          micTrack?.close()
          camTrack?.stop()
          camTrack?.close()
          return
        }

        if (!micTrack && !camTrack) {
          if (!isCancelled) {
            setErrorMessage('Aucun microphone ou caméra disponible sur cet appareil.')
          }
          return
        }

        if (micTrack) audioTrackRef.current = micTrack
        if (camTrack) videoTrackRef.current = camTrack
        setLocalTracksReady(true)

        // Rejoindre le canal
        await agoraClient.join(appId, channelName, token, currentUserId)
        if (isCancelled) {
          await agoraClient.leave()
          return
        }

        isJoinedRef.current = true
        setIsJoined(true)

        // Publication des flux locaux disponibles
        const tracksToPublish = [micTrack, camTrack].filter(Boolean) as (IMicrophoneAudioTrack | ICameraVideoTrack)[]
        if (tracksToPublish.length > 0) {
          await agoraClient.publish(tracksToPublish)
        }

        if (!isCancelled) {
          setCallStatusText(
            isCaller ? 'Sonnerie chez votre correspondant...' : 'En direct'
          )
        }
      } catch (err: any) {
        console.error('Erreur initialisation Agora:', err)
        if (!isCancelled) {
          setErrorMessage(err?.message || 'Échec de la connexion à l’appel vidéo.')
        }
      }
    }

    initAgora()

    return () => {
      isCancelled = true
      cleanupAgora()
    }
  }, [appId, channelName, currentUserId, token, isCaller, cleanupAgora, handleHangup])

  // 2. Rendu de la vidéo locale
  useEffect(() => {
    if (localTracksReady && videoTrackRef.current && localVideoRef.current && !isVideoMuted) {
      videoTrackRef.current.play(localVideoRef.current)
    }
  }, [localTracksReady, isVideoMuted])

  // 3. Rendu de la vidéo distante
  useEffect(() => {
    if (remoteUser?.videoTrack && remoteHasVideo && remoteVideoRef.current) {
      remoteUser.videoTrack.play(remoteVideoRef.current)
    }
  }, [remoteUser, remoteHasVideo])

  // 4. Chronomètre de l'appel
  useEffect(() => {
    if (remoteUser || (!isCaller && isJoined)) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [remoteUser, isCaller, isJoined])

  // 4.b Chargement initial des soldes & écoute Realtime
  useEffect(() => {
    let isMounted = true

    async function loadBalances() {
      try {
        const callerId = session.caller_id
        const calleeId = session.receiver_id

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, token_balance, earned_tokens')
          .in('id', [callerId, calleeId])

        if (!isMounted || !profiles) return

        const callerProfile = profiles.find((p) => p.id === callerId)
        const calleeProfile = profiles.find((p) => p.id === calleeId)

        if (callerProfile) {
          setCallerRemainingTokens(Number(callerProfile.token_balance ?? 0))
        }
        if (calleeProfile) {
          setCalleeEarnedTokens(Number(calleeProfile.earned_tokens ?? 0))
        }
      } catch (err) {
        console.error('Erreur chargement soldes appel:', err)
      }
    }

    loadBalances()

    // Écoute realtime des profils pour répercuter les débits/crédits côté appelant et appelée
    const channel = supabase
      .channel(`call_billing_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.caller_id}`,
        },
        (payload: any) => {
          if (isMounted && payload.new) {
            setCallerRemainingTokens(Number(payload.new.token_balance ?? 0))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.receiver_id}`,
        },
        (payload: any) => {
          if (isMounted && payload.new) {
            setCalleeEarnedTokens(Number(payload.new.earned_tokens ?? 0))
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [session.id, session.caller_id, session.receiver_id, supabase])

  // 4.c Facturation périodique (toutes les 4 secondes) déclenchée par l'appelant (l'homme)
  const callDurationRef = useRef(0)
  useEffect(() => {
    callDurationRef.current = callDuration
  }, [callDuration])

  useEffect(() => {
    // Dès que les deux utilisateurs sont connectés (remoteUser présent) ou que l'appel est en direct
    if (!isCaller || !isJoined || !remoteUser) return

    billingTimerRef.current = setInterval(async () => {
      if (isBillingTickRunningRef.current || isLeavingRef.current) return
      isBillingTickRunningRef.current = true

      try {
        const currentElapsed = callDurationRef.current
        const { data, error } = await supabase.rpc('process_call_billing_tick', {
          p_session_id: session.id,
          p_elapsed_seconds: currentElapsed,
        })

        if (error) {
          console.warn('Erreur process_call_billing_tick:', error)
          return
        }

        if (data) {
          const remainingTokens = Number(data.man_balance ?? 0)
          const earnedTokens = Number(data.woman_earnings ?? 0)
          setCallerRemainingTokens(remainingTokens)
          setCalleeEarnedTokens(earnedTokens)

          // Prévenir l'homme environ 15 secondes avant que le solde soit épuisé
          const secondsLeft = ratePerSecond > 0 ? remainingTokens / ratePerSecond : 999
          if (secondsLeft <= 15 && remainingTokens > 0) {
            setShowLowBalanceWarning(true)
          } else {
            setShowLowBalanceWarning(false)
          }

          // Couper l'appel des DEUX côtés quand le solde atteint 0
          if (data.should_hangup || remainingTokens <= 0) {
            setIsCallTerminatedByBalance(true)
            setCallStatusText('Solde de tokens épuisé. Fin de l’appel.')
            if (billingTimerRef.current) {
              clearInterval(billingTimerRef.current)
              billingTimerRef.current = null
            }
            setTimeout(() => {
              handleHangup()
            }, 1200)
          }
        }
      } catch (err) {
        console.error('Erreur facturation tick appel:', err)
      } finally {
        isBillingTickRunningRef.current = false
      }
    }, 4000)

    return () => {
      if (billingTimerRef.current) {
        clearInterval(billingTimerRef.current)
        billingTimerRef.current = null
      }
    }
  }, [isCaller, isJoined, remoteUser, session.id, supabase, ratePerSecond, handleHangup])

  // 4.d Avertissement solde bas pour l'homme si non-appelant (si applicable)
  useEffect(() => {
    if (callerRemainingTokens !== null && isMan) {
      const secondsLeft = ratePerSecond > 0 ? callerRemainingTokens / ratePerSecond : 999
      if (secondsLeft <= 15 && callerRemainingTokens > 0) {
        setShowLowBalanceWarning(true)
      } else {
        setShowLowBalanceWarning(false)
      }
    }
  }, [callerRemainingTokens, isMan, ratePerSecond])

  // 5. Bascule du microphone
  const toggleMic = async () => {
    if (!audioTrackRef.current) return
    const nextState = !isMicMuted
    await audioTrackRef.current.setEnabled(!nextState)
    setIsMicMuted(nextState)
  }

  // 6. Bascule de la caméra
  const toggleVideo = async () => {
    if (!videoTrackRef.current) return
    const nextState = !isVideoMuted
    await videoTrackRef.current.setEnabled(!nextState)
    setIsVideoMuted(nextState)
  }

  // 7. Gestion de la fermeture ou du changement d'onglet
  useEffect(() => {
    const handleBeforeUnload = () => {
      handleHangup()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [handleHangup])

  const partnerDisplayName = partner.first_name || 'Correspondant'

  // Classes de disposition pour l'inversion des vidéos (Plein écran vs Vignette PiP)
  const fullScreenClasses = 'absolute inset-0 z-0 bg-stone-950 flex items-center justify-center transition-all duration-300'
  const pipClasses = 'absolute top-4 right-4 z-20 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden bg-stone-900 border-2 border-stone-700/80 shadow-2xl shadow-black/80 cursor-pointer group transition-all duration-300 hover:scale-105 active:scale-95'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      {/* 1. CONTENEUR VIDÉO DISTANTE (Correspondant) */}
      <div
        className={!isSwapped ? fullScreenClasses : pipClasses}
        onClick={isSwapped ? () => setIsSwapped(false) : undefined}
      >
        <div
          ref={remoteVideoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            remoteHasVideo ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback quand l'autre utilisateur n'a pas activé sa vidéo ou est en attente */}
        {!remoteHasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#1E1110] via-stone-950 to-black text-center">
            <div className="relative">
              <div
                className={`rounded-full border-2 border-[#E05A47]/40 overflow-hidden relative shadow-2xl shadow-red-950/80 mx-auto ${
                  !isSwapped ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-12 h-12'
                }`}
              >
                {partner.avatar_url ? (
                  <Image
                    src={partner.avatar_url}
                    alt={partnerDisplayName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center font-extrabold text-white text-xl">
                    {partnerDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {!isSwapped && (
                <div className="absolute -inset-2 rounded-full border border-[#E05A47] animate-ping opacity-30 pointer-events-none" />
              )}
            </div>

            {!isSwapped && (
              <>
                <h2 className="text-xl font-black text-white mt-5 drop-shadow">
                  {partnerDisplayName}
                </h2>
                {partner.city && (
                  <p className="text-xs text-stone-300 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#E05A47]" />
                    {partner.city}
                  </p>
                )}

                <div className="mt-4 px-4 py-1.5 rounded-full bg-stone-900/80 border border-stone-800 backdrop-blur-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-stone-200 font-medium">{callStatusText}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Badge d'identification si la vidéo distante est en vignette PiP */}
        {isSwapped && (
          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold text-white flex items-center gap-1">
            <span className="truncate max-w-[70px]">{partnerDisplayName}</span>
            <ArrowLeftRight className="w-2.5 h-2.5 opacity-60" />
          </div>
        )}
      </div>

      {/* 2. CONTENEUR VIDÉO LOCALE (Moi) */}
      <div
        className={isSwapped ? fullScreenClasses : pipClasses}
        onClick={!isSwapped ? () => setIsSwapped(true) : undefined}
      >
        <div
          ref={localVideoRef}
          className={`w-full h-full object-cover ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
        />

        {isVideoMuted && (
          <div className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center p-2 text-stone-400">
            <VideoOff className={`${isSwapped ? 'w-10 h-10' : 'w-5 h-5'} text-stone-500 mb-1`} />
            <span className={`${isSwapped ? 'text-xs' : 'text-[9px]'} font-medium text-center`}>
              Caméra éteinte
            </span>
          </div>
        )}

        {/* Badge d'identification */}
        <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold text-white flex items-center gap-1">
          <span>Moi {isMicMuted ? '🔇' : ''}</span>
          {!isSwapped && <ArrowLeftRight className="w-2.5 h-2.5 opacity-60" />}
        </div>
      </div>

      {/* 3. EN-TÊTE : DURÉE, SOLDES / GAINS EN TEMPS RÉEL, ET MESSAGES */}
      <header className="relative z-10 px-4 pt-4 flex flex-col gap-2.5 pointer-events-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Durée de l'appel */}
            <div className="px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider">
                {formatDuration(callDuration)}
              </span>
            </div>

            {/* Pour l'homme : Affichage de son solde restant qui diminue */}
            {isMan && callerRemainingTokens !== null && (
              <div className="px-3 py-1.5 rounded-2xl bg-stone-900/80 backdrop-blur-xl border border-amber-500/40 text-amber-300 flex items-center gap-1.5 shadow-lg">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-black font-mono">
                  {callerRemainingTokens.toFixed(1)}
                </span>
                <span className="text-[10px] text-amber-400/80 font-medium">tokens</span>
              </div>
            )}

            {/* Pour la femme : Affichage de ses gains qui augmentent en direct */}
            {!isMan && (
              <div className="px-3 py-1.5 rounded-2xl bg-emerald-950/80 backdrop-blur-xl border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-black font-mono">
                  +{calleeEarnedTokens.toFixed(1)}
                </span>
                <span className="text-[10px] text-emerald-400/80 font-medium">tokens gagnés</span>
              </div>
            )}
          </div>

          {/* Tarif de la femme affiché discrètement */}
          {ratePerMinute > 0 && (
            <div className="px-2.5 py-1 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-[10px] text-stone-300 font-semibold">
              {ratePerMinute} t/min
            </div>
          )}
        </div>

        {/* Bannière d'alerte : solde de tokens presque épuisé */}
        {showLowBalanceWarning && !isCallTerminatedByBalance && isMan && (
          <div className="self-center px-4 py-1.5 rounded-2xl bg-amber-500/90 border border-amber-300 text-stone-950 text-xs font-black flex items-center gap-2 shadow-2xl animate-bounce">
            <AlertTriangle className="w-4 h-4 text-stone-950 shrink-0" />
            <span>Tokens bientôt épuisés ! Rechargement conseillé.</span>
          </div>
        )}

        {/* Bannière de fin pour solde épuisé */}
        {isCallTerminatedByBalance && (
          <div className="self-center px-4 py-2 rounded-2xl bg-rose-600/95 border border-rose-300 text-white text-xs font-black flex items-center gap-2 shadow-2xl animate-pulse">
            <AlertTriangle className="w-4 h-4 text-white shrink-0" />
            <span>Tokens épuisés : Fin de l'appel...</span>
          </div>
        )}

        {errorMessage && (
          <div className="self-start px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </header>

      {/* 4. BARRE DE CONTRÔLE FLOTTANTE INFÉRIEURE */}
      <footer className="relative z-20 pb-8 px-6 pt-4 flex items-center justify-center gap-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        {/* Bouton Microphone */}
        <button
          type="button"
          onClick={toggleMic}
          className={`w-13 h-13 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 cursor-pointer active:scale-95 ${
            isMicMuted
              ? 'bg-rose-600 text-white shadow-rose-950/50'
              : 'bg-stone-800/90 text-white border border-stone-700 hover:bg-stone-700'
          }`}
          title={isMicMuted ? 'Activer le micro' : 'Couper le micro'}
          aria-label="Microphone"
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Bouton Raccrocher */}
        <button
          type="button"
          onClick={handleHangup}
          className="w-16 h-16 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-2xl shadow-red-950 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border-2 border-white/20"
          title="Raccrocher l'appel"
          aria-label="Raccrocher"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>

        {/* Bouton Caméra */}
        <button
          type="button"
          onClick={toggleVideo}
          className={`w-13 h-13 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 cursor-pointer active:scale-95 ${
            isVideoMuted
              ? 'bg-rose-600 text-white shadow-rose-950/50'
              : 'bg-stone-800/90 text-white border border-stone-700 hover:bg-stone-700'
          }`}
          title={isVideoMuted ? 'Activer la caméra' : 'Couper la caméra'}
          aria-label="Caméra vidéo"
        >
          {isVideoMuted ? (
            <VideoOff className="w-5 h-5" />
          ) : (
            <VideoIcon className="w-5 h-5" />
          )}
        </button>
      </footer>
    </div>
  )
}
