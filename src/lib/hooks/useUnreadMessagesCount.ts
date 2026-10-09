'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useUnreadMessagesCount(userId?: string | null) {
  const [unreadCount, setUnreadCount] = useState<number>(0)

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0)
      return
    }

    const supabase = createClient()
    let isMounted = true

    async function fetchUnreadCount() {
      try {
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', userId!)
          .eq('is_read', false)

        if (!error && count !== null && isMounted) {
          setUnreadCount(count)
        }
      } catch {
        // Ignorer les erreurs silencieuses
      }
    }

    fetchUnreadCount()

    // Écoute en temps réel des modifications sur messages
    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  return unreadCount
}
