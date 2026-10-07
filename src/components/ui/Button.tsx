'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer'

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-2 gap-1.5 min-h-[38px]',
    md: 'text-sm px-5 py-3 gap-2 min-h-[46px]',
    lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[52px]',
  }

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-[#E05A47] via-[#E86348] to-[#F59E0B] text-white shadow-lg shadow-red-950/30 hover:opacity-95 border border-white/10',
    secondary:
      'bg-stone-900 text-stone-200 hover:bg-stone-800 hover:text-white border border-stone-800',
    outline:
      'bg-transparent text-stone-200 border border-stone-700 hover:bg-stone-900/60 hover:border-stone-500',
    ghost:
      'bg-transparent text-stone-400 hover:text-white hover:bg-stone-900/40',
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Chargement...</span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  )
}
