'use client'

import React, { useState, useEffect } from 'react'
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const LOGS_OUTBOX_KEY = 'lab_pending_logs_outbox_v1'
const ROUTINE_OUTBOX_KEY = 'lab_pending_schedules_outbox_v1'
const SUB_OUTBOX_KEY = 'lab_pending_teacher_substitutions_outbox_v1'
const INC_OUTBOX_KEY = 'lab_pending_incidents_outbox_v1'

export default function CloudSyncStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const [pendingLogs, setPendingLogs] = useState<number>(0)
  const [pendingSchedules, setPendingSchedules] = useState<number>(0)
  const [pendingSubs, setPendingSubs] = useState<number>(0)
  const [pendingIncidents, setPendingIncidents] = useState<number>(0)

  useEffect(() => {
    // Check all 4 offline outbox queues
    const checkPending = () => {
      try {
        const rawLogs = localStorage.getItem(LOGS_OUTBOX_KEY)
        const parsedLogs = rawLogs ? JSON.parse(rawLogs) : []
        setPendingLogs(Array.isArray(parsedLogs) ? parsedLogs.length : 0)
      } catch {
        setPendingLogs(0)
      }

      try {
        const rawRoutine = localStorage.getItem(ROUTINE_OUTBOX_KEY)
        const parsedRoutine = rawRoutine ? JSON.parse(rawRoutine) : []
        setPendingSchedules(Array.isArray(parsedRoutine) ? parsedRoutine.length : 0)
      } catch {
        setPendingSchedules(0)
      }

      try {
        const rawSub = localStorage.getItem(SUB_OUTBOX_KEY)
        const parsedSub = rawSub ? JSON.parse(rawSub) : []
        setPendingSubs(Array.isArray(parsedSub) ? parsedSub.length : 0)
      } catch {
        setPendingSubs(0)
      }

      try {
        const rawInc = localStorage.getItem(INC_OUTBOX_KEY)
        const parsedInc = rawInc ? JSON.parse(rawInc) : []
        setPendingIncidents(Array.isArray(parsedInc) ? parsedInc.length : 0)
      } catch {
        setPendingIncidents(0)
      }
    }

    checkPending()

    const handleSyncChange = (e: any) => {
      queueMicrotask(() => {
        if (e.detail) {
          if (typeof e.detail.pendingCount === 'number') setPendingLogs(e.detail.pendingCount)
          if (typeof e.detail.pendingSchedulesCount === 'number') setPendingSchedules(e.detail.pendingSchedulesCount)
          if (typeof e.detail.pendingSubstitutionsCount === 'number') setPendingSubs(e.detail.pendingSubstitutionsCount)
          if (typeof e.detail.pendingIncidentsCount === 'number') setPendingIncidents(e.detail.pendingIncidentsCount)
        }
        checkPending()
      })
    }

    window.addEventListener('sync-status-changed', handleSyncChange)

    // Check browser network connectivity
    const handleOnline = () => {
      setIsOnline(true)
      checkPending()
    }
    const handleOffline = () => {
      setIsOnline(false)
      checkPending()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check Supabase connection
    if (!isSupabaseConfigured()) {
      setIsConnected(false)
      return
    }

    try {
      const supabase = createClient()
      supabase
        .from('labs')
        .select('id')
        .limit(1)
        .then(
          ({ error }) => {
            setIsConnected(!error)
          },
          () => {
            setIsConnected(false)
          }
        )

      const channelName = `telemetry-status-${Math.random().toString(36).substring(2, 8)}`
      const channel = supabase.channel(channelName)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          checkPending()
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false)
        }
      })

      return () => {
        supabase.removeChannel(channel)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('sync-status-changed', handleSyncChange)
      }
    } catch {
      setIsConnected(false)
    }
  }, [])

  const totalPending = pendingLogs + pendingSchedules + pendingSubs + pendingIncidents
  const isLive = isOnline && isConnected && totalPending === 0
  const isSyncing = isOnline && totalPending > 0

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all cursor-default select-none ${
          isLive
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40'
            : isSyncing
            ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 hover:border-indigo-500/40'
            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:border-amber-500/40'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {isLive && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          {isSyncing ? (
            <RefreshCw className="h-2.5 w-2.5 animate-spin text-indigo-500" />
          ) : (
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isLive ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          )}
        </span>
        <span className="hidden sm:inline">
          {isLive
            ? 'Supabase Live'
            : isSyncing
            ? `Syncing (${totalPending})`
            : totalPending > 0
            ? `${totalPending} Offline Queue`
            : 'Local Cache'}
        </span>
      </div>

      {/* Popover Tooltip */}
      {isHovered && (
        <div className="absolute top-full right-0 mt-1.5 z-50 w-72 p-3 rounded-xl bg-zinc-900 text-white text-xs shadow-xl border border-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 mb-1.5 font-bold">
            {isLive ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : isSyncing ? (
              <RefreshCw className="h-4 w-4 text-indigo-400 animate-spin" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-400" />
            )}
            <span>
              {isLive
                ? 'Real-Time Sync Active'
                : isSyncing
                ? `Syncing ${totalPending} offline action(s)...`
                : 'Offline Mode (Zero Data Loss)'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
            {isLive
              ? 'All logs, schedules, proxy substitutions, and incident reports are synchronized with Supabase.'
              : isSyncing
              ? `Reconnected. Flushing ${totalPending} action(s) to Supabase...`
              : `${totalPending} action(s) queued locally (${pendingLogs} logs, ${pendingSchedules} schedule slots, ${pendingSubs} proxies, ${pendingIncidents} incidents). Changes will automatically synchronize when you reconnect.`}
          </p>

          {totalPending > 0 && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Stuck or unhandled queue?</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  try {
                    localStorage.removeItem(LOGS_OUTBOX_KEY)
                    localStorage.removeItem(ROUTINE_OUTBOX_KEY)
                    localStorage.removeItem(SUB_OUTBOX_KEY)
                    localStorage.removeItem(INC_OUTBOX_KEY)
                    setPendingLogs(0)
                    setPendingSchedules(0)
                    setPendingSubs(0)
                    setPendingIncidents(0)
                    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { pendingCount: 0, pendingSchedulesCount: 0 } }))
                  } catch {}
                }}
                className="text-[10px] font-bold font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                Dismiss Queue ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
