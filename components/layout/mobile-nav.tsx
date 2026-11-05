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
  Monitor,
  Users,
  BookOpen,
  Building2,
  Clock,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { useAcademicYear } from '@/lib/context/academic-year-context'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useLiveSchedule } from '@/hooks/use-live-schedule'
import CloudSyncStatus from '@/components/layout/cloud-sync-status'

interface MobileNavProps {
  isSuperAdmin: boolean
  canAccessMaintenance?: boolean
  isPending?: boolean
  profileName?: string
  roleLabel?: string
  roleColor?: string
}

const ADMIN_SUB_MODULES = [
  { key: 'identity', label: 'Identity & Access', href: '/admin?tab=identity', icon: Users },
  { key: 'curriculum', label: 'Academic Curriculum', href: '/admin?tab=curriculum', icon: BookOpen },
  { key: 'facilities', label: 'Facilities & Safety', href: '/admin?tab=facilities', icon: Building2 },
  { key: 'operations', label: 'Operations & Backup', href: '/admin?tab=operations', icon: Calendar },
]

export default function MobileNav({
  isSuperAdmin,
  canAccessMaintenance = true,
  isPending = false,
  profileName = 'Staff Member',
  roleLabel = 'Teacher',
  roleColor = 'text-emerald-500',
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { systemActiveYearName, userViewingYear, isViewingArchived } = useAcademicYear()
  const { labs } = useInfrastructureState()

  const { activePeriodName, activeSlotId, timeString } = useLiveSchedule()

  const compLab = labs?.find((l) => l.id === 'comp' || l.type === 'computer_lab')
  const labStatus = compLab?.status || 'Operational'
  const isOperational = labStatus === 'Operational' && compLab?.is_active !== false
  const isMaintenance = labStatus === 'Under Maintenance'

  const navItems = isPending
    ? [{ label: 'Faculty Profile', href: '/profile', icon: UserCheck }]
    : [
        { label: 'Dashboard', href: '/', icon: LayoutDashboard },
        { label: 'Lab Timetable', href: '/schedules', icon: Calendar },
        { label: 'Practical Logbook', href: '/records', icon: ClipboardList },
        { label: 'Incidents & Repairs', href: '/records/incidents', icon: AlertTriangle },
        { label: 'Floor Plan', href: '/computer-lab', icon: Monitor },
        ...(canAccessMaintenance
          ? [
              {
                label: 'Lab Diagnostics & Maintenance',
                href: '/maintenance',
                icon: Wrench,
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

          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-zinc-900 h-full shadow-2xl border-r border-zinc-200 dark:border-zinc-800 p-5 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-indigo-500/20">
                    <FlaskConical className="h-5 w-5 stroke-[2.25]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white font-mono">
                      LabSync LIMS
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {isViewingArchived ? `Archived (${userViewingYear} B.S.)` : `Academic Session ${systemActiveYearName}`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Snippet */}
              <div className="p-3 my-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800">
                <div className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {profileName}
                </div>
                <div className={`text-[10px] font-mono font-bold mt-0.5 ${roleColor}`}>
                  {roleLabel}
                </div>
              </div>

              {/* Secondary Status & Telemetry (Condensed from Mobile Header) */}
              <div className="p-3 mb-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] font-sans font-medium text-zinc-500 dark:text-zinc-400">
                    Live Period
                  </span>
                  {activeSlotId ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-heading font-extrabold tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {activePeriodName.toUpperCase()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-heading font-semibold text-zinc-600 dark:text-slate-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      OFF-HOURS
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{timeString}</span>
                  </div>
                  <CloudSyncStatus />
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
                      <Icon className="h-5 w-5 stroke-[2.25]" />
                      <span>{item.label}</span>
                      {item.href === '/computer-lab' && (
                        <span
                          className={`ml-auto h-2.5 w-2.5 rounded-full ${
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
                  )
                })}

                {/* Profile & Preferences Link for All Verified Users (Placed above Super Admin Control) */}
                {!isPending && (
                  <div className="pt-1.5 mt-1.5 border-t border-zinc-200/70 dark:border-zinc-800">
                    <Link
                      href="/profile"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${
                        pathname === '/profile'
                          ? 'bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 font-bold border-l-2 border-indigo-600'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <UserCheck className="h-5 w-5 stroke-[2.25] text-indigo-500" />
                      <span>Profile & Preferences</span>
                    </Link>
                  </div>
                )}

                {/* Super Admin Control with 4 Sub-Navigation Modules */}
                {isSuperAdmin && !isPending && (
                  <div className="pt-1.5">
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl transition-all ${
                        pathname.startsWith('/admin')
                          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold border-l-2 border-amber-500'
                          : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                      }`}
                    >
                      <Shield className="h-5 w-5 stroke-[2.25] text-amber-500" />
                      <span>Super Admin Control</span>
                    </Link>

                    {/* Mobile Admin Sub-Modules without numbering */}
                    <div className="ml-4 pl-3 my-1 border-l-2 border-amber-500/25 space-y-0.5">
                      {ADMIN_SUB_MODULES.map((sub) => {
                        const SubIcon = sub.icon
                        return (
                          <Link
                            key={sub.key}
                            href={sub.href}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <SubIcon className="h-4 w-4 stroke-[2.25] text-zinc-400" />
                            <span className="truncate">{sub.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </nav>
            </div>

            {/* Sign Out */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center w-full px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="mr-2.5 h-5 w-5 stroke-[2.25]" />
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
