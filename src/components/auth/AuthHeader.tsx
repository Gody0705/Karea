import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface AuthHeaderProps {
  title: string
  subtitle: string
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <Link href="/" className="group mb-5">
        <div
          className="relative rounded-2xl overflow-hidden shadow-xl shadow-red-950/50 border border-white/10 group-hover:scale-105 transition-transform shrink-0"
          style={{ width: 56, height: 56 }}
        >
          <Image
            src="/logo.svg"
            alt="Logo Karea"
            width={56}
            height={56}
            className="w-full h-full object-cover"
            priority
          />
        </div>
      </Link>
      <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
      <p className="text-sm text-stone-400 mt-1 max-w-xs">{subtitle}</p>
    </div>
  )
}
