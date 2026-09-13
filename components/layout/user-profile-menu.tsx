'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield,
  UserCheck,
  LogOut,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Plus,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { UserRole, UserProfile } from '@/lib/permissions'

interface UserProfileMenuProps {
  profile: UserProfile | null
}

export default function UserProfileMenu({ profile }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const role: UserRole = profile?.role || 'teacher'
  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'LA'

  // Distinct styling configurations tailored to each profile type
  const roleConfig = {
    super_admin: {
      label: 'Super Admin',
      sublabel: 'Tier-1 Root Administrator',
      icon: '👑',
      tagBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
      avatarRing: 'ring-2 ring-amber-500/80 shadow-md shadow-amber-500/20',
      avatarBg: 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-white',
      accentText: 'text-amber-600 dark:text-amber-400',
      quickActionHref: '/admin',
      quickActionLabel: 'Open Super-Admin Center',
    },
    lab_incharge: {
      label: 'Lab Incharge',
      sublabel: 'Laboratory Facilities Manager',
      icon: '🔬',
      tagBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      avatarRing: 'ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/20',
      avatarBg: 'bg-gradient-to-tr from-indigo-600 to-blue-500 text-white',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      quickActionHref: '/maintenance',
      quickActionLabel: 'Lab Maintenance Workbench',
    },
    hod: {
      label: 'Head of Department',
      sublabel: 'Academic & Incident Escalations',
      icon: '🏛️',
      tagBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      avatarRing: 'ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/20',
      avatarBg: 'bg-indigo-700 text-white',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      quickActionHref: '/incidents',
      quickActionLabel: 'Review Escalated Matters',
    },
    teacher: {
      label: 'Teacher',
      sublabel: 'Academic Practical Instructor',
      icon: '👨‍🏫',
      tagBadge: 'bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-700/60',
      avatarRing: 'ring-2 ring-zinc-300 dark:ring-slate-700 shadow-md',
      avatarBg: 'bg-zinc-700 dark:bg-slate-800 text-white',
      accentText: 'text-zinc-700 dark:text-slate-300',
      quickActionHref: '/logs/new',
      quickActionLabel: 'Log Practical Session',
    },
  }[role]

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 cursor-pointer group"
      >
        <div className="text-right hidden sm:block">
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
            {profile?.full_name || 'Academic Staff'}
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] font-mono font-bold">
            <span className={roleConfig.accentText}>
              {roleConfig.icon} {roleConfig.label}
            </span>
          </div>
        </div>

        {/* Customized Avatar Ring */}
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-105 ${roleConfig.avatarRing} ${roleConfig.avatarBg}`}
        >
          {initials}
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
          {/* Top Profile Banner */}
          <div className="flex items-start gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 ${roleConfig.avatarRing} ${roleConfig.avatarBg}`}
            >
              {initials}
            </div>
            <div className="space-y-0.5 overflow-hidden">
              <div className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                {profile?.full_name || 'Faculty Member'}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {profile?.email || 'staff@rrl.edu.np'}
              </div>
              <div className="pt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${roleConfig.tagBadge}`}
                >
                  <span>{roleConfig.icon}</span>
                  <span>{roleConfig.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Assigned Role & Facility Scope */}
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1 text-xs">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 uppercase">
              <span>Facility Scope</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Session
              </span>
            </div>
            <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              <span className="truncate">
                {role === 'super_admin'
                  ? 'Institutional Root Administration'
                  : role === 'lab_incharge'
                  ? 'All Academic Computer & Science Labs'
                  : role === 'hod'
                  ? 'Academic & Incident Oversight'
                  : 'Assigned Curriculum Labs & Batches'}
              </span>
            </div>
          </div>

          {/* Quick Role Shortcut */}
          <div>
            <Link
              href={roleConfig.quickActionHref}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <span>{roleConfig.quickActionLabel}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Sign Out Action */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out of Terminal</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
