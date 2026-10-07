'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Loader2 } from 'lucide-react'

interface SignOutButtonProps {
  className?: string
  showText?: boolean
}

export const SignOutButton: React.FC<SignOutButtonProps> = ({
  className = '',
  showText = true,
}) => {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 text-stone-400 hover:text-red-400 text-xs font-medium p-2 rounded-xl hover:bg-stone-900/60 transition-colors cursor-pointer disabled:opacity-50 ${className}`}
      title="Se déconnecter"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <LogOut className="w-4 h-4 text-current" />
      )}
      {showText && <span>Se déconnecter</span>}
    </button>
  )
}
