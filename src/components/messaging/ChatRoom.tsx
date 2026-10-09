'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMessageTime } from '@/lib/utils/date'
import {
  ArrowLeft,
  Send,
  Lock,
  Unlock,
  Check,
  CheckCheck,
  Video,
  Sparkles,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import type { Profile, Conversation, Message } from '@/types/database'

interface ChatRoomProps {
  conversation: Conversation
  currentUserId: string
  currentUserGender: 'male' | 'female'
  partner: Profile
  initialMessages: Message[]
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  conversation: initialConv,
  currentUserId,
  currentUserGender,
  partner,
  initialMessages,
}) => {
  const router = useRouter()
  const supabase = createClient()

  const [conversation, setConversation] = useState<Conversation>(initialConv)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const displayName = partner.first_name || 'Utilisateur'
  const isOccupied = partner.in_call || partner.status === 'busy' || partner.status === 'in_call'
  const isOnline = partner.status === 'online' && !isOccupied

  const isMan = currentUserGender === 'male'
  const isUnlocked = !isMan || conversation.is_unlocked_by_man

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  // Défilement automatique au chargement initial
  useEffect(() => {
    scrollToBottom('auto')
  }, [scrollToBottom])

  // Marquer immédiatement les messages comme lus dès l'entrée dans la conversation
  useEffect(() => {
    async function markAsRead() {
      try {
        await supabase.rpc('mark_messages_as_read', {
          p_conversation_id: conversation.id,
        })
      } catch {
        // Ignorer
      }
    }

    markAsRead()
  }, [conversation.id, supabase])

  // Écoute Realtime sur les messages et la conversation
  useEffect(() => {
    const channel = supabase
      .channel(`chat-room-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          // Si le message est reçu par moi, le marquer comme lu en base
          if (newMsg.receiver_id === currentUserId) {
            supabase.rpc('mark_messages_as_read', {
              p_conversation_id: conversation.id,
            })
          }

          setTimeout(() => scrollToBottom('smooth'), 100)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversation.id}`,
        },
        (payload) => {
          const updatedConv = payload.new as Conversation
          setConversation(updatedConv)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId, scrollToBottom, supabase])

  // Envoi de message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = inputText.trim()
    if (!content || isSending) return

    if (!isUnlocked) {
      setToastMessage('Vous devez débloquer cette discussion pour envoyer un message.')
      return
    }

    setIsSending(true)
    setInputText('')

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: currentUserId,
          receiver_id: partner.id,
          content,
          is_read: false,
        })
        .select()
        .single()

      if (error) {
        setToastMessage(`Erreur lors de l'envoi : ${error.message}`)
        setInputText(content) // Restauration du texte en cas d'erreur
      } else if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev
          return [...prev, data]
        })
        setTimeout(() => scrollToBottom('smooth'), 100)
      }
    } catch {
      setToastMessage("Une erreur inattendue s'est produite lors de l'envoi.")
      setInputText(content)
    } finally {
      setIsSending(false)
    }
  }

  // Déblocage par l'homme (règle asymétrique)
  const handleUnlockConversation = async () => {
    if (isUnlocking) return
    setIsUnlocking(true)

    try {
      const { data, error } = await supabase.rpc('unlock_conversation', {
        p_conversation_id: conversation.id,
      })

      if (error) {
        setToastMessage(`Impossible de débloquer : ${error.message}`)
      } else {
        setConversation((prev) => ({
          ...prev,
          is_unlocked_by_man: true,
          unlocked_at: new Date().toISOString(),
        }))
        setToastMessage('Discussion débloquée avec succès ! Vous pouvez maintenant écrire.')
      }
    } catch {
      setToastMessage('Erreur lors du déblocage de la discussion.')
    } finally {
      setIsUnlocking(false)
    }
  }

  return (
    <div className="flex flex-col h-dvh h-screen max-w-md mx-auto bg-[#0D0B0B] text-stone-100 overflow-hidden relative">
      {/* Toast de notification */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 animate-in fade-in slide-in-from-top duration-300">
          <div className="p-3 rounded-2xl bg-stone-900 border border-[#E05A47]/60 text-white text-xs flex items-center justify-between shadow-2xl backdrop-blur-md">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-stone-400 hover:text-white ml-2 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* En-tête de la discussion */}
      <header className="sticky top-0 z-30 bg-[#0D0B0B]/90 backdrop-blur-xl px-4 py-3 border-b border-stone-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/messages"
            className="w-9 h-9 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 transition-all cursor-pointer shrink-0"
            aria-label="Retour aux messages"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Photo & Statut */}
          <div className="relative w-10 h-10 rounded-full shrink-0">
            <div className="w-full h-full rounded-full overflow-hidden border border-stone-700 bg-stone-800">
              {partner.avatar_url ? (
                <Image
                  src={partner.avatar_url}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-[#E05A47]/40 to-[#F59E0B]/40 flex items-center justify-center text-sm font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0D0B0B] ${
                isOccupied
                  ? 'bg-rose-500'
                  : isOnline
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-stone-500'
              }`}
            />
          </div>

          {/* Nom et statut textuel */}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>{displayName}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </h2>
            <p className="text-[10px] text-stone-400 flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOccupied
                    ? 'bg-rose-500'
                    : isOnline
                    ? 'bg-emerald-400'
                    : 'bg-stone-500'
                }`}
              />
              <span>
                {isOccupied ? 'En appel vidéo' : isOnline ? 'En ligne' : 'Hors ligne'}
              </span>
            </p>
          </div>
        </div>

        {/* Bouton d'action rapide : Appel vidéo (si homme et partenaire en ligne) */}
        {isMan && (
          <button
            type="button"
            onClick={() => router.push('/discover')}
            className="w-9 h-9 rounded-full bg-stone-900 border border-stone-800 text-stone-300 hover:text-[#E05A47] hover:border-[#E05A47]/40 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Aller vers la galerie pour appel vidéo"
          >
            <Video className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Zone des messages (défilement automatique) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain">
        {/* En-tête sécurisé de la conversation */}
        <div className="text-center py-4 space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 border border-stone-800 mx-auto flex items-center justify-center text-stone-500 mb-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-xs font-semibold text-stone-300">
            Conversation privée avec {displayName}
          </p>
          <p className="text-[10px] text-stone-500 max-w-xs mx-auto">
            Les messages sont transmis instantanément en toute sécurité.
          </p>
        </div>

        {/* Liste des bulles de message */}
        {messages.map((message) => {
          const isMe = message.sender_id === currentUserId
          const time = formatMessageTime(message.created_at)

          return (
            <div
              key={message.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                  isMe
                    ? 'bg-gradient-to-tr from-[#E05A47] to-[#EA580C] text-white rounded-br-xs'
                    : 'bg-stone-900 border border-stone-800 text-stone-100 rounded-bl-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Heure et accusé de lecture */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                    isMe ? 'text-white/80' : 'text-stone-400'
                  }`}
                >
                  <span>{time}</span>
                  {isMe && (
                    <span>
                      {message.is_read ? (
                        <CheckCheck className="w-3 h-3 text-white" />
                      ) : (
                        <Check className="w-3 h-3 text-white/70" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Pied de page : RÈGLE ASYMÉTRIQUE DE PAIEMENT / CHAMP DE SAISIE */}
      <footer className="p-3 border-t border-stone-800 bg-[#0D0B0B]/95 backdrop-blur-xl shrink-0 safe-area-bottom">
        {!isUnlocked ? (
          /* ÉTAT BLOQUÉ : L'homme doit débloquer pour écrire */
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-stone-900 to-[#141111] border border-amber-500/30 text-center space-y-3 shadow-xl">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-bold">
              <Lock className="w-4 h-4" />
              <span>Discussion non débloquée</span>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed max-w-xs mx-auto">
              Vous pouvez lire les messages de {displayName}. Débloquez la discussion pour
              lui répondre et discuter en illimité.
            </p>

            <button
              type="button"
              onClick={handleUnlockConversation}
              disabled={isUnlocking}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white text-xs font-bold shadow-lg shadow-red-950/60 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Déblocage en cours...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>Débloquer la discussion (Simulation)</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-stone-500">
              Paiement unique par personne — Échanges illimités après déblocage
            </p>
          </div>
        ) : (
          /* ÉTAT DÉBLOQUÉ : Champ de saisie actif */
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 bg-stone-900/90 border border-stone-800 rounded-2xl p-1.5 focus-within:border-[#E05A47]/60 transition-all"
          >
            <input
              type="text"
              placeholder={`Écrire à ${displayName}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white flex items-center justify-center shadow-md shadow-red-950/50 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0"
              aria-label="Envoyer"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        )}
      </footer>
    </div>
  )
}
