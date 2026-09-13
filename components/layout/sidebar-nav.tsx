'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Printer,
  AlertTriangle,
  Shield,
  ChevronRight,
  Sparkles,
  Wrench,
} from 'lucide-react'

interface SidebarNavProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
}

export default function SidebarNav({
  isSuperAdmin,
  canAccessMaintenance = true,
}: SidebarNavProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Lab Timetable',
      href: '/schedules',
      icon: Calendar,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Practical Logbook',
      href: '/records',
      icon: ClipboardList,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
      badge: 'Official',
      badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    },
    {
      label: 'Incidents & Repairs',
      href: '/records/incidents',
      icon: AlertTriangle,
      activeColor: 'text-rose-600 dark:text-rose-400',
      badge: 'Active',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    ...(canAccessMaintenance
      ? [
          {
            label: 'Lab Maintenance',
            href: '/maintenance',
            icon: Wrench,
            activeColor: 'text-indigo-600 dark:text-indigo-400',
            badge: 'Routines',
            badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          },
        ]
      : []),
    {
      label: 'Daily Lab Report',
      href: '/print/records',
      icon: Printer,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
  ]

  return (
    <ul className="space-y-1.5 font-sans">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all group relative ${isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs border-l-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-transform group-hover:scale-105 ${isActive ? item.activeColor : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}

      {/* Super Admin Control Navigation Link (Restricted to super_admin) */}
      {isSuperAdmin && (
        <li className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <Link
            href="/admin"
            className={`flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl transition-all group relative ${pathname.startsWith('/admin')
                ? 'bg-amber-500/10 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold border-l-2 border-amber-500 shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="truncate">Super Admin Control</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              Tier-1
            </span>
          </Link>
        </li>
      )}
    </ul>
  )
}
