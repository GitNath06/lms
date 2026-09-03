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
  Shield,
  Clock,
  X,
  Sparkles,
  Wrench,
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
    // Audio autoplay restrictions or headless env
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

export default function NotificationBell() {
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

        // Auto-dismiss toast after 8 seconds
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

  const hasCriticalUnread = useMemo(() => {
    return notifications.some((n) => !n.is_read && n.severity === 'critical')
  }, [notifications])

  const criticalCount = useMemo(() => {
    return notifications.filter((n) => n.severity === 'critical').length
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.is_read)
    }
    if (activeTab === 'critical') {
      return notifications.filter((n) => n.severity === 'critical')
    }
    return notifications
  }, [notifications, activeTab])

  const handleReviewAndManage = (notif: LabNotificationRecord) => {
    // Mark as read
    if (!notif.is_read) {
      markAsRead(notif.id)
    }
    // Close notification panel
    setIsOpen(false)
    setLiveToast(null)

    // Locate matching incident
    const foundInc = incidents.find((i) => i.id === notif.incident_id)
    if (foundInc) {
      setActiveIncidentForReview(foundInc)
      setIsIncidentDrawerOpen(true)
    } else {
      // If not found directly, navigate to /incidents
      window.location.href = `/incidents?focusId=${notif.incident_id || ''}`
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Header Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 cursor-pointer"
        title="Incident Alerts & Notifications"
      >
        <Bell className="h-4 w-4" />

        {mounted && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold shadow-xs">
            {hasCriticalUnread && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span className="relative z-10">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {/* 🚀 Real-time Toast Pop-up Banner for Newly Reported Incident */}
      {liveToast && (
        <div className="fixed top-20 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-zinc-950 text-white p-4 shadow-2xl border border-rose-500/40 animate-in slide-in-from-top-4 duration-300 font-mono">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <AlertOctagon className="h-4 w-4" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-400 tracking-wider">
                  New Incident Reported
                </span>
                <h4 className="text-xs font-bold text-white truncate max-w-[220px]">
                  {liveToast.incident.title}
                </h4>
              </div>
            </div>

            <button
              onClick={() => setLiveToast(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-300 font-sans mt-2 line-clamp-2">
            {liveToast.incident.lab_id.toUpperCase()} Lab • {liveToast.incident.batch_name} • By{' '}
            {liveToast.incident.subject_teacher_name}
          </p>

          <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">
              Urgency: <strong className="text-rose-400 uppercase">{liveToast.incident.severity.replace('_', ' ')}</strong>
            </span>
            <Button
              size="sm"
              onClick={() => handleReviewAndManage(liveToast.notif)}
              className="h-7 px-3 bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold gap-1 shadow-xs"
            >
              <span>Review & Manage</span>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* 📬 Notification Feed Drawer / Popover Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-84 sm:w-[420px] rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200/90 dark:border-zinc-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 font-mono">
          {/* Header */}
          <div className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                  Incident & Damage Feed
                </h3>
                <span className="text-[10px] text-zinc-500 font-sans">
                  Real-time broadcast to Admin, In-Charge & HOD
                </span>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* 3 Filter Tabs */}
          <div className="p-2 px-4 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/40 dark:bg-zinc-900/40 flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg transition-all text-xs font-bold ${
                activeTab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              All ({notifications.length})
            </button>

            <button
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1 rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('critical')}
              className={`px-3 py-1 rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 ${
                activeTab === 'critical'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <span>Critical</span>
              {criticalCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] font-bold border border-rose-500/30">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 font-mono space-y-1">
                <Check className="h-6 w-6 text-emerald-500 mx-auto opacity-75" />
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  {activeTab === 'unread'
                    ? 'All Caught Up!'
                    : activeTab === 'critical'
                    ? 'No Critical Hazards'
                    : 'No Notifications'}
                </p>
                <p className="text-[10px] text-zinc-400 font-sans">
                  {activeTab === 'unread'
                    ? 'You have read all incident notifications.'
                    : 'All lab facilities operating safely.'}
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
                    className={`p-4 transition-colors flex flex-col gap-2.5 ${
                      !n.is_read
                        ? 'bg-rose-50/20 dark:bg-rose-950/10'
                        : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    {/* Top Row: Urgency Tag + Target Role + Timestamp */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Urgency Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase ${
                            isCritical
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : isWarning
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isCritical ? '🚨 High / Critical' : isWarning ? '⚠️ Moderate' : 'ℹ️ Minor'}
                        </span>

                        {/* Target Role Tag */}
                        <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-mono font-semibold uppercase">
                          {n.target_role === 'hod'
                            ? 'HOD Directive'
                            : n.target_role === 'lab_incharge'
                            ? 'Lab In-Charge'
                            : 'Super Admin'}
                        </span>

                        {/* Target Lab Facility Tag */}
                        {n.target_lab_id && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                              isChem
                                ? 'text-rose-600 dark:text-rose-400'
                                : isPhys
                                ? 'text-cyan-600 dark:text-cyan-400'
                                : isComp
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-zinc-500'
                            }`}
                          >
                            {n.target_lab_id.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] text-zinc-400 font-mono shrink-0 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimeAgo(n.created_at)}
                      </span>
                    </div>

                    {/* Middle: Title & Message */}
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-zinc-950 dark:text-white leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Bottom Action Row */}
                    <div className="pt-1.5 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/50">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReviewAndManage(n)}
                        className="h-6 px-2.5 text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1"
                      >
                        <Wrench className="h-2.5 w-2.5" />
                        <span>Review & Manage</span>
                        <ChevronRight className="h-2.5 w-2.5" />
                      </Button>

                      {!n.is_read ? (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] text-zinc-400 hover:text-emerald-500 flex items-center gap-1 cursor-pointer font-mono"
                          title="Mark read"
                        >
                          <Check className="h-3 w-3" />
                          <span>Mark read</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-zinc-400 font-mono flex items-center gap-0.5">
                          <CheckCheck className="h-3 w-3 text-emerald-500" /> Read
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 px-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-500">Physics, Chem & Comp Labs</span>
            <Link
              href="/incidents"
              onClick={() => setIsOpen(false)}
              className="text-rose-600 dark:text-rose-400 hover:underline font-bold text-[11px] flex items-center gap-1 font-mono"
            >
              <span>Incident & Damage Hub</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
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
          userRole="lab_incharge"
        />
      )}
    </div>
  )
}
