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
  Calendar,
  User,
  Trash2,
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
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearReadNotifications, incidents } = useIncidentState()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical'>('unread')

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

  // Track previous notification IDs to trigger live chime & toast on incoming real-time notifications
  const prevNotifIdsRef = useRef<Set<string> | null>(null)

  // 🎯 Logically filter notifications based on the user's role and identity
  const userNotifications = useMemo(() => {
    const role = currentUserRole || 'teacher'
    const seen = new Set<string>()
    return notifications.filter((notif) => {
      if (!notif?.id || seen.has(notif.id)) return false

      // Deduplicate by incident_id + target_role so optimistic and server copies don't duplicate
      const dedupKey = notif.incident_id ? `${notif.incident_id}:${notif.target_role}` : notif.id
      if (seen.has(dedupKey)) return false
      seen.add(notif.id)
      seen.add(dedupKey)

      if (role === 'super_admin') {
        return notif.target_role === 'super_admin' || notif.target_role === 'all'
      }

      if (role === 'hod') {
        return notif.target_role === 'hod' || notif.target_role === 'all'
      }

      if (role === 'lab_incharge') {
        return notif.target_role === 'lab_incharge' || notif.target_role === 'all'
      }

      if (role === 'teacher') {
        return notif.target_role === 'teacher' || notif.target_role === 'all'
      }

      return false
    })
  }, [notifications, currentUserRole])

  // Real-time audio chime and toast for incoming notifications
  useEffect(() => {
    if (!mounted) return
    const currentIds = new Set(userNotifications.map((n) => n.id))
    if (prevNotifIdsRef.current !== null) {
      const newItems = userNotifications.filter(
        (n) => !prevNotifIdsRef.current!.has(n.id) && !n.is_read
      )
      if (newItems.length > 0) {
        const latest = newItems[0]
        playNotificationChime()
        const matchingInc = incidents.find((i) => i.id === latest.incident_id)
        setLiveToast({
          incident: matchingInc || {
            id: latest.incident_id || latest.id,
            title: latest.title,
            severity: latest.severity === 'critical' ? 'major_critical' : latest.severity === 'warning' ? 'moderate' : 'minor',
            lab_id: latest.target_lab_id || 'comp',
            reported_by: 'Lab System',
            status: latest.severity === 'critical' ? 'escalated_to_hod' : 'reported',
            incident_type: 'breakage',
            equipment_name: latest.title,
            created_at: latest.created_at,
            date: latest.created_at.split('T')[0],
            session_label: 'Live Alert',
            subject_name: 'Practical Lab',
            subject_teacher_name: 'Staff',
            batch_name: 'Lab Cohort',
            circumstances: latest.message,
            quantity: 1,
            escalated_to_hod: latest.severity === 'critical',
          },
          notif: latest,
        })
        setTimeout(() => {
          setLiveToast(null)
        }, 8000)
      }
    }
    prevNotifIdsRef.current = currentIds
  }, [userNotifications, mounted, incidents])

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

    // Direct action URL from notification metadata
    if (notif.metadata?.action_url) {
      window.location.href = notif.metadata.action_url
      return
    }

    // Timetable slot booking requests
    if (
      notif.title.includes('Slot') ||
      notif.title.includes('Booking') ||
      notif.title.includes('Routine') ||
      notif.metadata?.schedule_id
    ) {
      const schedId = notif.metadata?.schedule_id || notif.incident_id
      window.location.href = schedId ? `/schedules?focusSlotId=${schedId}` : '/schedules'
      return
    }

    // Teacher applicant approvals
    if (
      notif.title.includes('Registration') ||
      notif.message.includes('approval') ||
      notif.message.includes('registered')
    ) {
      window.location.href = '/admin'
      return
    }

    // Workstation & Terminal assistance
    if (
      notif.title.includes('Assistance') ||
      notif.title.includes('Workstation') ||
      notif.message.includes('Terminal') ||
      notif.message.includes('Station')
    ) {
      window.location.href = '/computer-lab'
      return
    }

    // Incidents & Damage reports
    const foundInc = incidents.find((i) => i.id === notif.incident_id)
    if (foundInc) {
      setActiveIncidentForReview(foundInc)
      setIsIncidentDrawerOpen(true)
    } else {
      window.location.href = `/incidents?focusId=${notif.incident_id || ''}`
    }
  }

  const handleClearRead = async () => {
    if (clearReadNotifications) {
      await clearReadNotifications(currentUserRole)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Header Bell Icon Button */}
      <button
        type="button"
        onClick={() => {
          const nextOpen = !isOpen
          setIsOpen(nextOpen)
          if (nextOpen) {
            // Always open to unread tab first (new notifications only)
            setActiveTab('unread')
          }
        }}
        className="relative p-2.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer shadow-2xs"
        title="Notification Panel"
      >
        <Bell className="h-4.5 w-4.5" />

        {mounted && userUnreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold shadow-md shadow-indigo-600/30">
            {hasCriticalUnread && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span className="relative z-10">{userUnreadCount > 99 ? '99+' : userUnreadCount}</span>
          </span>
        )}
      </button>

      {/* 🚀 Real-time Toast Pop-up Banner for Newly Reported Incident */}
      {liveToast && (
        <div className="fixed top-20 right-3 sm:right-6 left-3 sm:left-auto z-[100] w-auto sm:w-96 max-w-full sm:max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950 text-white p-4 shadow-2xl border border-rose-500/50 animate-in slide-in-from-top-4 duration-300 font-sans">
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
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
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
              className="h-8 px-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-medium text-xs gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer"
            >
              <span>Review & Manage</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* 📬 Mobile Backdrop Overlay (Closes on tap outside on mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 sm:hidden animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 📬 Premium Notification Feed Drawer / Popover Panel */}
      {isOpen && (
        <div className="fixed inset-x-2.5 top-[68px] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[420px] w-auto max-w-[calc(100vw-1.25rem)] rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/90 dark:border-zinc-800 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 font-sans">
          {/* Header */}
          <div className="p-3 px-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                    Notifications
                  </h3>
                  {userUnreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold shrink-0">
                      {userUnreadCount} New
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {currentUserRole.replace('_', ' ').toUpperCase()} console
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {userUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead(currentUserRole)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}

              {/* Clear read notifications */}
              {userNotifications.some((n) => n.is_read) && (
                <button
                  type="button"
                  onClick={handleClearRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Clear all read notices"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear read</span>
                </button>
              )}

              {/* Mobile close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="sm:hidden p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Clean Segmented Filter Tabs: New (Default) | All | Critical */}
          <div className="p-1.5 px-3 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/40 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 justify-center px-2.5 py-1 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'unread'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <span>New</span>
              {userUnreadCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                  {userUnreadCount}
                </span>
              ) : (
                <span className="text-[10px] text-zinc-400">0</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 justify-center px-2.5 py-1 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <span>All</span>
              <span className="px-1.5 py-0.2 rounded-md bg-zinc-700/20 dark:bg-zinc-300/20 text-[10px] font-mono">
                {userNotifications.length}
              </span>
            </button>

            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('critical')}
                className={`flex-1 justify-center px-2.5 py-1 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'critical'
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span>Critical</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {criticalCount}
                </span>
              </button>
            )}
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[calc(100dvh-230px)] sm:max-h-[380px] overflow-y-auto p-2 space-y-1.5">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
                  <Check className="h-5 w-5" />
                </div>
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {activeTab === 'unread'
                    ? 'All Caught Up!'
                    : activeTab === 'critical'
                    ? 'No Critical Notices'
                    : 'No Notifications'}
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                  {activeTab === 'unread'
                    ? 'You have reviewed all notices in your scope.'
                    : 'All facilities, registrations, and systems are running smoothly.'}
                </p>
                {activeTab === 'unread' && userNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1 cursor-pointer"
                  >
                    View All History ({userNotifications.length})
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isCritical = n.severity === 'critical'
                const isWarning = n.severity === 'warning'
                const isSlot = n.title.includes('Slot') || n.title.includes('Booking') || Boolean(n.metadata?.schedule_id)
                const isReg = n.title.includes('Registration') || n.message.includes('registered')
                const isTerminal = n.title.includes('Assistance') || n.title.includes('Workstation')

                const IconComp = isSlot
                  ? Calendar
                  : isReg
                  ? User
                  : isTerminal
                  ? Wrench
                  : isCritical
                  ? AlertOctagon
                  : isWarning
                  ? AlertTriangle
                  : Info

                const iconBg = isSlot
                  ? 'bg-indigo-500/10 border-indigo-500/20'
                  : isReg
                  ? 'bg-sky-500/10 border-sky-500/20'
                  : isTerminal
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : isCritical
                  ? 'bg-rose-500/10 border-rose-500/20'
                  : isWarning
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-zinc-500/10 border-zinc-500/20'

                const cleanTitle = n.title.replace(/^(?:🚨|⚠️|⚡|ℹ️)\s*/, '')
                const cleanMessage = (n.message || '').replace(/,?\s*Department:\s*[^)]+/i, '')

                return (
                  <div
                    key={n.id}
                    className={`group p-2.5 rounded-xl transition-all border flex items-start gap-2.5 ${
                      !n.is_read
                        ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200/60 dark:border-indigo-900/40 shadow-2xs'
                        : 'bg-white dark:bg-zinc-900/40 border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Left: Compact Category Icon */}
                    <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                      <IconComp className="h-4 w-4" />
                    </div>

                    {/* Center: Title & Summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 truncate">
                          {cleanTitle}
                        </h4>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 leading-snug mt-0.5">
                        {cleanMessage}
                      </p>

                      {/* Micro Action Row */}
                      <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                        <button
                          type="button"
                          onClick={() => handleReviewAndManage(n)}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer hover:underline"
                        >
                          <span>{isSlot ? 'Review Slot' : isReg ? 'Review Applicant' : 'Review & Manage'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>

                        {!n.is_read ? (
                          <button
                            type="button"
                            onClick={() => markAsRead(n.id)}
                            className="text-[10px] text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors p-0.5"
                            title="Mark as read"
                          >
                            <Check className="h-3 w-3" />
                            <span>Mark read</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                            <CheckCheck className="h-3 w-3 text-emerald-500" />
                            <span>Read</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-2.5 px-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-time Sync</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
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
                  <span>Admin</span>
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
          userRole={(currentUserRole as any) || 'teacher'}
        />
      )}
    </div>
  )
}
