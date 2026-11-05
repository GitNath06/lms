'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  FlaskConical,
  Command,
  LogOut,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Printer,
  AlertTriangle,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  Monitor,
  UserCheck,
  Clock,
  Users,
  BookOpen,
  Building2,
  CalendarDays,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { useAcademicYear } from '@/lib/context/academic-year-context'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'

const ADMIN_SUB_MODULES = [
  {
    key: 'identity',
    label: 'Identity & Access',
    icon: Users,
    href: '/admin?tab=identity',
  },
  {
    key: 'curriculum',
    label: 'Academic Curriculum',
    icon: BookOpen,
    href: '/admin?tab=curriculum',
  },
  {
    key: 'facilities',
    label: 'Facilities & Safety',
    icon: Building2,
    href: '/admin?tab=facilities',
  },
  {
    key: 'operations',
    label: 'Operations & Backup',
    icon: CalendarDays,
    href: '/admin?tab=operations',
  },
]

function AdminSubTreeInner({
  isCollapsed,
  isAdminExpanded,
  pathname,
}: {
  isCollapsed: boolean
  isAdminExpanded: boolean
  pathname: string
}) {
  const searchParams = useSearchParams()
  const activeTab = searchParams?.get('tab') || 'identity'

  // When collapsed: render the 4 module icons vertically below the main Super Admin icon
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1 mt-1 pt-1.5 border-t border-amber-500/20 w-full animate-in fade-in duration-200">
        {ADMIN_SUB_MODULES.map((sub) => {
          const SubIcon = sub.icon
          const isSubActive =
            pathname.startsWith('/admin') &&
            (activeTab === sub.key ||
              (sub.key === 'identity' && activeTab === '01') ||
              (sub.key === 'curriculum' && activeTab === '02') ||
              (sub.key === 'facilities' && activeTab === '03') ||
              (sub.key === 'operations' && activeTab === '04'))

          return (
            <div key={sub.key} className="relative group/sub flex items-center justify-center">
              <Link
                href={sub.href}
                className={`flex items-center justify-center h-8 w-8 rounded-lg transition-all ${
                  isSubActive
                    ? 'bg-amber-500/25 text-amber-950 dark:text-amber-200 border border-amber-500/40 shadow-xs'
                    : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-surface-2'
                }`}
              >
                <SubIcon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover/sub:scale-115 stroke-[2.25] ${
                    isSubActive ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-slate-400'
                  }`}
                />
              </Link>

              {/* Floating Tooltip for Sub-Icon in Collapsed Mode */}
              <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-white/95 dark:bg-surface-1/95 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-border-card shadow-xl opacity-0 pointer-events-none group-hover/sub:opacity-100 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-white font-heading">
                  {sub.label}
                </span>
                <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-surface-1 border-l border-b border-zinc-200 dark:border-border-card rotate-45 rounded-xs" />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (!isAdminExpanded) return null

  // When expanded: render the indented labeled sub-tree
  return (
    <ul className="mt-1.5 ml-4 pl-3 border-l-2 border-amber-500/20 dark:border-amber-500/30 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
      {ADMIN_SUB_MODULES.map((sub) => {
        const SubIcon = sub.icon
        const isSubActive =
          pathname.startsWith('/admin') &&
          (activeTab === sub.key ||
            (sub.key === 'identity' && activeTab === '01') ||
            (sub.key === 'curriculum' && activeTab === '02') ||
            (sub.key === 'facilities' && activeTab === '03') ||
            (sub.key === 'operations' && activeTab === '04'))

        return (
          <li key={sub.key}>
            <Link
              href={sub.href}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all relative ${
                isSubActive
                  ? 'bg-amber-500/15 text-amber-950 dark:text-amber-200 font-bold border border-amber-500/30 shadow-2xs'
                  : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-surface-2'
              }`}
            >
              {isSubActive && (
                <span className="absolute -left-[14px] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
              <SubIcon
                className={`h-4 w-4 shrink-0 stroke-[2.25] ${
                  isSubActive ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'
                }`}
              />
              <span className="truncate">{sub.label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

interface CollapsibleSidebarProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
  isPending?: boolean
}

export default function CollapsibleSidebar({
  isSuperAdmin,
  canAccessMaintenance = true,
  isPending = false,
}: CollapsibleSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const [isAdminExpanded, setIsAdminExpanded] = useState<boolean>(true)
  const pathname = usePathname()
  const router = useRouter()
  const { systemActiveYearName, userViewingYear, isViewingArchived } = useAcademicYear()
  const { labs } = useInfrastructureState()

  const compLab = labs?.find((l) => l.id === 'comp' || l.type === 'computer_lab')
  const labStatus = compLab?.status || 'Operational'
  const isOperational = labStatus === 'Operational' && compLab?.is_active !== false
  const isMaintenance = labStatus === 'Under Maintenance'

  // Auto-expand admin sub-nav when visiting admin routes
  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      setIsAdminExpanded(true)
    }
  }, [pathname])

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

  const navItems = isPending
    ? [
        {
          label: 'Faculty Profile',
          shortLabel: 'Profile',
          href: '/profile',
          shortcut: '⌘1',
          icon: UserCheck,
          activeColor: 'text-amber-500',
        },
      ]
    : [
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
          activeColor: 'text-indigo-600 dark:text-indigo-400',
        },
        {
          label: 'Floor Plan',
          shortLabel: 'Floor Plan',
          href: '/computer-lab',
          shortcut: '⌘5',
          icon: Monitor,
          activeColor: 'text-indigo-600 dark:text-indigo-400',
        },
        ...(canAccessMaintenance
          ? [
              {
                label: 'Lab Diagnostics & Maintenance',
                shortLabel: 'Diagnostics & Maint',
                href: '/maintenance',
                shortcut: '⌘6',
                icon: Wrench,
                activeColor: 'text-indigo-600 dark:text-indigo-400',
              },
            ]
          : []),
        {
          label: 'Daily Lab Report',
          shortLabel: 'Report',
          href: '/print/records',
          shortcut: '⌘7',
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
      <div className="relative h-16 flex items-center justify-between px-3.5 border-b border-border-subtle">
        {isCollapsed ? (
          <div className="w-full flex items-center justify-center">
            {/* Gemini-style interactive logo toggle: reveals expand icon on hover */}
            <button
              type="button"
              onClick={toggleCollapse}
              title="Expand sidebar (Ctrl + B)"
              className="group/logo relative h-10 w-10 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <FlaskConical className="h-5 w-5 stroke-[2.25] transition-all duration-200 group-hover/logo:scale-0 group-hover/logo:opacity-0" />
              <PanelLeftOpen className="absolute h-5 w-5 stroke-[2.25] transition-all duration-200 scale-0 opacity-0 group-hover/logo:scale-100 group-hover/logo:opacity-100" />
            </button>
          </div>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-3 overflow-hidden">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <FlaskConical className="h-5 w-5 stroke-[2.25]" />
              </div>
              <div className="overflow-hidden animate-in fade-in duration-200">
                <div className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white font-heading">
                  LabSync LIMS
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-mono truncate">
                  {isViewingArchived ? `Archived (${userViewingYear} B.S.)` : `Academic Session ${systemActiveYearName}`}
                </div>
              </div>
            </Link>

            {/* Collapse Button Beside Brand Logo */}
            <button
              type="button"
              onClick={toggleCollapse}
              title="Collapse sidebar (Ctrl + B)"
              className="h-8 w-8 rounded-lg border border-border-subtle bg-surface-2 text-zinc-500 hover:text-zinc-950 dark:text-slate-400 dark:hover:text-white flex items-center justify-center hover:bg-surface-3 transition-all cursor-pointer shadow-2xs"
            >
              <PanelLeftClose className="h-4.5 w-4.5 stroke-[2.25]" />
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
                ? pathname.startsWith('/records') && !pathname.startsWith('/records/incidents')
                : item.href === '/records/incidents'
                ? pathname.startsWith('/records/incidents') || pathname.startsWith('/incidents')
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

                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Icon
                        className={`h-5 w-5 stroke-[2.25] transition-transform group-hover:scale-110 ${
                          isActive ? item.activeColor : 'text-zinc-400 dark:text-slate-400'
                        }`}
                      />
                      {/* Collapsed view micro status dot */}
                      {isCollapsed && item.href === '/computer-lab' && (
                        <span
                          className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2 ring-surface-1 ${
                            isOperational
                              ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                              : isMaintenance
                              ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                              : 'bg-zinc-400'
                          }`}
                        />
                      )}
                    </div>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {/* Expanded view live status indicator dot */}
                  {!isCollapsed && item.href === '/computer-lab' && (
                    <div className="flex items-center gap-1.5 ml-auto pl-2 shrink-0">
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
                    </div>
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
                        {item.href === '/computer-lab' && (
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                              isOperational
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                                : isMaintenance
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                                : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/25'
                            }`}
                          >
                            {labStatus}
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

          {/* Pending Verification Notice */}
          {isPending && (
            <li className="pt-2 mt-2 border-t border-border-subtle">
              {!isCollapsed ? (
                <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono font-semibold">
                    <Clock className="h-4 w-4 stroke-[2.25] text-amber-500" />
                    <span>In-Review</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Pending</span>
                </div>
              ) : (
                <div
                  className="mx-auto p-2 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20"
                  title="Account Pending Verification"
                >
                  <Clock className="h-5 w-5 stroke-[2.25] animate-pulse" />
                </div>
              )}
            </li>
          )}

          {/* Faculty Profile & Preferences Link (Prominently placed above Super Admin Control) */}
          {!isPending && (
            <li className="pt-2 mt-2 border-t border-border-subtle relative group">
              <Link
                href="/profile"
                className={`flex items-center px-3 py-2.5 text-xs font-medium rounded-xl transition-all relative ${
                  isCollapsed ? 'justify-center' : 'justify-between'
                } ${
                  pathname === '/profile'
                    ? 'bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent text-indigo-950 dark:text-indigo-200 font-bold border border-indigo-500/30 shadow-xs'
                    : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/70 dark:hover:bg-surface-2'
                }`}
              >
                {pathname === '/profile' && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400 shadow-sm shadow-indigo-500/50" />
                )}

                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCheck
                    className={`h-5 w-5 shrink-0 stroke-[2.25] transition-transform group-hover:scale-110 ${
                      pathname === '/profile'
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-400 dark:text-slate-400'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Profile & Preferences</span>}
                </div>
              </Link>

              {isCollapsed && (
                <div className="absolute left-[calc(100%+14px)] top-1/2 -translate-y-1/2 px-3 py-2 bg-white/95 dark:bg-surface-1/95 text-zinc-900 dark:text-white rounded-xl border border-zinc-200 dark:border-border-card shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-3 backdrop-blur-md">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold font-heading">Profile & Preferences</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-400 font-mono">
                      Faculty Assignments & Settings
                    </span>
                  </div>
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-surface-1 border-l border-b border-zinc-200 dark:border-border-card rotate-45 rounded-xs" />
                </div>
              )}
            </li>
          )}

          {/* Super Admin Control Link & 4 Modular Sub-Tabs */}
          {isSuperAdmin && !isPending && (
            <li className="pt-1.5 relative group">
              <div
                className={`flex items-center px-3 py-2 text-xs font-medium rounded-xl transition-all relative ${
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

                <Link href="/admin" className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Shield className="h-5 w-5 shrink-0 stroke-[2.25] text-amber-500 group-hover:scale-110 transition-transform" />
                  {!isCollapsed && <span className="truncate">Super Admin Control</span>}
                </Link>

                {!isCollapsed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setIsAdminExpanded((prev) => !prev)
                    }}
                    title={isAdminExpanded ? 'Collapse Admin Modules' : 'Expand Admin Modules'}
                    className="p-1 rounded-md hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 cursor-pointer transition-transform"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isAdminExpanded ? 'rotate-180' : 'rotate-0'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Tooltip for Super Admin Main Icon in Collapsed Mode */}
              {isCollapsed && (
                <div className="absolute left-[calc(100%+14px)] top-2 px-3 py-2 bg-white/95 dark:bg-surface-1/95 text-zinc-900 dark:text-white rounded-xl border border-zinc-200 dark:border-border-card shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 whitespace-nowrap flex items-center gap-3 backdrop-blur-md">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold font-heading">Super Admin Control</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-400 font-mono">
                      Institutional Root Administration
                    </span>
                  </div>
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-surface-1 border-l border-b border-zinc-200 dark:border-border-card rotate-45 rounded-xs" />
                </div>
              )}

              {/* Sub-Navigation Modules for Super Admin (Directly accessible in both collapsed & expanded modes) */}
              <Suspense fallback={null}>
                <AdminSubTreeInner
                  isCollapsed={isCollapsed}
                  isAdminExpanded={isAdminExpanded}
                  pathname={pathname}
                />
              </Suspense>
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
            <LogOut className="h-5 w-5 shrink-0 stroke-[2.25]" />
            {!isCollapsed && <span className="ml-3 truncate">Sign Out Session</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
