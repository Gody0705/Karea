'use client'

import React, { useState } from 'react'
import { BottomNav } from '@/components/navigation/BottomNav'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Globe, Sparkles, Flame, Radio, Zap } from 'lucide-react'

export default function RandomCallPage() {
  const [isSearching, setIsSearching] = useState(false)

  const handleStart = () => {
    setIsSearching((prev) => !prev)
  }

  return (
    <main className="h-dvh h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden pb-16">
      {/* Halos lumineux d'ambiance */}
      <div className="absolute top-1/4 -left-24 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-[#0D0B0B]/85 backdrop-blur-md px-5 pt-4 pb-3 border-b border-stone-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center shadow shadow-red-950/40">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-stone-100 to-stone-400 bg-clip-text text-transparent">
              Salon Hasard
            </h1>
            <p className="text-[10px] text-stone-400 font-medium">
              Rencontres vidéo directes et instantanées
            </p>
          </div>
        </div>

        <SignOutButton />
      </header>

      {/* Contenu central */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center my-auto py-10">
        {/* Radar / Effet orbital */}
        <div className="relative mb-10 flex items-center justify-center">
          {/* Cercles de pulsation */}
          <div
            className={`absolute w-72 h-72 rounded-full border border-[#E05A47]/20 ${
              isSearching ? 'animate-ping duration-1000' : ''
            }`}
          />
          <div
            className={`absolute w-56 h-56 rounded-full border border-amber-500/25 ${
              isSearching ? 'animate-pulse' : ''
            }`}
          />
          <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-red-600/10 to-amber-500/10 blur-xl pointer-events-none" />

          {/* Gros Bouton Central Commencer */}
          <button
            type="button"
            onClick={handleStart}
            className={`relative z-10 w-36 h-36 rounded-full bg-gradient-to-tr from-[#E05A47] via-[#EA580C] to-[#F59E0B] text-white flex flex-col items-center justify-center shadow-2xl shadow-red-950/80 transition-all duration-300 active:scale-95 cursor-pointer border-4 border-white/20 group hover:scale-105 ${
              isSearching ? 'ring-8 ring-[#E05A47]/30' : ''
            }`}
          >
            {isSearching ? (
              <>
                <Radio className="w-9 h-9 animate-spin text-white mb-1.5" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Recherche...
                </span>
              </>
            ) : (
              <>
                <Zap className="w-9 h-9 text-white mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-black uppercase tracking-wider">
                  Commencer
                </span>
              </>
            )}
          </button>
        </div>

        {/* Textes explicatifs */}
        <div className="space-y-2 max-w-xs">
          <h2 className="text-lg font-bold text-white tracking-tight">
            {isSearching
              ? 'Recherche d’un profil en direct...'
              : 'Cliquez pour commencer la recherche'}
          </h2>
          <p className="text-xs text-stone-400 leading-relaxed font-medium">
            {isSearching
              ? 'Connexion avec une personne du genre opposé disponible immédiatement.'
              : 'Rencontrez instantanément des profils connectés en direct, sans attente.'}
          </p>
        </div>

        {/* Badge d'ambiance */}
        <div className="mt-8 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900/90 border border-stone-800 text-[11px] text-stone-300 font-semibold shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Filtre automatique par genre opposé</span>
        </div>
      </div>

      {/* Barre de navigation du bas */}
      <BottomNav />
    </main>
  )
}
