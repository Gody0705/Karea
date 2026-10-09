'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  AlertTriangle,
  MapPin,
} from 'lucide-react'
import type { Profile, CallSession } from '@/types/database'
import Image from 'next/image'

interface VideoCallRoomProps {
  session: CallSession
  partner: Profile
  isCaller: boolean
  token: string
  appId: string
  channelName: string
  currentUserId: string
  onEndCall: () => void
}

export const VideoCallRoom: React.FC<VideoCallRoomProps> = ({
  partner,
  isCaller,
  token,
  appId,
  channelName,
  currentUserId,
  onEndCall,
}) => {
  // Références d'instances Agora (stockées en useRef pour ne JAMAIS redéclencher les useEffect)
  const clientRef = useRef<IAgoraRTCClient | null>(null)
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null)
  const isJoinedRef = useRef(false)
  const isLeavingRef = useRef(false)
  const isCleaningUpRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Éléments DOM pour l'affichage vidéo
  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)

  // États React pour l'interface utilisateur
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null)
  const [remoteHasVideo, setRemoteHasVideo] = useState(false)
  const [localTracksReady, setLocalTracksReady] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [callStatusText, setCallStatusText] = useState<string>(
    isCaller ? 'Sonnerie chez votre correspondant...' : 'Connexion à la salle...'
  )
  const [callDuration, setCallDuration] = useState(0)
  const [isJoined, setIsJoined] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Formatage de la durée d'appel (MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Nettoyage complet des pistes et du client Agora (idempotent, sans dépendances d'état)
  const cleanupAgora = useCallback(async () => {
    if (isCleaningUpRef.current) return
    isCleaningUpRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
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

  // 1. Initialisation unique du client Agora RTC et connexion au canal
  useEffect(() => {
    let isCancelled = false
    isLeavingRef.current = false
    isCleaningUpRef.current = false

    async function initAgora() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(2) // Warnings & errors uniquement

        if (isCancelled) return

        // Création de l'unique client Agora pour cet appel
        const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        clientRef.current = agoraClient

        // Événement : l'utilisateur distant publie un flux vidéo ou audio
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

        // Événement : l'utilisateur distant coupe sa caméra ou son micro
        agoraClient.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteHasVideo(false)
          }
        })

        // Événement : l'utilisateur distant quitte l'appel
        agoraClient.on('user-left', () => {
          setRemoteUser(null)
          setRemoteHasVideo(false)
          setCallStatusText('Votre correspondant a raccroché.')
          setTimeout(() => {
            handleHangup()
          }, 1200)
        })

        // Création des pistes audio et vidéo locales
        try {
          const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: 'music_standard' },
            { encoderConfig: '720p_1', facingMode: 'user' }
          )

          if (isCancelled) {
            micTrack.stop()
            micTrack.close()
            camTrack.stop()
            camTrack.close()
            return
          }

          audioTrackRef.current = micTrack
          videoTrackRef.current = camTrack
          setLocalTracksReady(true)
        } catch (mediaError: any) {
          console.error('Erreur accès micro/caméra:', mediaError)
          if (!isCancelled) {
            setErrorMessage('Impossible d’accéder à la caméra ou au microphone.')
          }
          return
        }

        // Rejoindre le canal Agora sécurisé avec token
        await agoraClient.join(appId, channelName, token, currentUserId)
        if (isCancelled) {
          await agoraClient.leave()
          return
        }

        isJoinedRef.current = true
        setIsJoined(true)

        // Publication des flux locaux
        if (audioTrackRef.current && videoTrackRef.current) {
          await agoraClient.publish([audioTrackRef.current, videoTrackRef.current])
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

  // 2. Rendu de la vidéo locale dès qu'elle est prête
  useEffect(() => {
    if (localTracksReady && videoTrackRef.current && localVideoRef.current && !isVideoMuted) {
      videoTrackRef.current.play(localVideoRef.current)
    }
  }, [localTracksReady, isVideoMuted])

  // 3. Rendu de la vidéo distante dès qu'elle est reçue
  useEffect(() => {
    if (remoteUser?.videoTrack && remoteHasVideo && remoteVideoRef.current) {
      remoteUser.videoTrack.play(remoteVideoRef.current)
    }
  }, [remoteUser, remoteHasVideo])

  // 4. Chronomètre de l'appel dès qu'on est en communication
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

  // 5. Bascule du microphone (Mute / Unmute)
  const toggleMic = async () => {
    if (!audioTrackRef.current) return
    const nextState = !isMicMuted
    await audioTrackRef.current.setEnabled(!nextState)
    setIsMicMuted(nextState)
  }

  // 6. Bascule de la caméra (Video On / Off)
  const toggleVideo = async () => {
    if (!videoTrackRef.current) return
    const nextState = !isVideoMuted
    await videoTrackRef.current.setEnabled(!nextState)
    setIsVideoMuted(nextState)
  }

  // 7. Gestion de la fermeture ou du changement d'onglet (raccrochage auto)
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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden animate-in fade-in duration-300">
      {/* 1. ÉCRAN PRINCIPAL : VIDÉO DISTANTE EN GRAND */}
      <div className="absolute inset-0 z-0 bg-stone-950 flex items-center justify-center">
        {/* Conteneur DOM pour la vidéo Agora de l'autre personne */}
        <div
          ref={remoteVideoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            remoteHasVideo ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Fallback quand l'autre utilisateur n'a pas encore activé sa vidéo ou est en attente */}
        {!remoteHasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#1E1110] via-stone-950 to-black">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-2 border-[#E05A47]/40 overflow-hidden relative shadow-2xl shadow-red-950/80">
                {partner.avatar_url ? (
                  <Image
                    src={partner.avatar_url}
                    alt={partnerDisplayName}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center text-4xl font-extrabold text-white">
                    {partnerDisplayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Onde de pulsation */}
              <div className="absolute -inset-2 rounded-full border border-[#E05A47] animate-ping opacity-30 pointer-events-none" />
            </div>

            <h2 className="text-xl font-black text-white mt-6 drop-shadow">
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
          </div>
        )}
      </div>

      {/* 2. VIDÉO LOCALE EN PETIT (PIP - Coin supérieur droit) */}
      <div className="absolute top-4 right-4 z-20 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden bg-stone-900 border-2 border-stone-700/80 shadow-2xl shadow-black/80">
        <div
          ref={localVideoRef}
          className={`w-full h-full object-cover ${isVideoMuted ? 'opacity-0' : 'opacity-100'}`}
        />
        {isVideoMuted && (
          <div className="absolute inset-0 bg-stone-900 flex flex-col items-center justify-center p-2 text-stone-400">
            <VideoOff className="w-6 h-6 text-stone-500 mb-1" />
            <span className="text-[9px] font-medium text-center">Caméra éteinte</span>
          </div>
        )}
        <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold text-white">
          Moi {isMicMuted ? '🔇' : ''}
        </div>
      </div>

      {/* 3. EN-TÊTE : DURÉE ET INFORMATIONS */}
      <header className="relative z-10 px-5 pt-5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-white flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider">
              {formatDuration(callDuration)}
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
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
