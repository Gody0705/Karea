'use client'

import React from 'react'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { Sparkles, Video } from 'lucide-react'

export default function GalleryPlaceholderPage() {
  return (
    <main className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col justify-between p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center pt-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#E05A47] to-[#F59E0B] bg-clip-text text-transparent">
          Karea Galerie
        </h1>
        <SignOutButton />
      </div>

      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-[#E05A47] mx-auto flex items-center justify-center">
          <Video className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold">Galerie Vidéo Directe</h2>
        <p className="text-sm text-stone-400">
          Les profils du sexe opposé s'afficheront ici avec leur statut en temps réel (En ligne, Occupé, Hors ligne), le tarif par minute et le salon d'appel au hasard.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-xs text-stone-400 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Nouveau concept 2.0 intégré : Galerie en direct & Salon au hasard.</span>
      </div>
    </main>
  )
}
