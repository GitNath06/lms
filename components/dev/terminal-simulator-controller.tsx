'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  Laptop,
  Cpu,
  HardDrive,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
  ChevronUp,
  X,
  AlertTriangle,
  Flame,
  Check,
  MousePointer,
  Code2,
  Monitor,
  Send,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  Layers,
  Play,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { broadcastSync } from '@/lib/sync-bus'
import {
  HARDWARE_PRESETS,
  DISTRESS_BEACON_PRESETS,
  type SimulatorStationState,
} from '@/lib/types/terminal-simulator'
import {
  getSimulatorStationState,
  injectHardwarePreset,
  resetStationTelemetry,
  mintSimulatorTerminalTicket,
  injectStudentDistressBeacon,
  testAntiSpoofHijack,
  simulateSwarmBootAll,
  simulateMassStudentDistress,
  clearAllSimulatorDistressTickets,
} from '@/app/actions/terminal-simulator'

export default function TerminalSimulatorController() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'hardware' | 'portal' | 'distress' | 'defense' | 'swarm'>('hardware')
  const [distressCount, setDistressCount] = useState<number>(6)
  const [stationCode, setStationCode] = useState('PC-01')
  const [stationState, setStationState] = useState<SimulatorStationState | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [defenseResult, setDefenseResult] = useState<{
    blocked: boolean
    status: number
    message: string
    registeredGuid?: string | null
    attemptedGuid?: string
  } | null>(null)

  const [isPending, startTransition] = useTransition()

  // Quick station selections
  const quickStations = ['PC-01', 'PC-02', 'PC-03', 'PC-04', 'PC-05', 'PC-10', 'PC-14', 'PC-20']

  // Fetch state for active station
  const refreshStationState = (codeToFetch: string) => {
    startTransition(async () => {
      const res = await getSimulatorStationState(codeToFetch)
      if (res.success && res.state) {
        setStationState(res.state)
      } else {
        setStationState(null)
      }
    })
  }

  useEffect(() => {
    if (isOpen) {
      refreshStationState(stationCode)
    }
  }, [isOpen, stationCode])

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text })
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev))
    }, 4500)
  }

  // 1. Inject Hardware Preset
  const handleInjectPreset = (presetKey: 'optimal' | 'low_storage' | 'critical_storage' | 'high_end') => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await injectHardwarePreset(stationCode, presetKey)
      if (res.success) {
        showToast('success', `Injected "${HARDWARE_PRESETS[presetKey].name}" into ${stationCode}.`)
        broadcastSync('workstations', { stationCode })
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to inject telemetry.')
      }
    })
  }

  // 2. Reset Workstation Lock & Specs
  const handleResetTelemetry = () => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await resetStationTelemetry(stationCode)
      if (res.success) {
        showToast('info', `Reset ${stationCode}: Telemetry & Machine Lock cleared back to fresh state.`)
        broadcastSync('workstations', { stationCode })
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to reset station.')
      }
    })
  }

  // 3. Launch Authenticated Student Session
  const handleLaunchAuthenticatedSession = () => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await mintSimulatorTerminalTicket(stationCode)
      if (res.success && res.authUrl) {
        showToast('success', `Minted 60s handshake ticket for ${stationCode}. Opening portal...`)
        window.open(res.authUrl, '_blank')
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to mint session ticket.')
      }
    })
  }

  // 4. Test Direct Unauthorized Visit
  const handleTestUnauthorizedVisit = () => {
    window.open('/terminal', '_blank')
    showToast('info', 'Opened /terminal directly (unauthenticated) to verify physical lock screen.')
  }

  // 5. Inject Student Distress Beacon
  const handleInjectDistress = (preset: typeof DISTRESS_BEACON_PRESETS[0]) => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await injectStudentDistressBeacon({
        stationCode,
        title: preset.title,
        category: preset.category,
        severity: preset.severity,
        studentName: preset.studentName,
        studentRoll: preset.studentRoll,
        description: preset.description,
      })
      if (res.success) {
        showToast(
          'success',
          `Student Distress Beacon fired for ${stationCode} (${preset.studentName}, Roll ${preset.studentRoll})!`
        )
        broadcastSync('assistance', { stationCode })
        broadcastSync('workstations', { stationCode })
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to inject student beacon.')
      }
    })
  }

  // 6. Test Anti-Spoofing Hijack
  const handleTestAntiSpoof = () => {
    startTransition(async () => {
      setDefenseResult(null)
      setStatusMessage(null)
      const res = await testAntiSpoofHijack(stationCode)
      setDefenseResult(res)
      if (res.blocked) {
        showToast('success', `Anti-spoofing defense verified: Rogue device rejected with 403 Forbidden!`)
      } else {
        showToast('info', res.message)
      }
    })
  }

  // 7. Swarm Boot All 50 Workstations
  const handleSwarmBootAll = () => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await simulateSwarmBootAll()
      if (res.success) {
        showToast('success', `Swarm Boot: All ${res.count} workstations booted & synced in ${res.durationMs}ms!`)
        broadcastSync('workstations')
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Swarm boot failed.')
      }
    })
  }

  // 8. Mass Student Distress Reports
  const handleMassDistress = () => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await simulateMassStudentDistress(distressCount)
      if (res.success) {
        showToast('info', `Mass Distress: Created ${res.ticketsCreated} student issues (${res.affectedStations.join(', ')}).`)
        broadcastSync('workstations')
        broadcastSync('incidents')
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to simulate distress swarm.')
      }
    })
  }

  // 9. Clear All Swarm Distress Tickets
  const handleClearSwarmTickets = () => {
    startTransition(async () => {
      setStatusMessage(null)
      const res = await clearAllSimulatorDistressTickets()
      if (res.success) {
        showToast('success', `Cleared ${res.clearedCount} student distress tickets. Lab floor restored!`)
        broadcastSync('workstations')
        broadcastSync('incidents')
        refreshStationState(stationCode)
      } else {
        showToast('error', res.error || 'Failed to clear tickets.')
      }
    })
  }

  const freeDiskGb = stationState?.hardwareSpecs?.disk_c_free_gb ?? null
  const isCriticalDisk = freeDiskGb !== null && freeDiskGb < 5
  const isLowDisk = freeDiskGb !== null && freeDiskGb >= 5 && freeDiskGb < 15

  // Only render in development mode, and hide on mobile/tablet viewports (<lg)
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="hidden lg:flex fixed bottom-4 right-4 z-50 select-none font-sans print:hidden">
      {/* 1. COLLAPSED TRIGGER PILL */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono shadow-xl backdrop-blur-md transition-all cursor-pointer active:scale-95 ${
            stationState?.hardwareSpecs
              ? isCriticalDisk
                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500/50 hover:bg-rose-200 dark:hover:bg-rose-500/30'
                : isLowDisk
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/50 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-500/50 hover:bg-indigo-200 dark:hover:bg-indigo-500/30'
              : 'bg-white/95 text-zinc-800 dark:bg-[#151E32]/90 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.1] shadow-lg hover:border-zinc-300 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-[#151E32]'
          }`}
          title="Open LabSync Terminal & Telemetry Simulator"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                stationState?.hardwareSpecs
                  ? isCriticalDisk
                    ? 'bg-rose-500 animate-ping'
                    : isLowDisk
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-400'
                  : 'bg-indigo-400'
              }`}
            />
            <span className="font-bold tracking-tight">
              {stationState?.hardwareSpecs ? `RIG: ${stationCode}` : 'Station Rig'}
            </span>
          </span>
          <ChevronUp className="h-3 w-3 opacity-60 ml-0.5" />
        </button>
      )}

      {/* 2. EXPANDED CONTROL CONSOLE */}
      {isOpen && (
        <div className="w-[360px] sm:w-[410px] rounded-2xl bg-white/95 dark:bg-[#0E1524]/95 border border-zinc-200/90 dark:border-white/[0.1] shadow-2xl backdrop-blur-xl p-3.5 sm:p-4 text-zinc-900 dark:text-zinc-100 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Laptop className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-heading uppercase tracking-wider text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <span>Station Rig &amp; Telemetry</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    TEST LAB
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-slate-400">
                  Simulate hardware specs, anti-spoofing &amp; live student portal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-surface-3 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Toast / Status banner */}
          {statusMessage && (
            <div
              className={`mt-2.5 p-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
              )}
              <span className="leading-tight text-[11px]">{statusMessage.text}</span>
            </div>
          )}

          {/* Station Selector Bar */}
          <div className="my-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans">
              <span>Target Laboratory Station</span>
              <span className="font-mono text-zinc-400 font-normal">Active: {stationCode}</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {quickStations.map((code) => {
                const isSelected = stationCode === code
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setStationCode(code)
                      refreshStationState(code)
                    }}
                    className={`h-7 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                        : 'bg-zinc-100 dark:bg-slate-900/80 hover:bg-zinc-200 dark:hover:bg-slate-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/[0.06]'
                    }`}
                  >
                    {code}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Current Station Telemetry HUD */}
          <div className="p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] bg-zinc-50/80 dark:bg-slate-900/60 space-y-1.5 text-xs mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold font-mono text-sm text-zinc-950 dark:text-white">
                  {stationCode}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                    stationState?.isBound
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
                  }`}
                >
                  {stationState?.isBound ? 'Bound / Locked' : 'Unpaired Fresh'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => refreshStationState(stationCode)}
                  disabled={isPending}
                  className="h-5 px-1.5 rounded text-[10px] font-mono text-zinc-400 hover:text-white hover:bg-zinc-700/50 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Refresh status from PostgreSQL"
                >
                  <RotateCcw className={`h-2.5 w-2.5 ${isPending ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>

            {/* Hardware Specs Micro Summary */}
            {stationState?.hardwareSpecs ? (
              <div className="pt-1 border-t border-zinc-200/50 dark:border-white/[0.04] space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
                  <span className="text-zinc-400 text-[10px]">CPU:</span>
                  <span className="font-mono text-[10px] truncate max-w-[210px]">
                    {stationState.hardwareSpecs.cpu}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-300">
                  <span className="text-zinc-400 text-[10px]">RAM &amp; Disk:</span>
                  <span className="font-mono text-[10px]">
                    {stationState.hardwareSpecs.ram_gb} GB RAM ·{' '}
                    <strong
                      className={
                        isCriticalDisk
                          ? 'text-rose-400'
                          : isLowDisk
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {stationState.hardwareSpecs.disk_c_free_gb} GB Free
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="pt-1 border-t border-zinc-200/50 dark:border-white/[0.04] text-[10px] text-zinc-400 italic">
                No telemetry recorded yet. Click a preset below to inject hardware specs.
              </div>
            )}

            {/* Active Distress / Issues Count */}
            {stationState && stationState.openIssuesCount > 0 && (
              <div className="pt-1 border-t border-zinc-200/50 dark:border-white/[0.04] flex items-center justify-between text-[10px]">
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Flame className="h-3 w-3" />
                  <span>{stationState.openIssuesCount} Active Issue(s)</span>
                </span>
                <span className="text-zinc-400 font-mono">
                  {stationState.activeIssues[0]?.title}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-5 gap-1 p-0.5 rounded-xl bg-zinc-100 dark:bg-slate-900/90 border border-zinc-200/60 dark:border-white/[0.06] mb-3">
            {[
              { id: 'hardware', label: 'Specs', icon: Cpu },
              { id: 'portal', label: 'Portal', icon: ExternalLink },
              { id: 'distress', label: 'Distress', icon: Flame },
              { id: 'defense', label: 'Defense', icon: Shield },
              { id: 'swarm', label: 'Swarm 50', icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-indigo-600 text-zinc-950 dark:text-white shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* TAB 1: HARDWARE SPECS INJECTOR */}
          {activeTab === 'hardware' && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans flex items-center justify-between">
                <span>Inject Telemetry Preset</span>
                <span className="font-normal font-mono text-[9px]">Target: {stationCode}</span>
              </div>

              <div className="space-y-1.5">
                {Object.values(HARDWARE_PRESETS).map((preset) => {
                  return (
                    <div
                      key={preset.key}
                      className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-slate-900/40 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-heading">
                            {preset.name}
                          </span>
                          <span
                            className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                              preset.badgeVariant === 'optimal'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : preset.badgeVariant === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : preset.badgeVariant === 'danger'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            }`}
                          >
                            {preset.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-mono truncate">
                          {preset.diskDisplay} · {preset.ramDisplay}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInjectPreset(preset.key)}
                        disabled={isPending}
                        className="h-6 px-2 text-[10px] font-mono border-zinc-200 dark:border-zinc-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 shrink-0 cursor-pointer"
                      >
                        <Cpu className="h-3 w-3 mr-1" />
                        <span>Inject</span>
                      </Button>
                    </div>
                  )
                })}
              </div>

              {/* Reset to fresh unpair */}
              <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">Motherboard / Fresh PC Reset:</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleResetTelemetry}
                  disabled={isPending}
                  className="h-6 px-2 text-[10px] font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  <span>Unbind &amp; Clear Specs</span>
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: PORTAL LAUNCHER & SESSION MINTING */}
          {activeTab === 'portal' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 space-y-1.5 text-xs">
                <div className="font-bold text-indigo-300 font-heading flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>1-Click Authenticated Session</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Mints a 60-second single-use HMAC handshake ticket and opens{' '}
                  <code className="text-white font-mono bg-indigo-900/40 px-1 rounded">/terminal/auth</code>.
                  The route sets the HttpOnly session cookie and lands on the verified Student Portal for{' '}
                  <strong className="text-white">{stationCode}</strong>.
                </p>
                <div className="pt-1">
                  <Button
                    onClick={handleLaunchAuthenticatedSession}
                    disabled={isPending}
                    className="w-full h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md"
                  >
                    <Laptop className="h-3.5 w-3.5 mr-1.5" />
                    <span>Launch Student Portal as {stationCode}</span>
                  </Button>
                </div>
              </div>

              {/* Unauthorized Visit Test */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5 text-xs">
                <div className="font-bold text-zinc-300 font-heading flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Test Direct / Unauthorized Access</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Opens <code className="text-zinc-200 font-mono">/terminal</code> directly without an agent
                  ticket to verify the anti-spoofing physical workstation lock screen.
                </p>
                <div className="pt-1">
                  <Button
                    variant="outline"
                    onClick={handleTestUnauthorizedVisit}
                    className="w-full h-7 text-xs font-mono border-zinc-700 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    <span>Open Direct /terminal (Lock Screen)</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STUDENT DISTRESS BEACON INJECTOR */}
          {activeTab === 'distress' && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-slate-400 font-sans flex items-center justify-between">
                <span>Trigger Student Help Beacon</span>
                <span className="font-mono text-[9px] text-zinc-400">Target: {stationCode}</span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                Simulates a student sitting at {stationCode} submitting an urgent assistance request. Reflects
                immediately in the Computer Lab CAD radar and Drawer Tab 3!
              </p>

              <div className="space-y-1.5 pt-1">
                {DISTRESS_BEACON_PRESETS.map((beacon) => {
                  return (
                    <div
                      key={beacon.key}
                      className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-slate-900/40 hover:border-amber-500/40 transition-all space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            {beacon.iconName === 'mouse' ? (
                              <MousePointer className="h-3.5 w-3.5 text-indigo-400" />
                            ) : beacon.iconName === 'code' ? (
                              <Code2 className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <Monitor className="h-3.5 w-3.5 text-rose-400" />
                            )}
                            <span>{beacon.title}</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-slate-400">
                            Student: <strong className="text-zinc-300">{beacon.studentName}</strong> (Roll{' '}
                            {beacon.studentRoll})
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleInjectDistress(beacon)}
                          disabled={isPending}
                          className="h-6 px-2 text-[10px] font-mono border-zinc-200 dark:border-zinc-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 shrink-0 cursor-pointer"
                        >
                          <Send className="h-2.5 w-2.5 mr-1" />
                          <span>Fire Beacon</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-zinc-400 italic bg-black/20 p-1.5 rounded border border-white/[0.04]">
                        &ldquo;{beacon.description}&rdquo;
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: ANTI-SPOOFING DEFENSE TEST */}
          {activeTab === 'defense' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs">
                <div className="font-bold text-zinc-200 font-heading flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Real-World Anti-Spoofing Defense Test</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Tests how the system responds when an unauthorized laptop or attacker attempts to impersonate{' '}
                  <strong className="text-white">{stationCode}</strong> using a forged / mismatched Machine GUID.
                </p>

                <Button
                  onClick={handleTestAntiSpoof}
                  disabled={isPending}
                  className="w-full h-8 text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white cursor-pointer shadow-md"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                  <span>Simulate Rogue Laptop Hijack Attack</span>
                </Button>
              </div>

              {/* Defense Result Output */}
              {defenseResult && (
                <div
                  className={`p-3 rounded-xl border space-y-2 text-xs animate-in fade-in duration-200 ${
                    defenseResult.blocked
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold font-heading">
                    {defenseResult.blocked ? (
                      <>
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                        <span className="text-white">HTTP 403 FORBIDDEN · SPOOF BLOCKED</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 text-zinc-400" />
                        <span className="text-white">Defense Status: {defenseResult.status}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{defenseResult.message}</p>
                  {defenseResult.registeredGuid && (
                    <div className="p-2 rounded bg-black/40 font-mono text-[9px] space-y-0.5 border border-white/[0.05]">
                      <div>
                        <span className="text-zinc-500">Registered Station GUID:</span>{' '}
                        <span className="text-emerald-400">{defenseResult.registeredGuid}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Rogue Attacker GUID:</span>{' '}
                        <span className="text-rose-400">{defenseResult.attemptedGuid}</span>
                      </div>
                      <div className="text-zinc-400 pt-0.5">Audit Action: Access Blocked &amp; Recorded.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SWARM 50 & MASS SIMULATOR */}
          {activeTab === 'swarm' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl border border-zinc-200/70 dark:border-white/[0.08] bg-zinc-50/80 dark:bg-slate-900/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-950 dark:text-white font-heading">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  <span>50-Workstation Lab Swarm Engine</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-slate-400 leading-relaxed">
                  Test simultaneous morning boot handshakes, high-concurrency student distress reports, and instant CAD floor telemetry updates.
                </p>
              </div>

              {/* 1. Simulate 50 PC Morning Boot */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 font-heading">
                    1. Morning Lab Power-On (All PCs)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    50 Concurrent
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Simulates all lab PCs booting up simultaneously. Registers AMD/Intel specs, IPs, and sends heartbeat timestamps to turn the whole floor operational.
                </p>
                <Button
                  onClick={handleSwarmBootAll}
                  disabled={isPending}
                  className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm gap-1.5"
                >
                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                  <span>Simulate All 50 PCs Booting</span>
                </Button>
              </div>

              {/* 2. Simulate Simultaneous Student Distress */}
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 font-heading">
                    2. Mass Student Distress Reports
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Live Beacon
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-relaxed">
                  Simulates multiple students reporting broken mice, network disconnects, or software crashes at the same moment.
                </p>

                {/* Count selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-400 font-mono">Count:</span>
                  {[3, 6, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setDistressCount(num)}
                      className={`h-6 px-2 text-[10px] font-mono font-bold rounded border transition-all cursor-pointer ${
                        distressCount === num
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-extrabold'
                          : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {num} PCs
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleMassDistress}
                  disabled={isPending}
                  className="w-full h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold cursor-pointer shadow-sm gap-1.5"
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span>Simulate {distressCount} Simultaneous Student Issues</span>
                </Button>
              </div>

              {/* 3. Clear Swarm Tickets */}
              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={handleClearSwarmTickets}
                  disabled={isPending}
                  className="w-full h-7 text-xs font-mono border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer gap-1.5"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear All Swarm Distress Tickets</span>
                </Button>
              </div>
            </div>
          )}

          {/* Quick Shortcuts Footer */}
          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-white/[0.08] flex items-center justify-between text-[11px]">
            <a
              href="/computer-lab"
              className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Inspect in /computer-lab CAD</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-[10px] font-mono text-zinc-500">LabSync Simulator v1.2</span>
          </div>
        </div>
      )}
    </div>
  )
}
