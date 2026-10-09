import type { Profile, Message, Conversation } from '@/types/database'

export interface ConversationListItem {
  id: string
  man_id: string
  woman_id: string
  is_unlocked_by_man: boolean
  unlocked_at: string | null
  partner: Profile
  lastMessage: Message | null
  unreadCount: number
  updated_at: string
}
