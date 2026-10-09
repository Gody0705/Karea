'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Lock, Check, CheckCheck } from 'lucide-react'
import { formatConversationDate } from '@/lib/utils/date'
import type { ConversationListItem } from '@/types/messaging'

interface ConversationRowProps {
  conversation: ConversationListItem
  currentUserId: string
  isMan: boolean
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
  conversation,
  currentUserId,
  isMan,
}) => {
  const { partner, lastMessage, unreadCount, is_unlocked_by_man } = conversation
  const displayName = partner.first_name || 'Utilisateur'
  const isOccupied = partner.in_call || partner.status === 'busy' || partner.status === 'in_call'
  const isOnline = partner.status === 'online' && !isOccupied

  const isLastMessageFromMe = lastMessage?.sender_id === currentUserId
  const formattedDate = formatConversationDate(lastMessage?.created_at || conversation.updated_at)
  const isLockedForMe = isMan && !is_unlocked_by_man

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-stone-900/60 hover:bg-stone-900 border border-stone-800/80 hover:border-stone-700/80 transition-all duration-200 group cursor-pointer active:scale-[0.99]"
    >
      {/* Avatar avec badge de statut */}
      <div className="relative w-13 h-13 rounded-full shrink-0">
        <div className="w-full h-full rounded-full overflow-hidden border border-stone-700/80 bg-stone-800">
          {partner.avatar_url ? (
            <Image
              src={partner.avatar_url}
              alt={displayName}
              width={52}
              height={52}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[#E05A47]/40 to-[#F59E0B]/40 flex items-center justify-center text-lg font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Indicateur de statut en ligne / hors ligne */}
        <span
          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0D0B0B] ${
            isOccupied
              ? 'bg-rose-500'
              : isOnline
              ? 'bg-emerald-400 animate-pulse'
              : 'bg-stone-500'
          }`}
          title={isOccupied ? 'Occupé' : isOnline ? 'En ligne' : 'Hors ligne'}
        />
      </div>

      {/* Détails de la conversation */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-stone-100 truncate group-hover:text-white flex items-center gap-1.5">
            <span className="truncate">{displayName}</span>
            {isLockedForMe && (
              <span title="Discussion verrouillée" className="inline-flex items-center">
                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              </span>
            )}
          </h3>

          <span className="text-[11px] text-stone-500 shrink-0 font-medium">
            {formattedDate}
          </span>
        </div>

        {/* Aperçu du dernier message */}
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-xs truncate font-medium flex items-center gap-1 ${
              unreadCount > 0
                ? 'text-white font-semibold'
                : 'text-stone-400'
            }`}
          >
            {isLastMessageFromMe && (
              <span className="text-stone-500 shrink-0 inline-flex items-center">
                {lastMessage?.is_read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-[#E05A47]" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-stone-500" />
                )}
                <span className="ml-0.5">Vous :</span>
              </span>
            )}
            <span className="truncate">
              {lastMessage ? lastMessage.content : 'Nouvelle conversation'}
            </span>
          </p>

          {/* Badge rouge de non-lus */}
          {unreadCount > 0 && (
            <span className="min-w-[19px] h-[19px] px-1.5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0 shadow-sm shadow-red-950 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
