'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, Check, ExternalLink } from 'lucide-react'
import { useIncidentState } from '@/hooks/use-incident-state'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useIncidentState()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
        title="Notifications & Incident Alerts"
      >
        <Bell className="h-4 w-4" />
        {mounted && unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-3 px-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-950/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 font-mono">
                No notifications at this time.
              </div>
            ) : (
              notifications.map((n) => {
                const isCritical = n.severity === 'critical'
                const isWarning = n.severity === 'warning'

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors flex items-start gap-3 ${
                      !n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-950/15' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isCritical
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : isWarning
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {isCritical ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : isWarning ? (
                        <AlertCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Info className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                          {n.title}
                        </h4>
                        <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                          {n.target_role === 'hod'
                            ? 'HOD'
                            : n.target_role === 'lab_incharge'
                            ? 'In-Charge'
                            : 'Admin'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed font-sans">
                        {n.message}
                      </p>
                    </div>

                    {!n.is_read && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        className="p-1 text-zinc-400 hover:text-emerald-500 transition-colors"
                        title="Mark read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
