'use client'

import React from 'react'
import Image from 'next/image'
import {
  X,
  MapPin,
  Heart,
  MessageCircle,
  Video,
  ShieldCheck,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { getCountryFlag } from '@/lib/utils/country'
import type { Profile } from '@/types/database'

interface ProfileDetailModalProps {
  profile: Profile | null
  isOpen: boolean
  isFollowed?: boolean
  canCall?: boolean
  onClose: () => void
  onMessageClick: (profile: Profile) => void
  onCallClick: (profile: Profile) => void
  onToggleFollow?: (profile: Profile) => void
}

export const ProfileDetailModal: React.FC<ProfileDetailModalProps> = ({
  profile,
  isOpen,
  isFollowed = false,
  canCall = false,
  onClose,
  onMessageClick,
  onCallClick,
  onToggleFollow,
}) => {
  if (!isOpen || !profile) return null

  const displayName = profile.first_name || 'Utilisateur'
  const isOccupied = profile.in_call || profile.status === 'busy' || profile.status === 'in_call'
  const isOnline = profile.status === 'online' && !isOccupied
  const countryInfo = getCountryFlag(profile.country || profile.city || 'CI')

  const formattedId = profile.id ? `ID-${profile.id.slice(0, 8).toUpperCase()}` : ''

  // Calcul approximatif de l'âge si birthdate disponible
  let age: number | null = null
  if (profile.birthdate) {
    try {
      const birth = new Date(profile.birthdate)
      const diff = Date.now() - birth.getTime()
      age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    } catch {
      // Ignorer
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#141111] border border-stone-800 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête photo en grand */}
        <div className="relative aspect-[4/4.5] w-full bg-stone-900 shrink-0">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 448px"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-stone-800 to-stone-900 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#E05A47]/30 to-[#F59E0B]/30 border border-stone-700 flex items-center justify-center text-4xl font-extrabold text-stone-200">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-stone-400 mt-3 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Profil Karea vérifié
              </span>
            </div>
          )}

          {/* Dégradés d'ombrage */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#141111] via-[#141111]/70 to-transparent pointer-events-none" />

          {/* Bouton Fermer */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center backdrop-blur-md hover:bg-black/80 transition-all cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Bouton Suivre en haut à droite */}
          {onToggleFollow && (
            <button
              type="button"
              onClick={() => onToggleFollow(profile)}
              className={`absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full border backdrop-blur-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 ${
                isFollowed
                  ? 'bg-rose-500/25 border-rose-500/60 text-rose-300'
                  : 'bg-black/60 border-white/25 text-white hover:bg-white/20'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  isFollowed ? 'text-rose-400 fill-rose-400' : 'text-white'
                }`}
              />
              <span>{isFollowed ? 'Suivi' : 'Suivre'}</span>
            </button>
          )}

          {/* Badges et Nom superposés en bas de l'image */}
          <div className="absolute bottom-4 left-5 right-5 z-10 space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold backdrop-blur-md ${
                  isOccupied
                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                    : isOnline
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-stone-900/80 border-stone-700/50 text-stone-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOccupied
                      ? 'bg-rose-400'
                      : isOnline
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-stone-400'
                  }`}
                />
                <span>{isOccupied ? 'Occupé' : isOnline ? 'En ligne' : 'Hors ligne'}</span>
              </span>

              {formattedId && (
                <span className="text-[10px] text-stone-400 font-mono bg-black/50 px-2 py-0.5 rounded-full border border-white/10">
                  {formattedId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-white drop-shadow truncate">
                {displayName}
              </h2>
              {age && (
                <span className="text-xl font-bold text-stone-300">
                  {age} ans
                </span>
              )}
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            {profile.gender === 'female' && (
              <div className="pt-1 flex items-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black backdrop-blur-md shadow-lg shadow-amber-950/40">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Tarif appel : {profile.price_per_minute ?? 25} tokens / min
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Détails du profil */}
        <div className="p-5 space-y-5">
          {/* Localisation & Pays */}
          <div className="flex items-center gap-2 text-xs text-stone-300 bg-stone-900/70 p-3 rounded-2xl border border-stone-800">
            <span className="text-lg leading-none">{countryInfo.flag}</span>
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {profile.city ? `${profile.city}, ` : ''}
                {countryInfo.name}
              </p>
              <p className="text-[10px] text-stone-400">
                Afrique francophone & internationale
              </p>
            </div>
          </div>

          {/* Courte bio si présente */}
          {profile.bio && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                À propos
              </h4>
              <p className="text-xs text-stone-200 leading-relaxed bg-stone-900/50 p-3.5 rounded-2xl border border-stone-800/80">
                {profile.bio}
              </p>
            </div>
          )}

          {/* Barre d'action principale : Message + Appel Vidéo */}
          <div className="pt-2 flex items-center gap-3">
            {/* Bouton Message : disponible pour tous les utilisateurs */}
            <button
              type="button"
              onClick={() => {
                onClose()
                onMessageClick(profile)
              }}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-700 hover:to-stone-800 text-white border border-stone-700 text-xs font-bold flex items-center justify-center gap-2 shadow-lg hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-[#E05A47]" />
              <span>Envoyer un message</span>
            </button>

            {/* Bouton Appel Vidéo : uniquement pour les hommes */}
            {canCall && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onCallClick(profile)
                }}
                className="py-3 px-5 rounded-2xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20 shrink-0"
                title="Lancer un appel vidéo"
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Appeler</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
