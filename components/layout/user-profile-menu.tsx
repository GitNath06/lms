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
  Camera,
  Trash2,
  Loader2,
  Crown,
  Microscope,
  Landmark,
  GraduationCap,
  Clock,
} from 'lucide-react'
import { signOut, updateCurrentUserPhoto } from '@/app/actions/auth'
import { purgeAllOfflineData } from '@/lib/offline/offline-store'
import { UserRole, UserProfile } from '@/lib/permissions'
import { compressAvatar } from '@/lib/student-photos/compressor'
import { cn } from '@/lib/utils'

interface UserProfileMenuProps {
  profile: UserProfile | null
}

export default function UserProfileMenu({ profile }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.photo_url || profile?.avatar_url || null)
  const [isUploading, setIsUploading] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true) // Deterministic true on SSR & initial client render (0 hydration mismatch!)
  const menuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    setPhotoUrl(profile?.photo_url || profile?.avatar_url || null)
  }, [profile?.photo_url, profile?.avatar_url])

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setFeedbackMsg(null)
    try {
      const compressed = await compressAvatar(file, 256, 0.75)
      const res = await updateCurrentUserPhoto(compressed.dataUrl)
      if (res.success) {
        setPhotoUrl(compressed.dataUrl)
        setFeedbackMsg('Photo updated!')
        setTimeout(() => setFeedbackMsg(null), 3000)
      } else {
        setFeedbackMsg(res.error || 'Failed to update photo')
        setTimeout(() => setFeedbackMsg(null), 4000)
      }
    } catch (err: any) {
      setFeedbackMsg(err?.message || 'Compression failed')
      setTimeout(() => setFeedbackMsg(null), 4000)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    setIsUploading(true)
    try {
      const res = await updateCurrentUserPhoto(null)
      if (res.success) {
        setPhotoUrl(null)
        setFeedbackMsg('Photo removed')
        setTimeout(() => setFeedbackMsg(null), 3000)
      }
    } finally {
      setIsUploading(false)
    }
  }

  // Distinct styling configurations tailored to each profile type
  const roleConfig = {
    super_admin: {
      label: 'Super Admin',
      sublabel: 'Tier-1 Root Administrator',
      Icon: Crown,
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
      Icon: Microscope,
      tagBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      avatarRing: 'ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/20',
      avatarBg: 'bg-gradient-to-tr from-indigo-600 to-blue-500 text-white',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      quickActionHref: '/maintenance',
      quickActionLabel: 'Diagnostics & Maintenance',
    },
    hod: {
      label: 'Head of Department',
      sublabel: 'Academic & Incident Escalations',
      Icon: Landmark,
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
      Icon: GraduationCap,
      tagBadge: 'bg-zinc-100 dark:bg-slate-800 text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-700/60',
      avatarRing: 'ring-2 ring-zinc-300 dark:ring-slate-700 shadow-md',
      avatarBg: 'bg-zinc-700 dark:bg-slate-800 text-white',
      accentText: 'text-zinc-700 dark:text-slate-300',
      quickActionHref: '/records/new',
      quickActionLabel: 'Log Practical Session',
    },
  }[role]

  const isPending = profile?.approval_status === 'pending'
  const activeRoleConfig = isPending
    ? {
        label: 'Pending Verification',
        sublabel: 'Awaiting Administrator Review',
        Icon: Clock,
        tagBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        avatarRing: 'ring-2 ring-amber-500/80 shadow-md shadow-amber-500/20',
        avatarBg: 'bg-gradient-to-tr from-amber-600 to-amber-500 text-white',
        accentText: 'text-amber-600 dark:text-amber-400',
        quickActionHref: '/',
        quickActionLabel: 'Read-Only Mode',
      }
    : roleConfig

  return (
    <div className="relative" ref={menuRef}>
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
      />

      {/* Trigger Button (Clean, no unnecessary arrow, robust clickable surface) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl hover:bg-zinc-100/90 dark:hover:bg-zinc-800/80 transition-all cursor-pointer group shrink-0"
        aria-label="User Profile Menu"
        aria-expanded={isOpen}
      >
        {/* Inside the user name + role text column next to the avatar (hidden xl:flex saves 170px between 768px-1279px!) */}
        <div className="hidden xl:flex flex-col items-end justify-center leading-tight mr-1">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
            {profile?.full_name || 'Academic Staff'}
          </span>
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap', activeRoleConfig.accentText)}>
            <activeRoleConfig.Icon className="h-3 w-3 shrink-0" />
            <span>{activeRoleConfig.label}</span>
            <span
              title={isOnline ? 'Online & Connected' : 'Offline Mode'}
              className={cn(
                'inline-block h-2 w-2 rounded-full shrink-0 transition-colors duration-300',
                isOnline
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.85)]'
                  : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.85)]'
              )}
            />
          </span>
        </div>

        {/* Clean Avatar Ring with ZERO dot covering the photo */}
        <div className="relative shrink-0">
          <div
            className={`h-9 w-9 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-105 shadow-md ${activeRoleConfig.avatarRing} ${activeRoleConfig.avatarBg}`}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile?.full_name || 'Staff Profile'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-bold text-white tracking-wider">{initials}</span>
            )}
          </div>
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-4 space-y-3 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
          {/* Top Profile Banner */}
          <div className="flex items-start gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            {/* Avatar with Camera Trigger */}
            <div className="relative group/avatar shrink-0">
              <div
                className={`h-12 w-12 rounded-2xl overflow-hidden flex items-center justify-center text-sm font-bold shadow-md ${activeRoleConfig.avatarRing} ${activeRoleConfig.avatarBg}`}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={profile?.full_name || 'Staff'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                title="Change Profile Picture"
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-transform hover:scale-110 cursor-pointer"
              >
                {isUploading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </button>
            </div>

            <div className="space-y-0.5 overflow-hidden flex-1">
              <div className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                {profile?.full_name || 'Faculty Member'}
              </div>
              <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {profile?.email || 'staff@rrl.edu.np'}
              </div>
              <div className="pt-0.5 flex items-center justify-between gap-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border',
                    activeRoleConfig.tagBadge
                  )}
                >
                  <activeRoleConfig.Icon className="h-3 w-3 shrink-0" />
                  <span>{activeRoleConfig.label}</span>
                  <span
                    title={isOnline ? 'Online & Connected' : 'Offline Mode'}
                    className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full shrink-0 transition-colors duration-300',
                      isOnline
                        ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.85)]'
                        : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.85)]'
                    )}
                  />
                </span>
                {photoUrl && !isUploading && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-[9px] text-zinc-400 hover:text-rose-500 transition-colors font-mono cursor-pointer"
                    title="Remove Photo"
                  >
                    Remove
                  </button>
                )}
              </div>
              {feedbackMsg && (
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pt-0.5">
                  {feedbackMsg}
                </div>
              )}
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
                {isPending
                  ? 'Awaiting Administrator Facility Assignment'
                  : role === 'super_admin'
                  ? 'Institutional Root Administration'
                  : role === 'lab_incharge'
                  ? 'All Academic Computer & Science Labs'
                  : role === 'hod'
                  ? 'Academic & Incident Oversight'
                  : 'Assigned Curriculum Labs & Batches'}
              </span>
            </div>
          </div>

          {/* Database Live Telemetry Row */}
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex rounded-full h-2 w-2',
                    isOnline
                      ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]'
                      : 'bg-amber-500 shadow-[0_0_6px_#F59E0B]'
                  )}
                />
              </span>
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                {isOnline
                  ? 'Database: Supabase Live (Connected)'
                  : 'Database: Offline Mode (Local Cache)'}
              </span>
            </div>
            <span
              className={cn(
                'text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border',
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              )}
            >
              {isOnline ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Quick Role Shortcut */}
          <div className="space-y-1.5">
            <Link
              href={activeRoleConfig.quickActionHref}
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <span>{activeRoleConfig.quickActionLabel}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                <span>Profile & Preferences</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-zinc-400" />
            </Link>
          </div>

          {/* Sign Out Action */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <form action={signOut}>
              <button
                type="submit"
                onClick={async () => {
                  try {
                    await purgeAllOfflineData()
                  } catch {}
                }}
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
