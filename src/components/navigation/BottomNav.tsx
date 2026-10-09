'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tv, Globe, MessageCircle, User } from 'lucide-react'

interface BottomNavProps {
  unreadMessagesCount?: number
}

export const BottomNav: React.FC<BottomNavProps> = ({ unreadMessagesCount = 0 }) => {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Galerie',
      href: '/discover',
      icon: Tv,
      active: pathname.startsWith('/discover'),
    },
    {
      label: 'Hasard',
      href: '/random',
      icon: Globe,
      active: pathname.startsWith('/random'),
    },
    {
      label: 'Messages',
      href: '/messages',
      icon: MessageCircle,
      active: pathname.startsWith('/messages'),
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      label: 'Profil',
      href: '/profile',
      icon: User,
      active: pathname.startsWith('/profile'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 bg-[#0D0B0B]/90 backdrop-blur-xl border-t border-stone-800/80 px-2 py-1.5 pb-2 transition-all duration-300"
      aria-label="Navigation principale"
    >
      <div className="grid grid-cols-4 items-center">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.active

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200 relative group cursor-pointer ${
                isActive ? 'text-[#E05A47]' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {/* Conteneur d'icône avec badge */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'bg-[#E05A47]/15 text-[#E05A47]'
                      : 'group-hover:bg-stone-800/50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'
                    }`}
                  />
                </div>

                {/* Badge compteur non-lus (Messages) */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-red-600 border-2 border-[#0D0B0B] text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-md shadow-red-950">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>

              {/* Libellé */}
              <span
                className={`text-[10px] tracking-tight mt-0.5 transition-all duration-200 ${
                  isActive ? 'font-bold text-[#E05A47]' : 'font-medium text-stone-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
