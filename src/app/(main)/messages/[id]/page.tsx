'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatRoom } from '@/components/messaging/ChatRoom'
import { Loader2 } from 'lucide-react'
import type { Profile, Conversation, Message } from '@/types/database'

interface ConversationPageProps {
  params: Promise<{ id: string }>
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const resolvedParams = use(params)
  const conversationId = resolvedParams.id
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserGender, setCurrentUserGender] = useState<'male' | 'female'>('male')
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadConversationData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        if (isMounted) setCurrentUserId(user.id)

        // Récupérer le profil connecté
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!myProfile?.gender) {
          router.push('/onboarding')
          return
        }

        if (isMounted) setCurrentUserGender(myProfile.gender)

        // Récupérer la conversation
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single()

        if (convError || !conv) {
          if (isMounted) setErrorMsg('Conversation introuvable ou accès refusé.')
          return
        }

        // Vérifier que l'utilisateur fait partie de la conversation
        if (conv.man_id !== user.id && conv.woman_id !== user.id) {
          if (isMounted) setErrorMsg('Vous n’avez pas accès à cette conversation.')
          return
        }

        if (isMounted) setConversation(conv)

        // Identifier le partenaire (l'autre personne)
        const partnerId = conv.man_id === user.id ? conv.woman_id : conv.man_id

        const { data: partnerProfile, error: partnerError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', partnerId)
          .single()

        if (partnerError || !partnerProfile) {
          if (isMounted) setErrorMsg('Profil du correspondant introuvable.')
          return
        }

        if (isMounted) setPartner(partnerProfile)

        // Récupérer les messages existants de la conversation
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (isMounted) {
          setMessages(msgs || [])
          setIsLoading(false)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Erreur de chargement.')
          setIsLoading(false)
        }
      }
    }

    loadConversationData()

    return () => {
      isMounted = false
    }
  }, [conversationId, router, supabase])

  if (isLoading) {
    return (
      <div className="h-dvh h-screen max-w-md mx-auto bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#E05A47] animate-spin" />
        <p className="text-xs text-stone-400 font-medium">Chargement de la discussion...</p>
      </div>
    )
  }

  if (errorMsg || !conversation || !partner || !currentUserId) {
    return (
      <div className="h-dvh h-screen max-w-md mx-auto bg-[#0D0B0B] text-stone-100 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-400">
          ✕
        </div>
        <p className="text-sm font-semibold text-stone-200">
          {errorMsg || 'Impossible d’ouvrir cette discussion.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/messages')}
          className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-[#E05A47] font-bold hover:border-[#E05A47]/40 cursor-pointer"
        >
          Retour aux messages
        </button>
      </div>
    )
  }

  return (
    <ChatRoom
      conversation={conversation}
      currentUserId={currentUserId}
      currentUserGender={currentUserGender}
      partner={partner}
      initialMessages={messages}
    />
  )
}
