'use client'

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BottomNav } from '@/components/navigation/BottomNav'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { ConversationRow } from '@/components/messaging/ConversationRow'
import {
  MessageCircle,
  Sparkles,
  Inbox,
  Search,
  X,
  Loader2,
  Users,
} from 'lucide-react'
import type { ConversationListItem } from '@/types/messaging'
import type { Profile, Conversation, Message } from '@/types/database'

function MessagesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const partnerParam = searchParams.get('partner')

  const supabase = useMemo(() => createClient(), [])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserGender, setCurrentUserGender] = useState<'male' | 'female'>('male')
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingConv, setIsCreatingConv] = useState(false)

  // 1. Récupération des conversations et partenaires
  const loadConversations = useCallback(
    async (userId: string) => {
      try {
        // Récupérer toutes les conversations où l'utilisateur participe
        const { data: convs, error: convsError } = await supabase
          .from('conversations')
          .select('*')
          .or(`man_id.eq.${userId},woman_id.eq.${userId}`)
          .order('updated_at', { ascending: false })

        if (convsError || !convs || convs.length === 0) {
          setConversations([])
          setIsLoading(false)
          return
        }

        // Trouver les IDs des correspondants
        const partnerIds = Array.from(
          new Set(
            convs.map((c) => (c.man_id === userId ? c.woman_id : c.man_id))
          )
        )

        // Récupérer les profils correspondants
        const { data: partnerProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', partnerIds)

        const profileMap = new Map<string, Profile>()
        if (partnerProfiles) {
          partnerProfiles.forEach((p) => profileMap.set(p.id, p))
        }

        // Récupérer le dernier message et le décompte des non-lus pour chaque conversation
        const items: ConversationListItem[] = await Promise.all(
          convs.map(async (conv) => {
            const partnerId = conv.man_id === userId ? conv.woman_id : conv.man_id
            const partnerProfile: Profile =
              profileMap.get(partnerId) || {
                id: partnerId,
                first_name: 'Utilisateur',
                gender: conv.man_id === userId ? 'female' : 'male',
                status: 'offline',
                is_profile_completed: true,
                price_per_minute: 100,
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                in_call: false,
                last_seen_at: conv.updated_at,
                avatar_url: null,
                bio: null,
                birthdate: null,
                city: null,
                country: null,
              }

            // Dernier message
            const { data: lastMsgs } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: false })
              .limit(1)

            const lastMessage: Message | null =
              lastMsgs && lastMsgs.length > 0 ? lastMsgs[0] : null

            // Compte des messages non lus
            const { count: unreadCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .eq('receiver_id', userId)
              .eq('is_read', false)

            return {
              id: conv.id,
              man_id: conv.man_id,
              woman_id: conv.woman_id,
              is_unlocked_by_man: conv.is_unlocked_by_man,
              unlocked_at: conv.unlocked_at,
              partner: partnerProfile,
              lastMessage,
              unreadCount: unreadCount || 0,
              updated_at: conv.updated_at,
            }
          })
        )

        // Tri : message le plus récent en haut, sinon date de mise à jour
        items.sort((a, b) => {
          const timeA = a.lastMessage
            ? new Date(a.lastMessage.created_at).getTime()
            : new Date(a.updated_at).getTime()
          const timeB = b.lastMessage
            ? new Date(b.lastMessage.created_at).getTime()
            : new Date(b.updated_at).getTime()
          return timeB - timeA
        })

        setConversations(items)
      } catch {
        // En cas d'erreur
      } finally {
        setIsLoading(false)
      }
    },
    [supabase]
  )

  // 2. Initialisation Auth & gestion paramètre ?partner=UUID
  useEffect(() => {
    let isMounted = true

    async function initUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        if (isMounted) setCurrentUserId(user.id)

        // Vérification profil
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single()

        if (!myProfile?.gender) {
          router.push('/onboarding')
          return
        }

        if (isMounted) setCurrentUserGender(myProfile.gender)

        // Si un paramètre partner est présent, créer/récupérer la discussion puis rediriger
        if (partnerParam && partnerParam !== user.id) {
          setIsCreatingConv(true)
          const { data: convId, error: rpcError } = await supabase.rpc(
            'get_or_create_conversation',
            { p_other_user_id: partnerParam }
          )

          if (!rpcError && convId) {
            router.replace(`/messages/${convId}`)
            return
          }
          setIsCreatingConv(false)
        }

        await loadConversations(user.id)
      } catch {
        if (isMounted) setIsLoading(false)
      }
    }

    initUser()

    return () => {
      isMounted = false
    }
  }, [loadConversations, partnerParam, router, supabase])

  // 3. Abonnement en temps réel aux messages et conversations
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel('messages-list-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Recharger les conversations et leurs statuts lors d'un nouveau message
          loadConversations(currentUserId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations(currentUserId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, loadConversations, supabase])

  // 4. Filtrage par recherche
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations

    const q = searchQuery.toLowerCase().trim()
    return conversations.filter((item) => {
      const nameMatch = item.partner.first_name?.toLowerCase().includes(q)
      const messageMatch = item.lastMessage?.content.toLowerCase().includes(q)
      return nameMatch || messageMatch
    })
  }, [conversations, searchQuery])

  // Calcul du badge total des non-lus
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, curr) => acc + curr.unreadCount, 0)
  }, [conversations])

  if (isLoading || isCreatingConv) {
    return (
      <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#E05A47] animate-spin" />
        <p className="text-xs text-stone-400 font-medium tracking-wide">
          {isCreatingConv ? 'Ouverture de la discussion...' : 'Chargement de vos conversations...'}
        </p>
      </div>
    )
  }

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
              <p className="text-[10px] text-stone-400 font-medium flex items-center gap-1.5">
                <span>Discussions privées</span>
                {totalUnreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600/20 border border-red-500/40 text-[9px] text-red-400 font-bold">
                    {totalUnreadCount} non lu{totalUnreadCount > 1 ? 's' : ''}
                  </span>
                )}
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
            placeholder="Rechercher parmi vos conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900/90 border border-stone-800 rounded-xl pl-8 pr-8 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-[#E05A47]/60 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Contenu principal : Liste des conversations */}
      <div className="p-4 flex-1">
        {filteredConversations.length > 0 ? (
          <div className="space-y-2.5">
            {filteredConversations.map((item) => (
              <ConversationRow
                key={item.id}
                conversation={item}
                currentUserId={currentUserId!}
                isMan={currentUserGender === 'male'}
              />
            ))}
          </div>
        ) : (
          /* État vide */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 shadow-inner">
              {searchQuery ? (
                <Search className="w-8 h-8 text-stone-500" />
              ) : (
                <Inbox className="w-8 h-8 text-stone-500" />
              )}
            </div>

            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-base font-bold text-stone-200">
                {searchQuery
                  ? 'Aucune conversation trouvée'
                  : 'Aucune conversation pour l’instant'}
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed font-medium">
                {searchQuery
                  ? 'Essayez de chercher avec un autre mot ou un autre prénom.'
                  : 'Découvrez des profils dans la galerie pour entamer de nouvelles discussions.'}
              </p>
            </div>

            {!searchQuery && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push('/discover')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-tr from-[#E05A47] to-[#F59E0B] text-white text-xs font-bold shadow-lg shadow-red-950/60 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  <span>Explorer la galerie</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barre de navigation du bas avec badge temps réel */}
      <BottomNav unreadMessagesCount={totalUnreadCount} />
    </main>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#E05A47] animate-spin" />
          <p className="text-xs text-stone-400 font-medium tracking-wide">
            Chargement de vos conversations...
          </p>
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  )
}
