'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

interface GoogleButtonProps {
  text?: string
}

export const GoogleButton: React.FC<GoogleButtonProps> = ({
  text = 'Continuer avec Google',
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const redirectOrigin =
        typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${redirectOrigin}/auth/callback`,
        },
      })

      if (error) {
        setErrorMessage(error.message)
        setIsLoading(false)
      }
    } catch {
      setErrorMessage("Une erreur est survenue lors de la connexion avec Google.")
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full min-h-[48px] flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-white text-stone-900 font-semibold text-sm hover:bg-stone-100 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-stone-700" />
        ) : (
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{isLoading ? 'Connexion en cours...' : text}</span>
      </button>

      {errorMessage && (
        <p className="text-xs text-red-400 text-center">{errorMessage}</p>
      )}
    </div>
  )
}
