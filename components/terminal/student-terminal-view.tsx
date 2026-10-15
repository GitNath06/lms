'use client'

import React, { useState, useEffect } from 'react'
import {
  Monitor,
  ShieldCheck,
  ShieldAlert,
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
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  TERMINAL_QUICK_ISSUES,
  type TerminalContextData,
  type TerminalIssueChip,
} from '@/lib/types/terminal'
import { submitStudentIssueReport } from '@/app/actions/terminal'

interface StudentTerminalViewProps {
  initialData: TerminalContextData
}

export function StudentTerminalView({ initialData }: StudentTerminalViewProps) {
  const [data, setData] = useState<TerminalContextData>(initialData)
  const [selectedChip, setSelectedChip] = useState<TerminalIssueChip | null>(null)
  const [customDetails, setCustomDetails] = useState('')
  const [studentName, setStudentName] = useState(data.currentStudent?.studentName || '')
  const [studentRoll, setStudentRoll] = useState(
    data.currentStudent?.rollNumber ? String(data.currentStudent.rollNumber) : ''
  )
  const [isIdentityConfirmed, setIsIdentityConfirmed] = useState(Boolean(data.currentStudent))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clientPairingToken, setClientPairingToken] = useState<string | null>(null)

  // Load persistent browser pairing token from localStorage if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem(`labsync_paired_token_${data.stationCode}`) || localStorage.getItem('labsync_paired_token')
      if (storedToken) {
        setClientPairingToken(storedToken)
      } else if (data.pairingToken) {
        // Automatically persist if provided in initial data
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
      setErrorMessage('Please select an issue type to request assistance.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    const res = await submitStudentIssueReport({
      stationCode: data.stationCode,
      issueTag: selectedChip.id,
      title: selectedChip.label,
      description: customDetails.trim() || selectedChip.description,
      studentName: studentName.trim() || undefined,
      studentRoll: studentRoll.trim() || undefined,
      pairingToken: clientPairingToken || data.pairingToken || undefined,
    })

    setIsSubmitting(false)

    if (res.success) {
      setSubmitSuccess(true)
      setCustomDetails('')
      setSelectedChip(null)
    } else {
      setErrorMessage(res.error || 'Failed to submit assistance request.')
    }
  }

  const renderChipIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-amber-400" />
      case 'FileText':
        return <FileText className="w-5 h-5 text-blue-400" />
      case 'PackageX':
        return <PackageX className="w-5 h-5 text-rose-400" />
      case 'ZapOff':
        return <ZapOff className="w-5 h-5 text-rose-500 animate-pulse" />
      case 'MousePointer':
        return <MousePointer className="w-5 h-5 text-indigo-400" />
      case 'WifiOff':
        return <WifiOff className="w-5 h-5 text-amber-500" />
      default:
        return <HelpCircle className="w-5 h-5 text-zinc-400" />
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-zinc-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Academic Status Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-20 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wide text-zinc-200">
                  {data.labName}
                </span>
                <span className="text-zinc-500 text-xs">•</span>
                <Badge variant="outline" className="text-[10px] bg-zinc-900 border-zinc-700 text-zinc-400">
                  {data.rowLabel || 'Floor Node'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">Student Self-Reporting & Assistance Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-right">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Terminal ID</div>
              <div className="text-sm font-extrabold text-emerald-400 font-mono tracking-tight">
                {data.stationCode}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Active Session & Student Recognition Card */}
        <section className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
            <div>
              <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Active Class Session
              </div>
              <div className="text-base font-bold text-zinc-100 font-heading mt-0.5">
                {data.activeSession?.subjectName || 'Open Laboratory Practical Hours'}
              </div>
              {data.activeSession?.teacherName && (
                <div className="text-xs text-zinc-400 mt-0.5">
                  Conducted by <span className="text-zinc-300 font-medium">{data.activeSession.teacherName}</span>
                </div>
              )}
            </div>

            {/* Anti-Spoofing Security Indicator */}
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1.5 rounded-lg self-start sm:self-auto">
              <Lock className="w-3.5 h-3.5" />
              <span>Hardware Locked to {data.stationCode}</span>
            </div>
          </div>

          {/* Student Recognition */}
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 overflow-hidden shrink-0">
                {data.currentStudent?.photoUrl ? (
                  <img
                    src={data.currentStudent.photoUrl}
                    alt={data.currentStudent.studentName}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                  <span>Assigned Student</span>
                  {data.currentStudent?.isTemporary && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] font-mono font-bold px-1.5 py-0">
                      Temp Relocation {data.currentStudent.originalWorkstationLabel ? `from ${data.currentStudent.originalWorkstationLabel}` : ''}
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-semibold text-zinc-200">
                  {data.currentStudent ? (
                    <>
                      {data.currentStudent.studentName}{' '}
                      <span className="text-indigo-400 font-mono text-xs">(Roll {data.currentStudent.rollNumber})</span>
                    </>
                  ) : (
                    <span className="text-zinc-500 italic">No student assigned to this station</span>
                  )}
                </div>
              </div>
            </div>

            {/* Confirmation Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Student Name (optional)"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
              />
              <input
                type="text"
                placeholder="Roll #"
                value={studentRoll}
                onChange={(e) => setStudentRoll(e.target.value)}
                className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 w-16 sm:w-20 font-mono"
              />
            </div>
          </div>
        </section>

        {/* Success Alert Banner */}
        {submitSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-white">Assistance Request Dispatched!</div>
              <div className="text-xs text-emerald-300/90 mt-0.5">
                The Teacher Podium and Lab In-Charge Cockpit have been notified with an alert beacon for{' '}
                <strong className="text-white font-mono">{data.stationCode}</strong>. Please stay at your terminal while assistance arrives.
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSubmitSuccess(false)}
              className="text-emerald-400 hover:text-white hover:bg-emerald-900/40 text-xs h-7 px-2"
            >
              Close
            </Button>
          </div>
        )}

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">{errorMessage}</div>
          </div>
        )}

        {/* 1-Tap Quick Issue Chips Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-heading flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              1-Tap Quick Issue Reporting
            </h2>
            <span className="text-xs text-zinc-500">Tap the chip matching your problem</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TERMINAL_QUICK_ISSUES.map((chip) => {
              const isSelected = selectedChip?.id === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  className={`p-3.5 rounded-xl text-left transition-all border flex items-start gap-3 group relative overflow-hidden ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 transition-transform group-hover:scale-105 ${
                      isSelected ? 'bg-indigo-500/20' : 'bg-zinc-800/80'
                    }`}
                  >
                    {renderChipIcon(chip.iconName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-zinc-100 truncate group-hover:text-white">
                      {chip.label}
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                      {chip.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Custom Details & Submit Form */}
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Additional Details or Observations (Optional)
            </label>
            <textarea
              placeholder={
                selectedChip
                  ? `e.g. Details about "${selectedChip.label}"...`
                  : 'Describe what is happening on your terminal screen...'
              }
              value={customDetails}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomDetails(e.target.value)}
              className="w-full rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 p-3 min-h-[70px] outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-zinc-400">
              {selectedChip ? (
                <span>
                  Selected:{' '}
                  <strong className="text-indigo-400 font-medium">{selectedChip.label}</strong>
                </span>
              ) : (
                <span className="text-zinc-500 italic">No issue selected yet</span>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !selectedChip}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Request Assistance</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Recent Open Tickets for this Workstation */}
        {data.recentIssues && data.recentIssues.length > 0 && (
          <section className="space-y-2.5 pt-2">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-heading">
              Existing Tickets for {data.stationCode}
            </div>
            <div className="divide-y divide-zinc-800/80 bg-zinc-900/40 border border-zinc-800/70 rounded-xl overflow-hidden">
              {data.recentIssues.map((iss) => (
                <div key={iss.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        iss.severity === 'critical'
                          ? 'bg-rose-500'
                          : iss.severity === 'high'
                          ? 'bg-amber-500'
                          : 'bg-indigo-400'
                      }`}
                    />
                    <span className="font-medium text-zinc-200">{iss.title}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${
                      iss.status === 'in_progress'
                        ? 'border-indigo-500/40 text-indigo-400 bg-indigo-950/20'
                        : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {iss.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/80 px-4 py-3 text-center text-xs text-zinc-500 font-mono">
        LabSync LIMS · Terminal Self-Reporting Gateway · 2-Tier Hardware Lock Active
      </footer>
    </div>
  )
}
