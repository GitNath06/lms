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
  Monitor,
  BarChart3,
} from 'lucide-react'

import { useInfrastructureState } from '@/hooks/use-infrastructure-state'

interface SidebarNavProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
}

export default function SidebarNav({
  isSuperAdmin,
  canAccessMaintenance = true,
}: SidebarNavProps) {
  const pathname = usePathname()
  const { labs } = useInfrastructureState()

  const compLab = labs?.find((l) => l.id === 'comp' || l.type === 'computer_lab')
  const labStatus = compLab?.status || 'Operational'
  const isOperational = labStatus === 'Operational' && compLab?.is_active !== false
  const isMaintenance = labStatus === 'Under Maintenance'

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
    },
    {
      label: 'Incidents & Repairs',
      href: '/records/incidents',
      icon: AlertTriangle,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Floor Plan',
      href: '/computer-lab',
      icon: Monitor,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    ...(canAccessMaintenance
      ? [
          {
            label: 'Lab Diagnostics & Maintenance',
            href: '/maintenance',
            icon: Wrench,
            activeColor: 'text-indigo-600 dark:text-indigo-400',
          },
        ]
      : []),
    {
      label: 'Institutional Analytics',
      href: '/analytics',
      icon: BarChart3,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
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
              {item.href === '/computer-lab' && (
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOperational
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse'
                      : isMaintenance
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                      : 'bg-zinc-400'
                  }`}
                  title={`Floor Plan: ${labStatus}`}
                />
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
          </Link>
        </li>
      )}
    </ul>
  )
}
