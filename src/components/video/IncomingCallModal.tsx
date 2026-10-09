'use client'

import React from 'react'
import Image from 'next/image'
import { Phone, PhoneOff, Video, Sparkles, MapPin } from 'lucide-react'
import type { Profile, CallSession } from '@/types/database'

interface IncomingCallModalProps {
  session: CallSession
  caller: Profile
  onAccept: () => void
  onReject: () => void
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  onAccept,
  onReject,
}) => {
  const callerName = caller.first_name || 'Utilisateur'

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-stone-900 to-[#141010] border border-stone-800 p-6 flex flex-col items-center text-center shadow-2xl shadow-red-950/80 space-y-6">
        {/* Avatar avec pulsations animées */}
        <div className="relative mt-2">
          <div className="w-24 h-24 rounded-full border-2 border-[#E05A47]/60 overflow-hidden relative shadow-xl shadow-red-950/50">
            {caller.avatar_url ? (
              <Image
                src={caller.avatar_url}
                alt={callerName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center text-3xl font-extrabold text-white">
                {callerName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute -inset-2.5 rounded-full border border-[#E05A47] animate-ping opacity-40 pointer-events-none" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 border-2 border-stone-900 flex items-center justify-center shadow">
            <Video className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Détails de l'appelant */}
        <div className="space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider text-[#E05A47] font-bold">
            Appel vidéo entrant
          </span>
          <h2 className="text-xl font-extrabold text-white">{callerName}</h2>
          {caller.city && (
            <p className="text-xs text-stone-400 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#E05A47]" />
              {caller.city}
            </p>
          )}
        </div>

        {/* Boutons d'action (Refuser / Accepter) */}
        <div className="w-full flex items-center justify-center gap-8 pt-2">
          {/* Refuser */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-rose-600/20 border border-rose-500/40 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
              title="Refuser"
              aria-label="Refuser l'appel"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-stone-400 font-medium">Refuser</span>
          </div>

          {/* Accepter */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xl shadow-emerald-950/60 hover:scale-110 active:scale-95 animate-bounce"
              title="Accepter"
              aria-label="Accepter l'appel"
            >
              <Phone className="w-7 h-7" />
            </button>
            <span className="text-[11px] text-emerald-400 font-bold">Décrocher</span>
          </div>
        </div>
      </div>
    </div>
  )
}
