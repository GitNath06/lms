'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FlaskConical,
  Command,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Printer,
  AlertTriangle,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'

interface CollapsibleSidebarProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
}

export default function CollapsibleSidebar({
  isSuperAdmin,
  canAccessMaintenance = true,
}: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const pathname = usePathname()
  const router = useRouter()

  // Load persistence preference
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('sidebar_collapsed_v1')
      if (saved !== null) {
        setIsCollapsed(saved === 'true')
      }
    } catch (e) {}
  }, [])

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    try {
      localStorage.setItem('sidebar_collapsed_v1', String(next))
    } catch (e) {}
  }

  const navItems = [
    {
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      href: '/',
      shortcut: '⌘1',
      icon: LayoutDashboard,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Lab Timetable',
      shortLabel: 'Timetable',
      href: '/schedules',
      shortcut: '⌘2',
      icon: Calendar,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Practical Logbook',
      shortLabel: 'Logbook',
      href: '/records',
      shortcut: '⌘3',
      icon: ClipboardList,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Incidents & Repairs',
      shortLabel: 'Incidents',
      href: '/records/incidents',
      shortcut: '⌘4',
      icon: AlertTriangle,
      activeColor: 'text-rose-600 dark:text-rose-400',
      badge: 'Active',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    },
    ...(canAccessMaintenance
      ? [
          {
            label: 'Lab Maintenance',
            shortLabel: 'Maintenance',
            href: '/maintenance',
            shortcut: '⌘5',
            icon: Wrench,
            activeColor: 'text-indigo-600 dark:text-indigo-400',
            badge: 'Routines',
            badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          },
        ]
      : []),
    {
      label: 'Daily Lab Report',
      shortLabel: 'Report',
      href: '/print/records',
      shortcut: '⌘6',
      icon: Printer,
      activeColor: 'text-indigo-600 dark:text-indigo-400',
    },
  ]

  // Global Keyboard shortcuts: Ctrl/Cmd + B for toggle, Ctrl/Cmd + 1..6 for direct navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapse()
      } else if ((e.ctrlKey || e.metaKey) && ['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1
        if (navItems[idx]) {
          e.preventDefault()
          router.push(navItems[idx].href)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCollapsed, router, navItems])

  return (
    <aside
      className={`relative bg-surface-1 border-r border-border-subtle flex flex-col hidden md:flex print:hidden transition-all duration-300 ease-in-out z-30 select-none ${
        isCollapsed ? 'w-20 overflow-visible' : 'w-64 overflow-x-hidden'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-border-subtle">
        {isCollapsed ? (
          <div className="w-full flex items-center justify-center">
            <button
              type="button"
              onClick={toggleCollapse}
              title="Expand sidebar (Ctrl + B)"
              className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 transition-all cursor-pointer group hover:scale-105"
            >
              <PanelLeftOpen className="h-5 w-5 transition-transform group-hover:scale-110" />
            </button>
          </div>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <FlaskConical className="h-4 w-4" />
              </div>
              <div className="overflow-hidden animate-in fade-in duration-200">
                <div className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white font-heading">
                  LabSync LIMS
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-mono truncate">
                  Academic Session 2083
                </div>
              </div>
            </Link>

            {/* Floating Toggle Button */}
            <button
              type="button"
              onClick={toggleCollapse}
              title="Collapse sidebar (Ctrl + B)"
              className="h-7 w-7 rounded-lg border border-border-subtle bg-surface-2 text-zinc-500 hover:text-zinc-950 dark:text-slate-400 dark:hover:text-white flex items-center justify-center hover:bg-surface-3 transition-all cursor-pointer shadow-2xs"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation Section */}
      <nav className={`flex-1 py-5 px-3 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>
        {!isCollapsed && (
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono flex items-center justify-between">
            <span>Navigation</span>
            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2 rounded text-zinc-400 font-mono flex items-center gap-0.5">
              <Command className="h-2.5 w-2.5" /> K
            </span>
          </div>
        )}

        <ul className="space-y-1.5 font-sans">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : item.href === '/records'
                ? pathname === '/records' || pathname === '/logs'
                : item.href === '/records/incidents'
                ? pathname === '/records/incidents' || pathname === '/incidents'
                : pathname.startsWith(item.href)

            return (
              <li key={item.href} className="relative group">
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2.5 text-xs font-medium rounded-xl transition-all relative ${
                    isCollapsed ? 'justify-center' : 'justify-between'
                  } ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/10 dark:to-transparent text-indigo-950 dark:text-indigo-200 font-semibold shadow-2xs border border-indigo-500/20'
                      : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-surface-2'
                  }`}
                >
                  {/* Glowing active indicator pill */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400 shadow-sm shadow-indigo-500/50" />
                  )}

                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? item.activeColor : 'text-zinc-400 dark:text-slate-400'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${
                        item.badgeColor ||
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>

                {/* Elevated Floating Glass Tooltip on Collapsed View */}
                {isCollapsed && (
                  <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-2 bg-white/95 dark:bg-surface-1/95 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-border-card shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white font-heading">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${
                              item.badgeColor ||
                              'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-slate-400 font-mono">
                        Shortcut: <span className="font-semibold text-zinc-700 dark:text-slate-200">{item.shortcut}</span>
                      </span>
                    </div>
                    {/* Micro pointer notch */}
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-surface-1 border-l border-b border-zinc-200 dark:border-border-card rotate-45 rounded-xs" />
                  </div>
                )}
              </li>
            )
          })}

          {/* Super Admin Control Link */}
          {isSuperAdmin && (
            <li className="pt-2 mt-2 border-t border-border-subtle relative group">
              <Link
                href="/admin"
                className={`flex items-center px-3 py-2.5 text-xs font-medium rounded-xl transition-all relative ${
                  isCollapsed ? 'justify-center' : 'justify-between'
                } ${
                  pathname.startsWith('/admin')
                    ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold border border-amber-500/30 shadow-xs'
                    : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                {pathname.startsWith('/admin') && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                )}

                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 shrink-0 text-amber-500 group-hover:scale-110 transition-transform" />
                  {!isCollapsed && <span className="truncate">Super Admin Control</span>}
                </div>
                {!isCollapsed && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Tier-1
                  </span>
                )}
              </Link>

              {isCollapsed && (
                <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-2 bg-amber-950/95 text-amber-200 rounded-xl border border-amber-800 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-3 backdrop-blur-md">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-heading text-amber-100">Super Admin Control</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Tier-1
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 font-mono">
                      System Governance & Permissions
                    </span>
                  </div>
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-950 border-l border-b border-amber-800 rotate-45 rounded-xs" />
                </div>
              )}
            </li>
          )}
        </ul>
      </nav>

      {/* Footer / Account Sign Out */}
      <div className="p-3 border-t border-border-subtle overflow-hidden">
        <form action={signOut}>
          <button
            type="submit"
            title={isCollapsed ? 'Sign Out Session' : undefined}
            className={`flex items-center w-full px-3 py-2 text-xs font-medium text-zinc-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-surface-2 transition-all cursor-pointer ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="ml-3 truncate">Sign Out Session</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
