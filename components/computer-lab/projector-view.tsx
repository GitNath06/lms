'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Monitor,
  Maximize2,
  Minimize2,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Calendar,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WorkstationNode } from '@/components/maintenance/workstations/workstation-node'
import { FloorLandmarkNode } from '@/components/maintenance/workstations/floor-landmark-node'
import { LabDeskStructureOverlay } from './lab-desk-structure-overlay'
import { getLiveSessionContext, type LiveSessionContext } from '@/app/actions/live-session'
import type { WorkstationBoardData } from '@/types/workstations'
import type { LabFloorElementRow } from '@/types/database'

interface ProjectorViewProps {
  initialBoardData: WorkstationBoardData
  floorElements: LabFloorElementRow[]
  initialSessionContext: LiveSessionContext | null
  scheduleId?: string
  labName?: string
  labCode?: string
}

export function ProjectorView({
  initialBoardData,
  floorElements,
  initialSessionContext,
  scheduleId,
  labName = 'Computer Lab 01',
  labCode = 'COM-LAB',
}: ProjectorViewProps) {
  const [boardData, setBoardData] = useState<WorkstationBoardData>(initialBoardData)
  const [sessionContext, setSessionContext] = useState<LiveSessionContext | null>(
    initialSessionContext
  )
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState<boolean>(false)
  const [lastSyncedText, setLastSyncedText] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDateString, setCurrentDateString] = useState<string>('')

  // 1. Digital Clock & Mounted Hydration Sync
  useEffect(() => {
    setMounted(true)
    const initialNow = new Date()
    setLastSyncedText(
      initialNow.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    )

    function updateClock() {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
      setCurrentDateString(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err)
      })
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
      setIsFullscreen(false)
    }
  }

  // 3. Auto-Refresh every 10 seconds
  const refreshLiveState = useCallback(async () => {
    if (!scheduleId && !sessionContext?.scheduleId) return
    const targetSchedId = scheduleId || sessionContext?.scheduleId
    if (!targetSchedId) return

    try {
      const res = await getLiveSessionContext(targetSchedId)
      if (res.success && res.data) {
        setSessionContext(res.data)
        setLastSyncedText(
          new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })
        )
      }
    } catch (err) {
      console.error('Error auto-refreshing projector state:', err)
    }
  }, [scheduleId, sessionContext?.scheduleId])

  useEffect(() => {
    const pollInterval = setInterval(refreshLiveState, 10000)
    return () => clearInterval(pollInterval)
  }, [refreshLiveState])

  // Counts
  const totalWorkstations = boardData.workstations.length
  const seatedStudents = sessionContext ? Object.keys(sessionContext.seatPlan).length : 0
  const outOfServiceCount = boardData.workstations.filter(
    (w) => w.status === 'under_repair' || (w.status === 'flagged' && w.highest_severity === 'critical')
  ).length
  const availableCount = Math.max(0, totalWorkstations - seatedStudents - outOfServiceCount)

  return (
    <div className="min-h-screen bg-[#070A12] text-white flex flex-col justify-between selection:bg-indigo-500/30">
      {/* ------------------------------------------------------------- */}
      {/* 1. PROJECTOR HEADER (High-Contrast Wall Display)              */}
      {/* ------------------------------------------------------------- */}
      <header className="p-4 sm:p-6 bg-[#0B0F19]/90 border-b border-white/[0.08] backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left: Facility & Active Session */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                <Monitor className="h-4 w-4" />
              </span>
              <span className="font-heading font-extrabold text-base sm:text-lg text-white tracking-tight">
                {labName} ({labCode})
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Wall Seating Chart
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync (10s)
              </span>
            </div>

            {sessionContext ? (
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300 flex-wrap">
                <span className="font-heading font-extrabold text-white text-base sm:text-lg text-indigo-300">
                  {sessionContext.className} &bull; {sessionContext.subjectName}
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-slate-300 font-medium">
                  Faculty: <strong className="text-white">{sessionContext.sessionTeacherName}</strong>
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="font-mono text-slate-300">
                  {sessionContext.startTime} – {sessionContext.endTime}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No active practical session currently assigned to projector.
              </p>
            )}
          </div>

          {/* Center: Live KPI Strip for Big Screen */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Seated Students */}
            <div className="glass-card px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">Seated</span>
                <span className="text-sm sm:text-base font-extrabold font-heading text-emerald-400 tabular-nums leading-none">
                  {seatedStudents}
                </span>
              </div>
            </div>

            {/* Available Terminals */}
            <div className="glass-card px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/10">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
                <Users className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">Available</span>
                <span className="text-sm sm:text-base font-extrabold font-heading text-indigo-300 tabular-nums leading-none">
                  {availableCount}
                </span>
              </div>
            </div>

            {/* Out of Service */}
            {outOfServiceCount > 0 && (
              <div className="glass-card px-3 py-1.5 rounded-xl flex items-center gap-2 border border-rose-500/30 bg-rose-950/20">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-mono uppercase text-rose-300 font-bold">Do Not Use</span>
                  <span className="text-sm sm:text-base font-extrabold font-heading text-rose-400 tabular-nums leading-none">
                    {outOfServiceCount}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Clock & Fullscreen Control */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block" suppressHydrationWarning>
              <div className="font-mono font-extrabold text-sm sm:text-base text-white tabular-nums" suppressHydrationWarning>
                {mounted && currentTime ? currentTime : '--:--:--'}
              </div>
              <div className="text-[10px] text-slate-400 font-medium" suppressHydrationWarning>
                {mounted && currentDateString ? currentDateString : 'LabSync Live'}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-9 px-3 text-xs rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white gap-1.5"
              title="Toggle Fullscreen Projector Mode (F11)"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </Button>

            <Link href="/computer-lab">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3 text-xs rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cockpit</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN HERO WALL CANVAS                                      */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 relative w-full overflow-hidden p-4 sm:p-8 flex items-center justify-center">
        <div
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 80%),
              linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
            `,
            backgroundSize: '100% 100%, 36px 36px, 36px 36px',
          }}
          className="relative w-full max-w-[1800px] aspect-[16/9] min-h-[500px] sm:min-h-[640px] rounded-3xl border border-white/10 bg-[#0B0F19] shadow-2xl overflow-hidden"
        >
          {/* Real-Life Architectural Desk Tables & Corridor Structures */}
          <LabDeskStructureOverlay />

          {/* Database Floor Landmarks (Doors, Windows, Board) */}
          {floorElements.map((el) => (
            <FloorLandmarkNode key={el.id} element={el} />
          ))}

          {/* Workstations Canvas */}
          {boardData.workstations.map((ws) => {
            let nodeAssignment: any = null
            let isPresent: boolean | undefined = undefined

            if (sessionContext) {
              const liveAssigned = sessionContext.seatPlan[ws.id]
              if (liveAssigned) {
                nodeAssignment = {
                  student_id: liveAssigned.studentId,
                  student_name: liveAssigned.fullName,
                  roll_number: liveAssigned.rollNumber,
                  enrollment_id: liveAssigned.enrollmentId,
                  is_override: liveAssigned.isOverride,
                  photo_url: (liveAssigned as any).photoUrl || (liveAssigned as any).photo_url || null,
                }
                isPresent = sessionContext.existingAttendance?.[liveAssigned.rollNumber] !== false
              }
            }

            const wsWithAssignment = {
              ...ws,
              assignment: nodeAssignment,
              session_override: nodeAssignment?.is_override
                ? {
                    override_id: 'temp',
                    student_name: nodeAssignment.student_name,
                    roll_number: nodeAssignment.roll_number,
                    photo_url: nodeAssignment.photo_url || null,
                  }
                : null,
              isPresent,
            }

            return (
              <WorkstationNode
                key={ws.id}
                workstation={wsWithAssignment as any}
                isSeatPlanMode={true}
                density="projector"
              />
            )
          })}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* 3. PROJECTOR FOOTER / STUDENT LEGEND                          */}
      {/* ------------------------------------------------------------- */}
      <footer className="p-3 sm:p-4 bg-[#0B0F19]/90 border-t border-white/[0.08] text-xs text-slate-300">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="font-medium text-slate-200">Your Seat (Assigned)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
              <span className="font-medium text-slate-200">Temporary Seat Shift</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-600 border border-white/20" />
              <span className="font-medium text-slate-400">Available Desk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              <span className="font-medium text-rose-300">Out of Service (Do Not Sit)</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            <span>LabSync LIMS Projection Display</span>
            <span>&bull;</span>
            <span suppressHydrationWarning>
              Synced: {mounted && lastSyncedText ? lastSyncedText : 'Live'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
