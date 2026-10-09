'use client'

import React from 'react'
import { BottomNav } from '@/components/navigation/BottomNav'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { MessageCircle, Sparkles, Inbox, Search } from 'lucide-react'

export default function MessagesPage() {
  return (
    <main className="min-h-screen w-full max-w-md mx-auto bg-[#0D0B0B] text-stone-100 flex flex-col relative pb-32 sm:pb-36">
      {/* Halos lumineux d'ambiance */}
      <div className="absolute top-0 -right-20 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* En-tête */}
      <header className="sticky top-0 z-30 bg-[#0D0B0B]/85 backdrop-blur-md px-5 pt-4 pb-3 border-b border-stone-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] flex items-center justify-center shadow shadow-red-950/40">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-stone-100 to-stone-400 bg-clip-text text-transparent">
                Messages
              </h1>
              <p className="text-[10px] text-stone-400 font-medium">
                Discussions privées et correspondants
              </p>
            </div>
          </div>

          <SignOutButton />
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher une discussion..."
            className="w-full bg-stone-900/90 border border-stone-800 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#E05A47]/60 transition-all"
          />
        </div>
      </header>

      {/* Liste des conversations (État vide actuel) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-stone-900 border border-stone-800 mx-auto flex items-center justify-center text-stone-500 mb-4 shadow-inner">
          <Inbox className="w-8 h-8 text-stone-500" />
        </div>
        <h3 className="text-base font-bold text-stone-200">
          Aucune conversation pour l’instant
        </h3>
        <p className="text-xs text-stone-400 max-w-xs mt-1.5 leading-relaxed font-medium">
          Vos échanges de messages et les correspondants rencontrés dans la galerie ou le salon apparaîtront ici.
        </p>

        <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-[11px] text-[#E05A47] font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-[#E05A47]" />
          <span>Messagerie directe et sécurisée</span>
        </div>
      </div>

      {/* Barre de navigation du bas */}
      <BottomNav unreadMessagesCount={0} />
    </main>
  )
}
