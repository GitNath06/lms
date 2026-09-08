'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Clock,
  X,
  Sparkles,
  Wrench,
  Radio,
  SlidersHorizontal,
} from 'lucide-react'
import { useIncidentState, LabIncidentRecord, LabNotificationRecord } from '@/hooks/use-incident-state'
import IncidentDrawer from '@/components/dashboard/incident-drawer'
import { Button } from '@/components/ui/button'

function playNotificationChime() {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Tone 1 (523.25 Hz - C5)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(523.25, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.28)

    // Tone 2 (659.25 Hz - E5)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, now + 0.12)
    gain2.gain.setValueAtTime(0.14, now + 0.12)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.42)
  } catch (e) {
    // Audio restrictions
  }
}

function formatTimeAgo(isoStr: string): string {
  try {
    const date = new Date(isoStr)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSec < 45) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

interface NotificationBellProps {
  currentUserRole?: string
  currentUserName?: string
}

export default function NotificationBell({
  currentUserRole = 'teacher',
  currentUserName,
}: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, incidents } = useIncidentState()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical'>('all')

  // Toast banner for newly broadcast incident
  const [liveToast, setLiveToast] = useState<{
    incident: LabIncidentRecord
    notif: LabNotificationRecord
  } | null>(null)

  // Incident Drawer state for "Review & Manage"
  const [activeIncidentForReview, setActiveIncidentForReview] = useState<LabIncidentRecord | null>(null)
  const [isIncidentDrawerOpen, setIsIncidentDrawerOpen] = useState<boolean>(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    // Listen to real-time incident broadcasts
    const handleBroadcast = (e: Event) => {
      const customEvt = e as CustomEvent<{
        incident: LabIncidentRecord
        notifs: LabNotificationRecord[]
      }>
      if (customEvt.detail && customEvt.detail.incident) {
        playNotificationChime()
        setLiveToast({
          incident: customEvt.detail.incident,
          notif: customEvt.detail.notifs[0],
        })

        setTimeout(() => {
          setLiveToast(null)
        }, 8000)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('new-incident-broadcast', handleBroadcast)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('new-incident-broadcast', handleBroadcast)
    }
  }, [])

  // 🎯 Logically filter notifications based on the user's role and identity
  const userNotifications = useMemo(() => {
    const role = currentUserRole || 'teacher'
    return notifications.filter((notif) => {
      if (role === 'super_admin') return true

      if (role === 'hod') {
        return notif.target_role === 'hod' || notif.severity === 'critical' || notif.title.includes('HOD')
      }

      if (role === 'lab_incharge') {
        return (
          notif.target_role === 'lab_incharge' ||
          notif.target_role === 'all' ||
          notif.severity === 'warning' ||
          notif.severity === 'critical'
        )
      }

      if (role === 'teacher') {
        if (notif.target_role === 'teacher') return true
        const matchingInc = incidents.find((i) => i.id === notif.incident_id)
        if (
          matchingInc &&
          currentUserName &&
          (matchingInc.reported_by?.toLowerCase().includes(currentUserName.toLowerCase()) ||
            matchingInc.subject_teacher_name?.toLowerCase().includes(currentUserName.toLowerCase()))
        ) {
          return true
        }
        return false
      }

      return true
    })
  }, [notifications, currentUserRole, currentUserName, incidents])

  const userUnreadCount = useMemo(() => {
    return userNotifications.filter((n) => !n.is_read).length
  }, [userNotifications])

  const hasCriticalUnread = useMemo(() => {
    return userNotifications.some((n) => !n.is_read && n.severity === 'critical')
  }, [userNotifications])

  const criticalCount = useMemo(() => {
    return userNotifications.filter((n) => n.severity === 'critical').length
  }, [userNotifications])

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return userNotifications.filter((n) => !n.is_read)
    }
    if (activeTab === 'critical') {
      return userNotifications.filter((n) => n.severity === 'critical')
    }
    return userNotifications
  }, [userNotifications, activeTab])

  const handleReviewAndManage = (notif: LabNotificationRecord) => {
    if (!notif.is_read) {
      markAsRead(notif.id)
    }
    setIsOpen(false)
    setLiveToast(null)

    if (notif.title.includes('Registration') || notif.message.includes('approval') || notif.message.includes('registered')) {
      window.location.href = '/admin'
      return
    }

    const foundInc = incidents.find((i) => i.id === notif.incident_id)
    if (foundInc) {
      setActiveIncidentForReview(foundInc)
      setIsIncidentDrawerOpen(true)
    } else {
      window.location.href = `/incidents?focusId=${notif.incident_id || ''}`
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Header Bell Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer shadow-2xs"
        title="Notification Panel"
      >
        <Bell className="h-4.5 w-4.5" />

        {mounted && userUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-mono text-[10px] font-bold shadow-md shadow-rose-500/40">
            {hasCriticalUnread && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span className="relative z-10">{userUnreadCount > 9 ? '9+' : userUnreadCount}</span>
          </span>
        )}
      </button>

      {/* 🚀 Real-time Toast Pop-up Banner for Newly Reported Incident */}
      {liveToast && (
        <div className="fixed top-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950 text-white p-4 shadow-2xl border border-rose-500/50 animate-in slide-in-from-top-4 duration-300 font-sans">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                <AlertOctagon className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase text-rose-400 tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  New Incident Reported
                </span>
                <h4 className="text-sm font-bold text-white truncate max-w-[220px] mt-0.5">
                  {liveToast.incident.title}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setLiveToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-zinc-300 mt-2 line-clamp-2 leading-relaxed">
            {liveToast.incident.lab_id.toUpperCase()} Lab • {liveToast.incident.batch_name} • Reported by{' '}
            <strong className="text-white">{liveToast.incident.subject_teacher_name}</strong>
          </p>

          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Severity: <strong className="text-rose-400 uppercase font-semibold">{liveToast.incident.severity.replace('_', ' ')}</strong>
            </span>
            <Button
              size="sm"
              onClick={() => handleReviewAndManage(liveToast.notif)}
              className="h-8 px-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-medium text-xs gap-1.5 shadow-md shadow-rose-500/20"
            >
              <span>Review & Manage</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 📬 Premium Notification Feed Drawer / Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-88 sm:w-[440px] rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/90 dark:border-zinc-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 font-sans">
          {/* Header */}
          <div className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-gradient-to-b from-zinc-50/90 to-white dark:from-zinc-950/80 dark:to-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                    Notification Panel
                  </h3>
                  {userUnreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
                      {userUnreadCount} New
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Filtered for {currentUserRole.replace('_', ' ').toUpperCase()} role
                </p>
              </div>
            </div>

            {userUnreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* 3 Modern Segmented Filter Tabs */}
          <div className="p-2.5 px-4 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded-md bg-zinc-700/30 dark:bg-zinc-200/30 text-[10px] font-mono">
                {userNotifications.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'unread'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>Unread</span>
              {userUnreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {userUnreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('critical')}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'critical'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>Critical</span>
              {criticalCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold border border-rose-500/30">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-2 space-y-2">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                  {activeTab === 'unread'
                    ? 'All Caught Up!'
                    : activeTab === 'critical'
                    ? 'No Critical Notices'
                    : 'No Notifications'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  {activeTab === 'unread'
                    ? 'You have reviewed all notices in your institutional scope.'
                    : 'All laboratory facilities, registrations, and systems are running smoothly.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isCritical = n.severity === 'critical'
                const isWarning = n.severity === 'warning'
                const isPhys = n.target_lab_id?.includes('phys')
                const isChem = n.target_lab_id?.includes('chem')
                const isComp = n.target_lab_id?.includes('comp')

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl transition-all border ${
                      !n.is_read
                        ? 'bg-gradient-to-r from-rose-50/40 via-white to-white dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900 border-rose-200/70 dark:border-rose-900/40 shadow-xs'
                        : 'bg-white dark:bg-zinc-900/60 border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Top Row: Badges & Timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Severity Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : isWarning
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isCritical ? '🚨 Critical' : isWarning ? '⚠️ Warning' : 'ℹ️ Notice'}
                        </span>

                        {/* Facility Badge */}
                        {n.target_lab_id && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              isChem
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                                : isPhys
                                ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/40'
                                : isComp
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            {n.target_lab_id.toUpperCase()} Lab
                          </span>
                        )}

                        {/* Target Role Pill */}
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium uppercase">
                          {n.target_role === 'hod'
                            ? 'HOD'
                            : n.target_role === 'lab_incharge'
                            ? 'In-Charge'
                            : n.target_role === 'teacher'
                            ? 'Teacher'
                            : 'Admin'}
                        </span>
                      </div>

                      {/* Time Ago */}
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="space-y-1 mb-3">
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReviewAndManage(n)}
                        className={`h-7 px-3 text-xs font-semibold gap-1.5 cursor-pointer ${
                          n.title.includes('Registration')
                            ? 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                            : 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        {n.title.includes('Registration') ? (
                          <>
                            <ShieldAlert className="h-3 w-3" />
                            <span>Review Applicant</span>
                          </>
                        ) : (
                          <>
                            <Wrench className="h-3 w-3" />
                            <span>Review & Manage</span>
                          </>
                        )}
                        <ChevronRight className="h-3 w-3" />
                      </Button>

                      {!n.is_read ? (
                        <button
                          type="button"
                          onClick={() => markAsRead(n.id)}
                          className="text-xs text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer font-medium p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Mark this alert as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Mark read</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                          <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> Read
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3.5 px-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time channel active</span>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/incidents"
                onClick={() => setIsOpen(false)}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium text-xs flex items-center gap-1"
              >
                <span>Incidents</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              {currentUserRole === 'super_admin' && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs flex items-center gap-1"
                >
                  <span>Admin Console</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ Direct Incident Resolution Drawer when "Review & Manage" is clicked */}
      {activeIncidentForReview && (
        <IncidentDrawer
          incident={activeIncidentForReview}
          isOpen={isIncidentDrawerOpen}
          onClose={() => {
            setIsIncidentDrawerOpen(false)
            setActiveIncidentForReview(null)
          }}
          userRole={currentUserRole as any || 'teacher'}
        />
      )}
    </div>
  )
}
