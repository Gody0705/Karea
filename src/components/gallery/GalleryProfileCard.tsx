'use client'

import React from 'react'
import Image from 'next/image'
import { Video, Sparkles, MapPin, Heart, MessageCircle } from 'lucide-react'
import type { Profile } from '@/types/database'

interface GalleryProfileCardProps {
  profile: Profile
  isFollowed?: boolean
  canCall?: boolean
  onCallClick: (profile: Profile) => void
  onMessageClick?: (profile: Profile) => void
  onProfileClick?: (profile: Profile) => void
  onToggleFollow?: (profile: Profile) => void
}

export const GalleryProfileCard: React.FC<GalleryProfileCardProps> = ({
  profile,
  isFollowed = false,
  canCall = true,
  onCallClick,
  onMessageClick,
  onProfileClick,
  onToggleFollow,
}) => {
  const isOccupied = profile.in_call || profile.status === 'busy' || profile.status === 'in_call'
  const isOnline = profile.status === 'online' && !isOccupied

  const getStatusBadge = () => {
    if (isOccupied) {
      return {
        dotColor: 'bg-rose-400',
        bgColor: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
        label: 'Occupé',
        animate: false,
      }
    }
    if (isOnline) {
      return {
        dotColor: 'bg-emerald-400',
        bgColor: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
        label: 'En ligne',
        animate: true,
      }
    }
    return {
      dotColor: 'bg-stone-400',
      bgColor: 'bg-stone-900/80 border-stone-700/50 text-stone-300',
      label: 'Hors ligne',
      animate: false,
    }
  }

  const badge = getStatusBadge()
  const displayName = profile.first_name || 'Utilisateur'
  const locationText = profile.city || profile.country || null
  return (
    <div
      onClick={() => onProfileClick?.(profile)}
      className="group relative rounded-3xl overflow-hidden bg-stone-900 border border-stone-800/80 aspect-[3/4.2] flex flex-col justify-between shadow-lg shadow-black/40 transition-all duration-300 hover:border-stone-700 hover:shadow-red-950/20 cursor-pointer"
    >
      {/* Image de fond ou fallback élégant */}
      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt={displayName}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 240px"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-stone-800 via-stone-900 to-[#120F0F] flex flex-col items-center justify-center p-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#E05A47]/30 to-[#F59E0B]/30 border border-stone-700 flex items-center justify-center text-2xl font-bold text-stone-200">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-[11px] text-stone-400 mt-2 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Profil vérifié
          </span>
        </div>
      )}

      {/* Dégradés sombres pour lisibilité supérieure et inférieure */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

      {/* En-tête de carte : Badge de statut à gauche + Bouton Suivre à droite */}
      <div className="relative z-10 p-2.5 flex justify-between items-center">
        {/* Badge de statut */}
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-md text-[9px] font-bold tracking-wide ${badge.bgColor}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${badge.dotColor} ${
              badge.animate ? 'animate-pulse' : ''
            }`}
          />
          <span>{badge.label}</span>
        </div>

        {/* Bouton Suivre (Cœur / +) */}
        {onToggleFollow && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFollow(profile)
            }}
            className={`px-2 py-1 rounded-full border backdrop-blur-md text-[10px] font-bold flex items-center gap-1 transition-all duration-200 cursor-pointer shadow-md active:scale-95 ${
              isFollowed
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                : 'bg-black/50 border-white/20 text-white hover:bg-white/20'
            }`}
            title={isFollowed ? 'Ne plus suivre' : 'Suivre ce profil'}
            aria-label={isFollowed ? 'Ne plus suivre' : 'Suivre'}
          >
            <Heart
              className={`w-3 h-3 transition-colors ${
                isFollowed ? 'text-rose-400 fill-rose-400' : 'text-white'
              }`}
            />
            <span>{isFollowed ? 'Suivi' : 'Suivre'}</span>
          </button>
        )}
      </div>

      {/* Informations et boutons d'action en bas */}
      <div className="relative z-10 p-3 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-white truncate drop-shadow">
            {displayName}
          </h3>
          {locationText && (
            <p className="text-[11px] text-stone-300 flex items-center gap-1 mt-0.5 truncate font-medium drop-shadow">
              <MapPin className="w-3 h-3 text-[#E05A47] shrink-0" />
              <span className="truncate">{locationText}</span>
            </p>
          )}
          {profile.gender === 'female' && (
            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-extrabold backdrop-blur-md shadow-sm">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              <span>{profile.price_per_minute ?? 25} tokens/min</span>
            </div>
          )}
        </div>

        {/* Boutons d'action (Message + Appel Vidéo) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton Message : disponible sur chaque carte de profil */}
          {onMessageClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMessageClick(profile)
              }}
              className="w-9 h-9 rounded-full bg-black/60 border border-white/25 text-white flex items-center justify-center shadow-lg backdrop-blur-md hover:bg-black/80 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
              title={`Discuter avec ${displayName}`}
              aria-label={`Envoyer un message à ${displayName}`}
            >
              <MessageCircle className="w-4 h-4 text-white" />
            </button>
          )}

          {/* Bouton rond appel vidéo — UNIQUEMENT pour les comptes hommes (canCall = true) */}
          {canCall && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onCallClick(profile)
              }}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white flex items-center justify-center shadow-lg shadow-red-950/60 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer shrink-0 border border-white/20"
              title="Lancer un appel vidéo"
              aria-label={`Appeler ${displayName}`}
            >
              <Video className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
