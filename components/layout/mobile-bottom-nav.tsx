'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Monitor,
  Calendar,
  ClipboardList,
  User,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard, exact: true },
  { label: 'Live Lab', href: '/computer-lab', icon: Monitor },
  { label: 'Schedule', href: '/schedules', icon: Calendar },
  { label: 'Records', href: '/records', icon: ClipboardList },
  { label: 'Profile', href: '/profile', icon: User },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  // Hide mobile bottom nav on full-screen creation pages and print views
  // to ensure 100% viewport space for sticky action bars and inputs
  if (pathname?.startsWith('/records/new') || pathname?.startsWith('/print')) {
    return null
  }

  const handleTap = () => {
    try {
      navigator.vibrate?.(8)
    } catch {
      // Ignore vibration errors
    }
  }

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#09090B]/95 backdrop-blur-xl border-t border-zinc-800/80 pb-[env(safe-area-inset-bottom)] transition-transform duration-200"
    >
      <div className="grid grid-cols-5 h-16 items-center px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleTap}
              className={`flex flex-col items-center justify-center h-full relative transition-colors duration-150 active:scale-95 touch-manipulation ${
                isActive
                  ? 'text-indigo-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              {isActive && (
                <span className="absolute top-1.5 h-1 w-5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              )}
              <Icon className={`h-5 w-5 ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
              <span className="text-[10px] mt-1 tracking-tight font-sans">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

