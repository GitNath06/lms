'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu,
  X,
  FlaskConical,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Printer,
  AlertTriangle,
  Shield,
  LogOut,
  UserCheck,
  Wrench,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

interface MobileNavProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
  profileName?: string
  roleLabel?: string
  roleColor?: string
}

export default function MobileNav({
  isSuperAdmin,
  canAccessMaintenance = true,
  profileName = 'Staff Member',
  roleLabel = 'Teacher',
  roleColor = 'text-emerald-500',
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Lab Timetable', href: '/schedules', icon: Calendar },
    { label: 'Practical Logbook', href: '/records', icon: ClipboardList },
    { label: 'Incidents & Repairs', href: '/records/incidents', icon: AlertTriangle },
    ...(canAccessMaintenance
      ? [
          {
            label: 'Lab Maintenance',
            href: '/maintenance',
            icon: Wrench,
            badge: 'Routines',
          },
        ]
      : []),
    { label: 'Daily Lab Report', href: '/print/records', icon: Printer },
  ]

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
        aria-label="Open mobile menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-zinc-900 h-full shadow-2xl border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-sm">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                      LabSync LIMS
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Academic Session 2083
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User Snippet */}
              <div className="p-3 my-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {profileName}
                </div>
                <div className={`text-[10px] font-mono font-bold mt-0.5 ${roleColor}`}>
                  {roleLabel}
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold border-l-2 border-indigo-600'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}

                {isSuperAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${
                      pathname.startsWith('/admin')
                        ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold border-l-2 border-amber-500'
                        : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                    }`}
                  >
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span>Super Admin Control</span>
                  </Link>
                )}
              </nav>
            </div>

            {/* Sign Out */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center w-full px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"
                >
                  <LogOut className="mr-2.5 h-4 w-4" />
                  <span>Sign Out Session</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
