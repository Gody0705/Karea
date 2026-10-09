'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Sparkles,
  Volume2,
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
  session,
  partner,
  isCaller,
  token,
  appId,
  channelName,
  currentUserId,
  onEndCall,
}) => {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null)
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null)
  const [remoteUser, setRemoteUser] = useState<IAgoraRTCRemoteUser | null>(null)

  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [remoteHasVideo, setRemoteHasVideo] = useState(false)
  const [callStatusText, setCallStatusText] = useState<string>(
    isCaller ? 'Sonnerie chez votre correspondant...' : 'Connexion à la salle...'
  )
  const [callDuration, setCallDuration] = useState(0)
  const [isJoined, setIsJoined] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const localVideoRef = useRef<HTMLDivElement>(null)
  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isLeavingRef = useRef(false)

  // Durée de l'appel formatée (MM:SS)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Quitter et libérer proprement toutes les ressources Agora
  const leaveChannel = useCallback(async () => {
    if (isLeavingRef.current) return
    isLeavingRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      if (localAudioTrack) {
        localAudioTrack.stop()
        localAudioTrack.close()
      }
      if (localVideoTrack) {
        localVideoTrack.stop()
        localVideoTrack.close()
      }
      if (client) {
        await client.leave()
      }
    } catch (err) {
      console.error('Erreur fermeture Agora:', err)
    } finally {
      onEndCall()
    }
  }, [client, localAudioTrack, localVideoTrack, onEndCall])

  // 1. Initialisation du client Agora RTC
  useEffect(() => {
    let agoraClient: IAgoraRTCClient | null = null
    let audioTrack: IMicrophoneAudioTrack | null = null
    let videoTrack: ICameraVideoTrack | null = null
    let isCancelled = false

    async function initAgora() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default
        AgoraRTC.setLogLevel(2) // Warnings and errors only

        agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
        setClient(agoraClient)

        // Événement : l'utilisateur distant publie un flux (vidéo ou audio)
        agoraClient.on('user-published', async (user, mediaType) => {
          if (!agoraClient) return
          await agoraClient.subscribe(user, mediaType)
          setRemoteUser(user)

          if (mediaType === 'video') {
            setRemoteHasVideo(true)
            setCallStatusText('En direct')
            // Petit délai pour assurer que le conteneur DOM est monté
            setTimeout(() => {
              if (remoteVideoRef.current && user.videoTrack) {
                user.videoTrack.play(remoteVideoRef.current)
              }
            }, 100)
          }

          if (mediaType === 'audio') {
            user.audioTrack?.play()
          }
        })

        // Événement : l'utilisateur distant coupe son flux
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
            leaveChannel()
          }, 1500)
        })

        // Création des pistes locales Micro et Caméra
        try {
          const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            {
              encoderConfig: 'music_standard',
            },
            {
              encoderConfig: '720p_1',
              facingMode: 'user',
            }
          )
          audioTrack = micTrack
          videoTrack = camTrack

          if (isCancelled) {
            audioTrack.close()
            videoTrack.close()
            return
          }

          setLocalAudioTrack(audioTrack)
          setLocalVideoTrack(videoTrack)

          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current)
          }
        } catch (mediaError: any) {
          console.error('Erreur accès micro/caméra:', mediaError)
          setErrorMessage('Impossible d’accéder à la caméra ou au microphone.')
          return
        }

        // Rejoindre le canal Agora avec le token de sécurité
        await agoraClient.join(appId, channelName, token, currentUserId)
        if (isCancelled) return

        setIsJoined(true)

        // Publier nos pistes locales sur le canal
        await agoraClient.publish([audioTrack, videoTrack])

        setCallStatusText(
          isCaller ? 'En attente de votre correspondant...' : 'Connecté — En direct'
        )
      } catch (err: any) {
        console.error('Erreur initialisation Agora:', err)
        if (!isCancelled) {
          setErrorMessage(err?.message || 'Échec de connexion au serveur d’appel.')
        }
      }
    }

    initAgora()

    return () => {
      isCancelled = true
      if (audioTrack) {
        audioTrack.stop()
        audioTrack.close()
      }
      if (videoTrack) {
        videoTrack.stop()
        videoTrack.close()
      }
      if (agoraClient) {
        agoraClient.leave().catch(() => {})
      }
    }
  }, [appId, channelName, currentUserId, isCaller, token, leaveChannel])

  // 2. Chronomètre de l'appel dès qu'un flux distant ou la connexion est active
  useEffect(() => {
    if (remoteUser || (!isCaller && isJoined)) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [remoteUser, isCaller, isJoined])

  // 3. Bascule du microphone (Mute / Unmute)
  const toggleMic = async () => {
    if (!localAudioTrack) return
    const nextState = !isMicMuted
    await localAudioTrack.setEnabled(!nextState)
    setIsMicMuted(nextState)
  }

  // 4. Bascule de la caméra (Video On / Off)
  const toggleVideo = async () => {
    if (!localVideoTrack) return
    const nextState = !isVideoMuted
    await localVideoTrack.setEnabled(!nextState)
    setIsVideoMuted(nextState)
  }

  // 5. Gestion de la fermeture ou du changement d'onglet (raccrochage auto)
  useEffect(() => {
    const handleBeforeUnload = () => {
      leaveChannel()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [leaveChannel])

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
          onClick={leaveChannel}
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
