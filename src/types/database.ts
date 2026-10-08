export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string
          birthdate: string | null
          gender: 'male' | 'female'
          bio: string | null
          city: string | null
          country: string | null
          avatar_url: string | null
          is_profile_completed: boolean
          status: 'online' | 'in_call' | 'offline'
          last_seen_at: string
          price_per_minute: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string
          birthdate?: string | null
          gender: 'male' | 'female'
          bio?: string | null
          city?: string | null
          country?: string | null
          avatar_url?: string | null
          is_profile_completed?: boolean
          status?: 'online' | 'in_call' | 'offline'
          last_seen_at?: string
          price_per_minute?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          birthdate?: string | null
          gender?: 'male' | 'female'
          bio?: string | null
          city?: string | null
          country?: string | null
          avatar_url?: string | null
          is_profile_completed?: boolean
          status?: 'online' | 'in_call' | 'offline'
          last_seen_at?: string
          price_per_minute?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          man_id: string
          woman_id: string
          is_unlocked_by_man: boolean
          unlocked_at: string | null
          unlock_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          man_id: string
          woman_id: string
          is_unlocked_by_man?: boolean
          unlocked_at?: string | null
          unlock_price?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          man_id?: string
          woman_id?: string
          is_unlocked_by_man?: boolean
          unlocked_at?: string | null
          unlock_price?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          receiver_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          receiver_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      random_call_queue: {
        Row: {
          id: string
          user_id: string
          gender: 'male' | 'female'
          status: 'waiting' | 'matched' | 'cancelled'
          matched_partner_id: string | null
          room_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gender: 'male' | 'female'
          status?: 'waiting' | 'matched' | 'cancelled'
          matched_partner_id?: string | null
          room_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gender?: 'male' | 'female'
          status?: 'waiting' | 'matched' | 'cancelled'
          matched_partner_id?: string | null
          room_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          id: string
          caller_id: string
          receiver_id: string
          call_type: 'direct' | 'random'
          status: 'initiated' | 'ringing' | 'in_progress' | 'ended' | 'rejected' | 'missed' | 'busy'
          price_per_minute: number
          started_at: string | null
          ended_at: string | null
          duration_seconds: number
          total_cost: number
          female_earnings: number
          platform_fee: number
          created_at: string
        }
        Insert: {
          id?: string
          caller_id: string
          receiver_id: string
          call_type?: 'direct' | 'random'
          status?: 'initiated' | 'ringing' | 'in_progress' | 'ended' | 'rejected' | 'missed' | 'busy'
          price_per_minute?: number
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number
          total_cost?: number
          female_earnings?: number
          platform_fee?: number
          created_at?: string
        }
        Update: {
          id?: string
          caller_id?: string
          receiver_id?: string
          call_type?: 'direct' | 'random'
          status?: 'initiated' | 'ringing' | 'in_progress' | 'ended' | 'rejected' | 'missed' | 'busy'
          price_per_minute?: number
          started_at?: string | null
          ended_at?: string | null
          duration_seconds?: number
          total_cost?: number
          female_earnings?: number
          platform_fee?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type RandomCallQueue = Database['public']['Tables']['random_call_queue']['Row']
export type CallSession = Database['public']['Tables']['call_sessions']['Row']
export type UserStatus = 'online' | 'in_call' | 'offline'
