'use client'

import React, { useState, useEffect } from 'react'
import {
  Monitor,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  PackageX,
  ZapOff,
  MousePointer,
  WifiOff,
  User,
  Clock,
  Send,
  Sparkles,
  Lock,
  RefreshCw,
  Check,
  Hash,
  ShieldCheck,
  ChevronRight,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ThemeToggle from '@/components/ui/theme-toggle'
import { INSTITUTION_NAME } from '@/lib/institution'
import {
  TERMINAL_QUICK_ISSUES,
  type TerminalContextData,
  type TerminalIssueChip,
} from '@/lib/types/terminal'
import {
  submitStudentIssueReport,
  getTerminalContext,
  cancelStudentAssistanceRequest,
} from '@/app/actions/terminal'
import { broadcastSync, subscribeToSync } from '@/lib/sync-bus'
import { TIME_TRAVEL_EVENT, getEffectiveDate } from '@/lib/time-simulator'

interface StudentTerminalViewProps {
  initialData: TerminalContextData
  isSessionAuthenticated?: boolean
}

export function StudentTerminalView({
  initialData,
  isSessionAuthenticated = false,
}: StudentTerminalViewProps) {
  const [data, setData] = useState<TerminalContextData>(initialData)
  const [selectedChip, setSelectedChip] = useState<TerminalIssueChip | null>(null)
  const [customDetails, setCustomDetails] = useState('')
  const [studentName, setStudentName] = useState(data.currentStudent?.studentName || '')
  const [studentRoll, setStudentRoll] = useState(
    data.currentStudent?.rollNumber ? String(data.currentStudent.rollNumber) : ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [cooldown, setCooldown] = useState<number>(0)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clientPairingToken, setClientPairingToken] = useState<string | null>(null)

  // Live anti-spam cooldown decrementer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleCancelRequest = async (issueId: string) => {
    setCancellingId(issueId)
    try {
      const res = await cancelStudentAssistanceRequest(data.stationCode, issueId)
      if (res.success) {
        broadcastSync('assistance', { stationCode: data.stationCode })
        broadcastSync('workstations', { stationCode: data.stationCode })
        const refreshed = await getTerminalContext(data.stationCode, clientPairingToken || undefined)
        if (refreshed.success && refreshed.data) {
          setData(refreshed.data)
        }
      }
    } finally {
      setCancellingId(null)
    }
  }

  // Real-time synchronization
  useEffect(() => {
    let isMounted = true
    let inFlight = false

    const syncTerminalData = async (force: boolean = false) => {
      if (!isMounted || inFlight) return
      if (!force && typeof document !== 'undefined' && document.hidden) return

      inFlight = true
      try {
        const simTime = getEffectiveDate().getTime()
        const res = await getTerminalContext(
          data.stationCode,
          clientPairingToken || undefined,
          undefined,
          simTime
        )
        if (isMounted && res.success && res.data) {
          setData(res.data)
          if (res.data.currentStudent) {
            setStudentName(res.data.currentStudent.studentName)
            setStudentRoll(String(res.data.currentStudent.rollNumber))
          } else {
            setStudentName('')
            setStudentRoll('')
          }
        }
      } catch (err) {
        console.error('Failed to auto-sync terminal context:', err)
      } finally {
        inFlight = false
      }
    }

    syncTerminalData(true)

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        syncTerminalData(true)
      }
    }
    const handleFocus = () => syncTerminalData(true)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    const handleTimeTravel = () => syncTerminalData(true)
    window.addEventListener(TIME_TRAVEL_EVENT, handleTimeTravel)
    const unsubWs = subscribeToSync('workstations', () => syncTerminalData(true))
    const unsubSched = subscribeToSync('schedules', () => syncTerminalData(true))

    const interval = setInterval(() => syncTerminalData(false), 15000)

    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener(TIME_TRAVEL_EVENT, handleTimeTravel)
      unsubWs()
      unsubSched()
      clearInterval(interval)
    }
  }, [data.stationCode, clientPairingToken])

  // Persistent browser pairing token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken =
        localStorage.getItem(`labsync_paired_token_${data.stationCode}`) ||
        localStorage.getItem('labsync_paired_token')
      if (storedToken) {
        setClientPairingToken(storedToken)
      } else if (data.pairingToken) {
        localStorage.setItem(`labsync_paired_token_${data.stationCode}`, data.pairingToken)
        localStorage.setItem('labsync_paired_token', data.pairingToken)
        setClientPairingToken(data.pairingToken)
      }
    }
  }, [data.stationCode, data.pairingToken])

  const handleChipClick = (chip: TerminalIssueChip) => {
    setSelectedChip(chip)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChip) {
      setErrorMessage('Please select a problem category above to request assistance.')
      return
    }

    if (customDetails.trim().length < 10) {
      setErrorMessage(
        'Please describe your specific observations (at least 10 characters) so the instructor can diagnose it.'
      )
      return
    }

    if (cooldown > 0) {
      setErrorMessage(`Anti-spam cooldown active: Please wait ${cooldown}s before submitting another request.`)
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const res = await submitStudentIssueReport({
      stationCode: data.stationCode,
      issueTag: selectedChip.id,
      title: selectedChip.label,
      description: customDetails.trim(),
      studentName: studentName.trim() || undefined,
      studentRoll: studentRoll.trim() || undefined,
      pairingToken: clientPairingToken || data.pairingToken || undefined,
    })

    setIsSubmitting(false)

    if (res.success) {
      setSubmitSuccess(true)
      setCustomDetails('')
      setSelectedChip(null)
      setCooldown(60) // Anti-spam 60s cooldown
      broadcastSync('assistance', { stationCode: data.stationCode })
      broadcastSync('workstations', { stationCode: data.stationCode })
      const refreshed = await getTerminalContext(data.stationCode, clientPairingToken || undefined)
      if (refreshed.success && refreshed.data) {
        setData(refreshed.data)
      }
    } else {
      setErrorMessage(res.error || 'Failed to submit assistance request.')
    }
  }

  // Visual styling dictionary for vibrant tactile problem chips
  const getChipAccent = (id: string, isSelected: boolean) => {
    switch (id) {
      case 'peripherals':
        return {
          icon: <MousePointer className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />,
          bg: isSelected
            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-300'
            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-500 dark:text-indigo-400 group-hover:bg-indigo-500/20',
        }
      case 'no_internet':
        return {
          icon: <WifiOff className="w-5 h-5 text-amber-500 dark:text-amber-400" />,
          bg: isSelected
            ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-300'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400 group-hover:bg-amber-500/20',
        }
      case 'missing_software':
        return {
          icon: <PackageX className="w-5 h-5 text-rose-500 dark:text-rose-400" />,
          bg: isSelected
            ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500 dark:text-rose-400 group-hover:bg-rose-500/20',
        }
      case 'app_freeze':
        return {
          icon: <ZapOff className="w-5 h-5 text-purple-500 dark:text-purple-400 animate-pulse" />,
          bg: isSelected
            ? 'bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-300'
            : 'bg-purple-500/10 border-purple-500/20 text-purple-500 dark:text-purple-400 group-hover:bg-purple-500/20',
        }
      case 'display_issue':
        return {
          icon: <Monitor className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />,
          bg: isSelected
            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-300'
            : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-500 dark:text-cyan-400 group-hover:bg-cyan-500/20',
        }
      default:
        return {
          icon: <HelpCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" />,
          bg: isSelected
            ? 'bg-slate-500/15 border-slate-500 text-slate-600 dark:text-slate-300'
            : 'bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400 group-hover:bg-slate-500/20',
        }
    }
  }

  const charCount = customDetails.trim().length
  const isFormValid = Boolean(selectedChip && charCount >= 10 && cooldown === 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-zinc-900 dark:text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Ambient Lighting Gradient Orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/4 w-[650px] h-[350px] bg-indigo-500/[0.08] dark:bg-indigo-600/[0.12] blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute top-1/2 -right-32 w-[500px] h-[350px] bg-purple-500/[0.05] dark:bg-purple-600/[0.08] blur-[130px] rounded-full" />

      {/* Top Academic Status Header */}
      <header className="border-b border-zinc-200/70 dark:border-white/[0.07] bg-white/80 dark:bg-[#0E1526]/80 backdrop-blur-xl sticky top-0 z-30 px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-heading font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  {data.labName}
                </span>
                <span className="text-zinc-300 dark:text-slate-700 text-xs">•</span>
                <span className="text-xs font-mono text-zinc-500 dark:text-slate-400 font-medium">
                  {data.rowLabel || 'Main Floor'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-slate-500 hidden sm:block">
                Academic Computer Practical &amp; Assistance Gateway
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {/* Glowing Terminal Indicator */}
            <div className="px-3.5 py-1.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.05] border border-zinc-200/80 dark:border-white/[0.08] flex items-center gap-2.5 shadow-xs backdrop-blur-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-sm font-extrabold text-zinc-900 dark:text-white font-mono tracking-tight">
                {data.stationCode}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Full-Width Ergonomic Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* =========================================================================
              LEFT COLUMN: Workstation Identity, Student Recognition & Active Tickets
              ========================================================================= */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Integrated Student Desk Pass Deck */}
            <section className="bg-white/90 dark:bg-[#101726]/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-xl relative overflow-hidden space-y-6">
              {/* Header: Station & Hardware Security Pill */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-slate-500 font-semibold">
                    Workstation Terminal
                  </div>
                  <div className="text-2xl font-black font-heading text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5 mt-0.5">
                    <span>{data.stationCode}</span>
                    <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-slate-400 border border-zinc-200/70 dark:border-white/5">
                      {data.rowLabel || 'Floor Node'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-medium shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Hardware Bound</span>
                </div>
              </div>

              {/* Seamless Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/[0.08] to-transparent" />

              {/* Student Recognition Profile */}
              <div className="space-y-3.5">
                <div className="flex items-start gap-4">
                  {/* Avatar Ring */}
                  <div className="relative shrink-0">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/15 to-transparent border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner overflow-hidden">
                      {data.currentStudent?.photoUrl ? (
                        <img
                          src={data.currentStudent.photoUrl}
                          alt={data.currentStudent.studentName}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <User className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
                      )}
                    </div>
                    {data.currentStudent?.isTemporary && (
                      <span
                        className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#101726]"
                        title="Temporary Relocation"
                      />
                    )}
                  </div>

                  {/* Student Details */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-slate-500">
                      Assigned Student
                    </div>
                    <div className="text-base font-bold text-zinc-900 dark:text-white truncate mt-0.5 font-heading">
                      {data.currentStudent?.studentName || (
                        <span className="text-zinc-400 dark:text-slate-500 font-normal italic">
                          Unassigned / Open Practical
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {data.currentStudent?.rollNumber ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold">
                          <Hash className="w-3 h-3 text-indigo-500" />
                          <span>{data.currentStudent.rollNumber}</span>
                        </span>
                      ) : null}

                      {data.currentStudent?.className ? (
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-slate-300 text-[11px] font-medium">
                          {data.currentStudent.className}
                        </span>
                      ) : null}

                      {data.currentStudent?.isTemporary && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                          Relocated
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sleek Minimalist Name & Roll Editor */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 bg-zinc-100/70 dark:bg-white/[0.03] border border-zinc-200/70 dark:border-white/[0.06] rounded-2xl p-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all">
                    <div className="flex items-center gap-1.5 flex-1 px-2">
                      <User className="w-3.5 h-3.5 text-zinc-400 dark:text-slate-500 shrink-0" />
                      <input
                        type="text"
                        placeholder="Student Name (optional)"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full bg-transparent text-xs text-zinc-900 dark:text-slate-200 placeholder:text-zinc-400 dark:placeholder:text-slate-600 focus:outline-none"
                      />
                    </div>
                    <div className="w-px h-5 bg-zinc-200 dark:bg-white/10" />
                    <div className="flex items-center gap-1 w-20 px-2">
                      <Hash className="w-3.5 h-3.5 text-zinc-400 dark:text-slate-500 shrink-0" />
                      <input
                        type="text"
                        placeholder="Roll"
                        value={studentRoll}
                        onChange={(e) => setStudentRoll(e.target.value)}
                        className="w-full bg-transparent text-xs font-mono text-zinc-900 dark:text-slate-200 placeholder:text-zinc-400 dark:placeholder:text-slate-600 focus:outline-none text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Seamless Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/[0.08] to-transparent" />

              {/* Practical Routine Session Flow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Active Session</span>
                  </div>

                  {data.activeSession?.remainingMinutes !== undefined ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-mono font-semibold">
                      {data.activeSession.remainingMinutes}m remaining
                    </span>
                  ) : null}
                </div>

                <div className="text-base font-extrabold text-zinc-900 dark:text-white font-heading">
                  {data.activeSession?.subjectName || 'Open Laboratory Hours'}
                </div>

                <div className="text-xs text-zinc-500 dark:text-slate-400 flex items-center gap-2 font-mono">
                  {data.activeSession?.startTime && data.activeSession?.endTime ? (
                    <span>
                      {data.activeSession.startTime} – {data.activeSession.endTime}
                    </span>
                  ) : (
                    <span>Standard Academic Schedule</span>
                  )}
                  {data.activeSession?.batchName && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{data.activeSession.batchName}</span>
                    </>
                  )}
                </div>

                {data.activeSession?.practicalTitle && (
                  <div className="pt-2 text-xs text-zinc-600 dark:text-slate-300 space-y-1">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-semibold text-zinc-800 dark:text-slate-200">
                          {data.activeSession.practicalTitle}
                        </span>
                        {data.activeSession.teacherName && (
                          <p className="text-[11px] text-zinc-400 dark:text-slate-500 mt-0.5">
                            Instructor: {data.activeSession.teacherName}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Seamless Active Tickets Section */}
            <section className="bg-white/90 dark:bg-[#101726]/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-800 dark:text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
                  <span>Recent Desk Tickets</span>
                  {data.recentIssues && data.recentIssues.length > 0 && (
                    <span className="h-5 px-2 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-mono flex items-center justify-center font-bold">
                      {data.recentIssues.length}
                    </span>
                  )}
                </div>
              </div>

              {data.recentIssues && data.recentIssues.length > 0 ? (
                <div className="space-y-2.5">
                  {data.recentIssues.map((iss) => (
                    <div
                      key={iss.id}
                      className="p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs transition-all hover:border-zinc-300 dark:hover:border-white/10"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            iss.severity === 'critical'
                              ? 'bg-rose-500 shadow-sm shadow-rose-500/50 animate-pulse'
                              : iss.severity === 'high'
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                        />
                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                          {iss.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono capitalize ${
                            iss.status === 'in_progress'
                              ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-slate-400'
                          }`}
                        >
                          {iss.status.replace('_', ' ')}
                        </span>

                        {iss.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(iss.id)}
                            disabled={cancellingId === iss.id}
                            className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 text-[11px] font-medium px-2 py-0.5 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            {cancellingId === iss.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 px-4 rounded-2xl bg-zinc-50/50 dark:bg-white/[0.01] border border-dashed border-zinc-200 dark:border-white/5 text-center space-y-1">
                  <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-zinc-800 dark:text-slate-200">
                    All Systems Nominal
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-slate-500 max-w-xs mx-auto">
                    No active defect reports or unresolved assistance requests on {data.stationCode}.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* =========================================================================
              RIGHT COLUMN: Modern Problem Reporting Command Deck
              ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Success Alert Banner */}
            {submitSuccess && (
              <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 flex items-start gap-3.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-emerald-950 dark:text-white font-heading">
                    Assistance Beacon Broadcasted!
                  </div>
                  <div className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                    Your fault ticket has been sent to the Live Cockpit for{' '}
                    <strong className="text-emerald-950 dark:text-white font-mono">{data.stationCode}</strong>.
                    The Lab In-Charge and Subject Instructor have been alerted.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white text-xs px-2.5 py-1 rounded-lg hover:bg-emerald-500/10 cursor-pointer font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Error Alert Banner */}
            {errorMessage && (
              <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-950 dark:text-rose-200 flex items-start gap-3.5 shadow-lg backdrop-blur-md">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Main Reporting Deck */}
            <div className="bg-white/90 dark:bg-[#101726]/90 backdrop-blur-md border border-zinc-200/80 dark:border-white/[0.08] rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
              {/* Header Title */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white font-heading flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Select Problem Category</span>
                  </h2>

                  {selectedChip && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 animate-in fade-in">
                      {selectedChip.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 dark:text-slate-400 mt-1">
                  Tap the category that best matches your desk fault to notify the lab team.
                </p>
              </div>

              {/* 6 Tactile Interactive Problem Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {TERMINAL_QUICK_ISSUES.map((chip) => {
                  const isSelected = selectedChip?.id === chip.id
                  const accent = getChipAccent(chip.id, isSelected)

                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className={`group p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer relative overflow-hidden border flex flex-col justify-between min-h-[110px] ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-500 dark:border-indigo-500/80 shadow-lg shadow-indigo-500/15 ring-2 ring-indigo-500/30'
                          : 'bg-zinc-50/70 dark:bg-white/[0.02] border-zinc-200/80 dark:border-white/[0.06] hover:bg-white dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/15 hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      {/* Top Row: Icon Badge + Radio Check */}
                      <div className="flex items-center justify-between w-full mb-3">
                        <div
                          className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all ${accent.bg}`}
                        >
                          {accent.icon}
                        </div>

                        <div
                          className={`h-5 w-5 rounded-full border transition-all flex items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 text-white shadow-xs'
                              : 'border-zinc-300 dark:border-white/10 group-hover:border-zinc-400 dark:group-hover:border-white/30'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>

                      {/* Content */}
                      <div>
                        <div className="text-xs font-bold font-heading text-zinc-900 dark:text-white leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          {chip.label}
                        </div>
                        <p className="text-[11px] text-zinc-400 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {chip.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Seamless Form: Mandatory Observations & Notes */}
              <form onSubmit={handleSubmit} className="pt-2 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 dark:text-slate-200 font-heading flex items-center gap-1.5">
                      <span>Specific Observations &amp; Fault Details</span>
                      <span className="text-rose-500 font-bold">*</span>
                      <span className="text-[11px] font-normal text-zinc-400 dark:text-slate-500">
                        (Mandatory)
                      </span>
                    </label>

                    {/* Dynamic Character Gauge */}
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border transition-colors ${
                        charCount >= 10
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                          : 'bg-zinc-100 dark:bg-white/[0.05] border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-slate-500'
                      }`}
                    >
                      {charCount >= 10 ? `${charCount} chars (Ready)` : `${charCount} / 10 chars min`}
                    </span>
                  </div>

                  {/* Sleek Textarea Well */}
                  <div className="relative rounded-2xl bg-zinc-50/80 dark:bg-[#0E1526] border border-zinc-200/80 dark:border-white/[0.08] focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 transition-all p-3.5">
                    <textarea
                      required
                      rows={3}
                      placeholder={
                        selectedChip
                          ? `Describe what is occurring with "${selectedChip.label}" so the instructor can assist immediately...`
                          : 'Choose a problem category above and describe what you are seeing on your screen or desk...'
                      }
                      value={customDetails}
                      onChange={(e) => setCustomDetails(e.target.value)}
                      className="w-full bg-transparent text-xs text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 dark:text-slate-500">
                    Detailed descriptions help the Lab In-Charge diagnose software vs. hardware faults before reaching your desk.
                  </p>
                </div>

                {/* Dispatch & Action Bar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-zinc-200/60 dark:border-white/[0.06] pt-4">
                  <div className="text-xs text-zinc-500 dark:text-slate-400">
                    {cooldown > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                        <Flame className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span>Anti-spam cooldown active: Please wait {cooldown}s before submitting another request.</span>
                      </span>
                    ) : selectedChip ? (
                      <span className="flex items-center gap-1 text-zinc-700 dark:text-slate-300">
                        <span>Ready to report:</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                          {selectedChip.label}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-slate-500 italic">
                        Select a category above to dispatch your assistance beacon.
                      </span>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="h-11 px-7 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-heading font-bold text-xs shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer shrink-0"
                  >
                    {cooldown > 0 ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Cooldown ({cooldown}s)</span>
                      </>
                    ) : isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Broadcasting to Cockpit...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Issue Report</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Clean Footer */}
      <footer className="border-t border-zinc-200/70 dark:border-white/[0.07] bg-white/60 dark:bg-[#0B0F19]/60 backdrop-blur-md px-4 py-4 text-center text-xs text-zinc-400 dark:text-slate-500 font-mono relative z-10">
        {INSTITUTION_NAME} · LabSync LIMS Academic Laboratory System · Workstation Self-Reporting Gateway
      </footer>
    </div>
  )
}
