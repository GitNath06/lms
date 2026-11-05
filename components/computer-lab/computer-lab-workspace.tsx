'use client'

import React, { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import Link from 'next/link'
import {
  Monitor,
  Users,
  Wrench,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
  ArrowRightLeft,
  X,
  FileCheck,
  ShieldAlert,
  Search,
  Check,
  Tag,
  GraduationCap,
  Printer,
  LayoutGrid,
  Maximize2,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { WorkstationNode } from '@/components/maintenance/workstations/workstation-node'
import { FloorLandmarkNode } from '@/components/maintenance/workstations/floor-landmark-node'
import { WorkstationIssueDrawer } from '@/components/maintenance/workstations/workstation-issue-drawer'
import { StudentTray } from '@/components/maintenance/workstations/student-tray'
import { LiveCockpitBar } from './live-cockpit-bar'
import { CanvasControlsHud } from './canvas-controls-hud'
import { CanvasMinimapRadar } from './canvas-minimap-radar'
import { StartAdHocSessionModal } from './start-adhoc-session-modal'
import { LabDeskStructureOverlay } from './lab-desk-structure-overlay'
import { MobileBenchRollcallView } from './mobile-bench-rollcall-view'
import { useCanvasViewport } from '@/hooks/use-canvas-viewport'
import {
  getLiveSessionContext,
  submitLiveSession,
  assignSessionSeatOverride,
  type LiveSessionContext,
} from '@/app/actions/live-session'
import {
  getEffectiveDate,
  isSimulatingTime,
  TIME_TRAVEL_EVENT,
  resetToLiveTime,
} from '@/lib/time-simulator'
import { getNepalDateStr, getNepaliDate } from '@/lib/nepali-date'
import { sortSessionsChronologically } from '@/lib/utils'
import { deduplicateWorkstationCoordinates } from '@/lib/workstations/layout-engine'
import { createPracticalLog } from '@/app/actions/logs'
import dynamic from 'next/dynamic'
import { useRoutineState } from '@/hooks/use-routine-state'
import { useLogsState } from '@/hooks/use-logs-state'
import type { ModalMode } from '@/components/schedules/session-action-modal'

const SessionActionModal = dynamic(() => import('@/components/schedules/session-action-modal'), {
  ssr: false,
})
import {
  getLabSeatPlan,
  getAuthorizedClasses,
  assignStudentToSeat,
  swapStudents,
  clearSeatAssignment,
  autoAssignRemainingSeats,
  clearAllCohortSeats,
} from '@/app/actions/seat-plans'
import { DisplacedStudentsQueue, type DisplacedStudent } from './displaced-students-queue'
import { type LiveAssistanceItem } from './terminal-assistance-queue'
import { getLiveAssistanceRequests, acknowledgeAssistanceRequest } from '@/app/actions/terminal'
import { getAcademicYears } from '@/app/actions/academic-years'
import { getLabFloorElements } from '@/app/actions/floor-elements'
import { getWorkstationBoardData } from '@/app/actions/workstations'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import { useUserScope } from '@/hooks/use-user-scope'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { evaluateDateSuspension } from '@/lib/calendar-policy'
import { subscribeToSync, broadcastSync } from '@/lib/sync-bus'
import { getCachedData, setCachedData, invalidateCacheByPrefix, fetchWithClientCache } from '@/lib/cache/client-query-cache'
import type { WorkstationBoardData, WorkstationWithIssues } from '@/types/workstations'
import type { CohortSeatPlanData, WorkstationWithAssignment } from '@/lib/types/seat-plans'
import type { StudentWithEnrollment } from '@/lib/types/students'
import type { LabFloorElementRow } from '@/types/database'

export type WorkspaceMode = 'live' | 'baseline'

const defaultBoardData: WorkstationBoardData = {
  lab_id: 'comp',
  lab_name: 'Computer Lab 01',
  workstations: [],
  categories: [],
  active_issues: [],
  metrics: { total: 0, operational: 0, flagged: 0, under_repair: 0, open_issues_count: 0 },
  is_privileged: true,
  user_role: 'super_admin',
  user_id: '',
  user_name: 'Administrator',
}

interface ComputerLabWorkspaceProps {
  initialBoardData?: WorkstationBoardData
  initialLabFacility?: {
    id: string
    name: string
    code: string
    capacity: number
    type: string
    status: string
    is_active?: boolean
  }
  scheduledSessions?: Array<{
    id: string
    startTime: string
    endTime: string
    dayKey: string
    subjectName: string
    batchName: string
    teacherName: string
    classSubjectId: string
  }>
  authorizedClasses?: Array<{ id: string; name: string }>
  authorizedSubjects?: Array<{
    id: string
    code: string
    name: string
    classId: string
    className: string
  }>
  classSubjects?: Array<{
    id: string
    classId: string
    subjectId: string
    className: string
    subjectName: string
    subjectCode: string
  }>
  isPrivileged?: boolean
  isTeacher?: boolean
  initialServerTimeIso?: string
}

export function ComputerLabWorkspace({
  initialBoardData,
  initialLabFacility,
  scheduledSessions: propScheduledSessions,
  authorizedClasses: propAuthorizedClasses,
  authorizedSubjects: propAuthorizedSubjects,
  classSubjects: propClassSubjects,
  isPrivileged: propIsPrivileged,
  isTeacher: propIsTeacher,
  initialServerTimeIso,
}: ComputerLabWorkspaceProps = {}) {
  // 1. Primary Unified Mode Switcher (Zero duplicate tab strips)
  const [mode, setMode] = useState<WorkspaceMode>('live')
  const [mobileLabView, setMobileLabView] = useState<'canvas' | 'bench_list'>('bench_list')

  // Live Facility Infrastructure State & Calendar Policy
  const { labs, holidays, classes: infraClasses, subjects: infraSubjects } = useInfrastructureState()
  const { scope: userScope } = useUserScope()
  const {
    routines,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    skipSession,
    unskipSession,
  } = useRoutineState()
  const calendarSettings = useCalendarSettings()
  const currentLab =
    labs?.find((l) => l.id === 'comp' || l.type === 'computer_lab') ||
    initialLabFacility || {
      id: 'comp',
      name: 'Computer Lab 01',
      code: 'COM-LAB',
      capacity: 40,
      type: 'computer_lab',
      status: 'Operational',
      is_active: true,
    }

  // Derive client authorized classes/subjects from infrastructure bootstrap state if not passed from server
  const authorizedClasses = useMemo(() => {
    if (propAuthorizedClasses && propAuthorizedClasses.length > 0) return propAuthorizedClasses
    return (infraClasses || []).map((c) => ({ id: c.id, name: c.name }))
  }, [propAuthorizedClasses, infraClasses])

  const authorizedSubjects = useMemo(() => {
    if (propAuthorizedSubjects && propAuthorizedSubjects.length > 0) return propAuthorizedSubjects
    return (infraSubjects || []).map((s) => ({
      id: s.code,
      code: s.code,
      name: s.title,
      classId: s.classId || '',
      className: s.grade || '',
    }))
  }, [propAuthorizedSubjects, infraSubjects])

  const classSubjects = useMemo(() => {
    if (propClassSubjects && propClassSubjects.length > 0) return propClassSubjects
    return (infraSubjects || []).map((s) => ({
      id: s.classSubjectId || s.code,
      classId: s.classId || '',
      subjectId: s.code,
      className: s.grade || '',
      subjectName: s.title,
      subjectCode: s.code,
    }))
  }, [propClassSubjects, infraSubjects])

  const scheduledSessions = useMemo(() => {
    if (propScheduledSessions && propScheduledSessions.length > 0) return propScheduledSessions
    return (routines || [])
      .filter((r) => r.labKey === currentLab.id || r.labKey === 'comp')
      .map((r) => ({
        id: r.id,
        startTime: r.timeSlot?.split('-')?.[0]?.trim() || '',
        endTime: r.timeSlot?.split('-')?.[1]?.trim() || '',
        dayKey: r.dayKey,
        subjectName: r.subjectTitle,
        batchName: r.grade,
        teacherName: r.teacher,
        classSubjectId: r.classSubjectId || '',
      }))
  }, [propScheduledSessions, routines, currentLab.id])

  const isPrivileged = propIsPrivileged ?? (userScope?.isPrivileged ?? true)
  const isTeacher = propIsTeacher ?? (userScope?.isTeacher ?? false)

  // Board Data & Landmarks (Hydrate synchronously from cache for 0ms frame-1 render)
  const [boardData, setBoardData] = useState<WorkstationBoardData>(() => {
    const cached = getCachedData<WorkstationBoardData>(`workstations:board:${initialLabFacility?.id || 'comp'}`)
    return cached || initialBoardData || defaultBoardData
  })
  const [floorElements, setFloorElements] = useState<LabFloorElementRow[]>(() => {
    const cached = getCachedData<any>(`workstations:elements:${initialLabFacility?.id || 'comp'}`)
    if (Array.isArray(cached)) return cached
    if (cached && Array.isArray(cached.data)) return cached.data
    if (Array.isArray(initialBoardData?.floor_elements)) return initialBoardData.floor_elements
    return []
  })
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  // Workstation coordinate deduplication to guarantee zero stacked cards on the CAD canvas
  const renderedWorkstations = React.useMemo(() => {
    return deduplicateWorkstationCoordinates(boardData.workstations)
  }, [boardData.workstations])

  // -------------------------------------------------------------
  // SIMULATED / LIVE TIME ENGINE INTEGRATION
  // -------------------------------------------------------------
  const [isMounted, setIsMounted] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState<Date>(() =>
    initialServerTimeIso ? new Date(initialServerTimeIso) : new Date()
  )
  const [isSimulating, setIsSimulating] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileLabView('bench_list')
    }
    const syncTime = () => {
      setEffectiveDate(getEffectiveDate())
      setIsSimulating(isSimulatingTime())
    }

    syncTime()
    const timer = setInterval(syncTime, 1000)
    window.addEventListener(TIME_TRAVEL_EVENT, syncTime)
    window.addEventListener('storage', syncTime)

    return () => {
      clearInterval(timer)
      window.removeEventListener(TIME_TRAVEL_EVENT, syncTime)
      window.removeEventListener('storage', syncTime)
    }
  }, [])

  // Derived calendar & time info in Nepal Standard Time (UTC+5:45)
  const { currentDayKey, effectiveDateStr, currentMinutes, timeDisplayStr, nepaliDateInfo } = React.useMemo(() => {
    const dateStr = getNepalDateStr(effectiveDate)
    const nptMs = effectiveDate.getTime() + 5.75 * 3600000
    const nptDate = new Date(nptMs)
    const dayIndex = nptDate.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    const dayKey = DAY_KEYS[dayIndex]
    const minsFromMidnight = nptDate.getUTCHours() * 60 + nptDate.getUTCMinutes()
    const timeStr = effectiveDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
    const nepaliInfo = getNepaliDate(effectiveDate)

    return {
      currentDayKey: dayKey,
      effectiveDateStr: dateStr,
      currentMinutes: minsFromMidnight,
      timeDisplayStr: timeStr,
      nepaliDateInfo: nepaliInfo,
    }
  }, [effectiveDate])

  const parseTimeToMinutes = useCallback((timeStr: string): number => {
    if (!timeStr) return 0
    const parts = timeStr.trim().split(':')
    let hours = parseInt(parts[0], 10) || 0
    const mins = parseInt(parts[1], 10) || 0
    if (hours >= 1 && hours <= 6) {
      hours += 12
    }
    return hours * 60 + mins
  }, [])

  // Institutional Calendar & Recess Policy Evaluator
  const dateSuspension = React.useMemo(() => {
    return evaluateDateSuspension(effectiveDateStr, holidays, calendarSettings)
  }, [effectiveDateStr, holidays, calendarSettings])

  // -------------------------------------------------------------
  // MODE A: LIVE SESSION STATE & ROUTINE/LOG HOOKS
  // -------------------------------------------------------------
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [sessionContext, setSessionContext] = useState<LiveSessionContext | null>(null)
  const [sessionAttendance, setSessionAttendance] = useState<Record<string, boolean>>({})
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [sessionToast, setSessionToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const { logs, refreshLogs } = useLogsState()

  const isSessionSkipped = useCallback(
    (sessionId: string) => {
      const routine = routines.find((r) => r.id === sessionId)
      if (routine?.isSkipped || routine?.status === 'skipped') return true
      const log = logs.find(
        (l) => (l.sessionId === sessionId || l.id === sessionId) && l.date === effectiveDateStr
      )
      if (log?.status === 'skipped') return true
      if (sessionContext?.scheduleId === sessionId && sessionContext.existingLog?.status === 'skipped') {
        return true
      }
      return false
    },
    [routines, logs, effectiveDateStr, sessionContext]
  )

  const isSessionLogged = useCallback(
    (sessionId: string) => {
      const log = logs.find(
        (l) => (l.sessionId === sessionId || l.id === sessionId) && l.date === effectiveDateStr
      )
      if (log && log.status !== 'skipped') return true
      if (
        sessionContext?.scheduleId === sessionId &&
        sessionContext.existingLog &&
        sessionContext.existingLog.status !== 'skipped'
      ) {
        return true
      }
      return false
    },
    [logs, effectiveDateStr, sessionContext]
  )

  // 1. Identify today's sessions (sorted chronologically)
  const todaySessions = React.useMemo(() => {
    if (dateSuspension.isSuspended) return []
    return sortSessionsChronologically(
      scheduledSessions.filter(
        (s) => s.dayKey?.toLowerCase() === currentDayKey.toLowerCase()
      )
    )
  }, [scheduledSessions, currentDayKey, dateSuspension.isSuspended])

  // Priority 1 (LIVE): Non-skipped session where T_start <= now < T_end
  const liveOngoingSession = React.useMemo(() => {
    if (dateSuspension.isSuspended) return null
    for (const s of todaySessions) {
      if (isSessionSkipped(s.id)) continue
      const startMin = parseTimeToMinutes(s.startTime)
      const endMin = parseTimeToMinutes(s.endTime)
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        return s
      }
    }
    return null
  }, [todaySessions, currentMinutes, parseTimeToMinutes, isSessionSkipped, dateSuspension.isSuspended])

  // Consecutive / Upcoming Session (Starts within next 10 minutes, non-skipped)
  const nextUpcomingSession = React.useMemo(() => {
    if (dateSuspension.isSuspended) return null
    for (const s of todaySessions) {
      if (isSessionSkipped(s.id)) continue
      if (liveOngoingSession && s.id === liveOngoingSession.id) continue
      const diff = parseTimeToMinutes(s.startTime) - currentMinutes
      if (diff > 0 && diff <= 10) {
        return s
      }
    }
    return null
  }, [todaySessions, liveOngoingSession, currentMinutes, parseTimeToMinutes, isSessionSkipped, dateSuspension.isSuspended])

  const upcomingStartsInMins = React.useMemo(() => {
    if (!nextUpcomingSession) return null
    const diff = parseTimeToMinutes(nextUpcomingSession.startTime) - currentMinutes
    return diff > 0 && diff <= 10 ? diff : null
  }, [nextUpcomingSession, currentMinutes, parseTimeToMinutes])

  // Up Next Micro-Pill for back-to-back sessions during Live Session
  const upNextMicroPill = React.useMemo(() => {
    if (!liveOngoingSession || !nextUpcomingSession || upcomingStartsInMins === null) return null
    const matchedCs = classSubjects.find((cs) => cs.id === nextUpcomingSession.classSubjectId)
    const code = matchedCs?.subjectCode || nextUpcomingSession.subjectName.split(' ')[0] || 'COMP'
    return {
      subjectCode: code,
      subjectName: nextUpcomingSession.subjectName,
      batchName: nextUpcomingSession.batchName,
      className: nextUpcomingSession.batchName,
      startsInMins: upcomingStartsInMins,
    }
  }, [liveOngoingSession, nextUpcomingSession, upcomingStartsInMins, classSubjects])

  // Screen Wake Lock: Keep phone display awake while conducting active live lab sessions
  const isWakeLockActive = mode === 'live' && (Boolean(liveOngoingSession) || Boolean(sessionContext))
  useWakeLock(isWakeLockActive)

  // Non-Blocking Concluded Grace Handling:
  // If no live session is active, check if a session ended within the last 5 minutes and is unlogged
  const concludedGraceSession = React.useMemo(() => {
    if (dateSuspension.isSuspended || liveOngoingSession) return null
    for (const s of todaySessions) {
      if (isSessionSkipped(s.id) || isSessionLogged(s.id)) continue
      const endMin = parseTimeToMinutes(s.endTime)
      const endedAgo = currentMinutes - endMin
      if (endedAgo >= 0 && endedAgo <= 5) {
        return s
      }
    }
    return null
  }, [todaySessions, liveOngoingSession, currentMinutes, parseTimeToMinutes, isSessionSkipped, isSessionLogged, dateSuspension.isSuspended])

  // Any unlogged past sessions concluded > 5 minutes ago (for non-blocking reminder banner)
  const unloggedPastSession = React.useMemo(() => {
    if (dateSuspension.isSuspended) return null
    for (const s of todaySessions) {
      if (isSessionSkipped(s.id) || isSessionLogged(s.id)) continue
      const endMin = parseTimeToMinutes(s.endTime)
      const endedAgo = currentMinutes - endMin
      if (endedAgo > 5) {
        return s
      }
    }
    return null
  }, [todaySessions, currentMinutes, parseTimeToMinutes, isSessionSkipped, isSessionLogged, dateSuspension.isSuspended])

  // Next session preview for Free Period telemetry
  const nextPreviewSession = React.useMemo(() => {
    if (dateSuspension.isSuspended) return null
    for (const s of todaySessions) {
      if (isSessionSkipped(s.id)) continue
      const diff = parseTimeToMinutes(s.startTime) - currentMinutes
      if (diff > 0) {
        return s
      }
    }
    return null
  }, [todaySessions, currentMinutes, parseTimeToMinutes, isSessionSkipped, dateSuspension.isSuspended])

  // Three-Tier Auto Target Evaluator:
  // 1. liveOngoingSession (Priority 1)
  // 2. concludedGraceSession (Priority 1.5 - within 5m after end_time, not skipped, not logged)
  // 3. nextUpcomingSession (Priority 2 - Standby Hold within 10m)
  // 4. null (Priority 3 - Free Lab)
  const autoTargetSession = React.useMemo(() => {
    if (dateSuspension.isSuspended) return null
    if (liveOngoingSession) return liveOngoingSession
    if (concludedGraceSession) return concludedGraceSession
    if (nextUpcomingSession) return nextUpcomingSession
    return null
  }, [dateSuspension.isSuspended, liveOngoingSession, concludedGraceSession, nextUpcomingSession])

  // Derived Timing Status for Selected Live/Upcoming/Past Session
  const sessionTimingStatus = React.useMemo(() => {
    if (!sessionContext) return null
    const startMin = parseTimeToMinutes(sessionContext.startTime)
    const endMin = parseTimeToMinutes(sessionContext.endTime)
    if (currentMinutes < startMin) {
      return {
        status: 'upcoming' as const,
        startsInMins: Math.max(1, startMin - currentMinutes),
      }
    }
    if (currentMinutes >= startMin && currentMinutes < endMin) {
      return {
        status: 'live' as const,
        minsRemaining: endMin - currentMinutes,
      }
    }
    return {
      status: 'past' as const,
    }
  }, [sessionContext, currentMinutes, parseTimeToMinutes])

  const [isSessionActionModalOpen, setIsSessionActionModalOpen] = useState(false)
  const [sessionActionModalMode, setSessionActionModalMode] = useState<ModalMode>('log')

  // Synthetic MasterRoutineItem mapping for the unified SessionActionModal
  const modalSessionItem = React.useMemo(() => {
    if (!sessionContext) return null
    const matched = routines.find((r) => r.id === sessionContext.scheduleId)
    if (matched) return matched

    return {
      id: sessionContext.scheduleId,
      dayKey: (sessionContext.dayKey || currentDayKey) as any,
      slotId: 't2',
      timeSlot: `${sessionContext.startTime} - ${sessionContext.endTime}`,
      subjectCode: sessionContext.subjectCode,
      subjectTitle: sessionContext.subjectName,
      grade: sessionContext.className,
      gradeKey: ('class-' + (sessionContext.grade || 12)) as any,
      teacher: sessionContext.sessionTeacherName,
      lab: sessionContext.labName,
      labKey: 'comp' as const,
      defaultStudents: sessionContext.expectedRoster.length,
      category: 'Computer',
      status: 'confirmed' as const,
    }
  }, [sessionContext, routines, currentDayKey])

  // Frozen attendance record for pre-filling SessionActionModal only if real log exists
  const modalExistingLog = React.useMemo(() => {
    if (!sessionContext?.existingLog) return null
    return {
      id: sessionContext.existingLog.id,
      sessionId: sessionContext.scheduleId,
      date: sessionContext.date,
      dayKey: sessionContext.dayKey || currentDayKey,
      slotId: 't2',
      timeSlot: `${sessionContext.startTime} - ${sessionContext.endTime}`,
      subjectCode: sessionContext.subjectCode,
      subjectTitle: sessionContext.subjectName,
      grade: sessionContext.className,
      teacher: sessionContext.sessionTeacherName,
      lab: sessionContext.labName,
      labId: 'comp',
      status: (sessionContext.existingLog.status as any) || 'conducted',
      topicLearned: sessionContext.existingLog.practicalTitle || '',
      totalStudents: sessionContext.expectedRoster.length,
      presentStudents: sessionContext.existingLog.presentStudents,
      absentStudents: sessionContext.existingLog.absentStudents,
      absentRolls: sessionContext.existingLog.absentRolls || [],
      remarks: sessionContext.existingLog.skipReason || '',
      skipReason: sessionContext.existingLog.skipReason || '',
      createdAt: sessionContext.existingLog.createdAt,
    }
  }, [sessionContext, currentDayKey])

  // Live CAD attendance roll tally for pre-filling newly initiated practical records
  const liveAbsentRolls = React.useMemo(() => {
    if (!sessionContext) return []
    return sessionContext.expectedRoster
      .filter((s) => {
        const isPres =
          sessionAttendance[s.enrollmentId] ??
          (sessionAttendance[s.rollNumber] !== undefined ? sessionAttendance[s.rollNumber] : true)
        return isPres === false
      })
      .map((s) => s.rollNumber)
  }, [sessionContext, sessionAttendance])

  // Build live 48-station seating snapshot from board workstations
  const currentSeatingSnapshot = React.useMemo(() => {
    if (!sessionContext) return null
    return boardData.workstations.map((ws: any) => {
      const student = ws.session_override || ws.assignment
      const rollNumber = student?.roll_number ?? null
      const enrollmentId = student?.enrollment_id || student?.enrollmentId || null
      const isAbsent = enrollmentId
        ? sessionAttendance[enrollmentId] === false
        : rollNumber !== null
        ? sessionAttendance[rollNumber] === false
        : false
      return {
        workstation_id: ws.id,
        workstation_label: ws.label,
        row_label: ws.row_label || null,
        student_id: student?.student_id || student?.studentId || null,
        enrollment_id: enrollmentId,
        student_name: student?.student_name || student?.studentName || null,
        roll_number: rollNumber,
        is_present: student ? !isAbsent : false,
        is_override: Boolean(ws.session_override),
        original_workstation_label: ws.session_override?.original_workstation_label || null,
        notes: ws.session_override ? 'Session relocation override' : null,
      }
    })
  }, [sessionContext, boardData.workstations, sessionAttendance])

  // Save practical log with topic learned and universal 48-station seating snapshot
  const handleSaveLogFromModal = async (logData: any) => {
    if (!sessionContext) return
    setIsSavingSession(true)
    try {
      const sanitizedAbsent = Array.isArray(logData.absentRolls) ? logData.absentRolls : []
      const seatingSnapshotToSave = boardData.workstations.map((ws: any) => {
        const student = ws.session_override || ws.assignment
        const rollNumber = student?.roll_number ?? null
        const isAbsent = rollNumber !== null ? sanitizedAbsent.includes(rollNumber) : false
        return {
          workstation_id: ws.id,
          workstation_label: ws.label,
          row_label: ws.row_label || null,
          student_id: student?.student_id || student?.studentId || null,
          enrollment_id: student?.enrollment_id || student?.enrollmentId || null,
          student_name: student?.student_name || student?.studentName || null,
          roll_number: rollNumber,
          is_present: student ? !isAbsent : false,
          is_override: Boolean(ws.session_override),
          original_workstation_label: ws.session_override?.original_workstation_label || null,
          notes: ws.session_override ? 'Session relocation override' : null,
        }
      })

      const targetSessionDate = sessionContext.date || effectiveDateStr || logData.date

      const res = await createPracticalLog({
        id: logData.id || sessionContext.existingLog?.id,
        schedule_id: sessionContext.scheduleId,
        class_subject_id: sessionContext.classSubjectId,
        lab_id: 'comp',
        date: targetSessionDate,
        period_label: logData.timeSlot || `${sessionContext.startTime} – ${sessionContext.endTime}`,
        subject_name: logData.subjectTitle?.toLowerCase().startsWith(logData.subjectCode.toLowerCase())
          ? logData.subjectTitle
          : `${logData.subjectCode} - ${logData.subjectTitle}`,
        batch_group: logData.grade || sessionContext.className,
        practical_title: logData.topicLearned || `${sessionContext.subjectName} Practical Session`,
        total_students: logData.totalStudents,
        present_students: logData.presentStudents,
        absent_students: logData.absentStudents,
        absent_rolls: sanitizedAbsent,
        remarks: logData.remarks || null,
        status: logData.status || 'conducted',
        skip_reason: logData.skipReason || null,
        topic_learned: logData.topicLearned,
        seating_snapshot: seatingSnapshotToSave,
      })

      if (res.success) {
        refreshLogs()
        broadcastSync('logs', { sessionId: sessionContext.scheduleId, date: targetSessionDate, status: 'conducted' })
        broadcastSync('schedules', { labId: currentLab.id, scheduleId: sessionContext.scheduleId, status: 'completed' })
        setSessionToast({
          text: 'Practical session log & workstation seating recorded successfully!',
          type: 'success',
        })
        setIsSessionActionModalOpen(false)
        await fetchLiveSession(sessionContext.scheduleId, targetSessionDate)
      } else {
        setSessionToast({ text: res.error || 'Failed to record practical session log.', type: 'error' })
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error recording log.', type: 'error' })
    } finally {
      setIsSavingSession(false)
    }
  }

  // Record skipped session through the unified modal
  const handleSkipFromModal = async (sessionId: string, reason: string) => {
    if (!sessionContext) return
    setIsSavingSession(true)
    try {
      const targetSessionDate = sessionContext.date || effectiveDateStr
      const res = await createPracticalLog({
        schedule_id: sessionContext.scheduleId,
        class_subject_id: sessionContext.classSubjectId,
        lab_id: 'comp',
        date: targetSessionDate,
        period_label: `${sessionContext.startTime} – ${sessionContext.endTime}`,
        subject_name: `${sessionContext.subjectCode} - ${sessionContext.subjectName}`,
        batch_group: sessionContext.className,
        practical_title: `${sessionContext.subjectName} (Skipped)`,
        total_students: sessionContext.expectedRoster.length,
        present_students: 0,
        absent_students: sessionContext.expectedRoster.length,
        status: 'skipped',
        skip_reason: reason,
        remarks: `Practical session skipped: ${reason}`,
      })

      if (res.success) {
        skipSession(sessionId, reason)
        refreshLogs()
        broadcastSync('logs', { sessionId, date: targetSessionDate, status: 'skipped' })
        broadcastSync('schedules', { labId: currentLab.id, scheduleId: sessionId, isSkipped: true })
        setSessionToast({ text: 'Session successfully marked as skipped.', type: 'success' })
        setIsSessionActionModalOpen(false)
        userManuallySelectedRef.current = false
        await fetchLiveSession(sessionId, targetSessionDate)
      } else {
        setSessionToast({ text: res.error || 'Failed to record skipped session.', type: 'error' })
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error skipping session.', type: 'error' })
    } finally {
      setIsSavingSession(false)
    }
  }

  // -------------------------------------------------------------
  // MODE B: BASELINE SEATING STATE (TIER 1)
  // -------------------------------------------------------------
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string }>>([])
  const [selectedYearId, setSelectedYearId] = useState<string>('2083')
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    const priorityClass = authorizedClasses.find(
      (c) => c.id === '12eng' || c.id === '11eng' || c.name.toLowerCase().includes('12') || c.name.toLowerCase().includes('11')
    )
    return priorityClass?.id || authorizedClasses[0]?.id || ''
  })
  const [baselinePlanData, setBaselinePlanData] = useState<CohortSeatPlanData | null>(null)
  const [isSlideDrawerOpen, setIsSlideDrawerOpen] = useState(false)
  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState<StudentWithEnrollment | null>(null)
  const [dragOverWsId, setDragOverWsId] = useState<string | null>(null)

  // -------------------------------------------------------------
  // MODE C: HARDWARE DIAGNOSTICS & UNIFIED WORKSTATION DRAWER
  // -------------------------------------------------------------
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string | null>(null)
  const [selectedWorkstationForIssue, setSelectedWorkstationForIssue] = useState<
    (WorkstationWithIssues & {
      assignment?: any
      session_override?: any
      isPresent?: boolean | null
    }) | null
  >(null)
  const [isIssueDrawerOpen, setIsIssueDrawerOpen] = useState(false)

  // -------------------------------------------------------------
  // CAD VIEWPORT & MINIMAP RADAR STATE
  // -------------------------------------------------------------
  const viewport = useCanvasViewport({
    minZoom: 0.5,
    maxZoom: 1.6,
    zoomStep: 0.15,
  })
  const [isMinimapVisible, setIsMinimapVisible] = useState(false)

  // Active Workstation Click Popover / Modal
  const [activeWsModal, setActiveWsModal] = useState<WorkstationWithAssignment | null>(null)
  const [activeBaselineModalWs, setActiveBaselineModalWs] = useState<any | null>(null)
  const [selectedAssignModalEnrollmentId, setSelectedAssignModalEnrollmentId] = useState<string>('')
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)
  const [overrideStudentEnrollmentId, setOverrideStudentEnrollmentId] = useState<string>('')
  const [liveAssistanceRequests, setLiveAssistanceRequests] = useState<LiveAssistanceItem[]>([])

  // Terminal Display Scale
  const [terminalScale, setTerminalScale] = useState<number>(1.0)

  // 1. Load Initial Landmarks and Meta
  useEffect(() => {
    async function loadMeta() {
      try {
        const labKey = currentLab.id || 'comp'
        const [elements, years] = await Promise.all([
          fetchWithClientCache<LabFloorElementRow[]>(
            `workstations:elements:${labKey}`,
            async () => {
              const res = await getLabFloorElements(labKey)
              return res.success && Array.isArray(res.data) ? res.data : []
            },
            { staleTimeMs: 60_000 }
          ),
          fetchWithClientCache<any[]>(
            'academic-years:list',
            async () => {
              const res = await getAcademicYears()
              return res.success && Array.isArray(res.data) ? res.data : []
            },
            { staleTimeMs: 120_000 }
          ),
        ])
        const safeElements = Array.isArray(elements)
          ? elements
          : (elements && Array.isArray((elements as any).data) ? (elements as any).data : [])
        setFloorElements(safeElements)
        const safeYears = Array.isArray(years) ? years : []
        setAcademicYears(safeYears)
        const curr = safeYears.find((y: any) => y.is_current)
        if (curr) setSelectedYearId(curr.id)
      } catch (err) {
        console.error('Failed to load initial workspace meta:', err)
      }
    }
    loadMeta()
  }, [currentLab.id])

  // Auto-dismiss floating toast notifications after 3.5 seconds
  useEffect(() => {
    if (!sessionToast) return
    const timer = setTimeout(() => {
      setSessionToast(null)
    }, 3500)
    return () => clearTimeout(timer)
  }, [sessionToast])

  // Auto-fit CAD canvas when viewport width is between 768px and 1280px so dual wings maintain clean margins
  useEffect(() => {
    const handleAutoFit = () => {
      if (typeof window === 'undefined') return
      const width = window.innerWidth
      if (width >= 768 && width <= 1280) {
        viewport.fitToScreen()
      }
    }

    const timer = setTimeout(handleAutoFit, 150)
    window.addEventListener('resize', handleAutoFit)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleAutoFit)
    }
  }, [viewport.fitToScreen])

  // 2. Fetch Live Session Context when selectedScheduleId changes or simulated date changes
  const fetchLiveSession = useCallback(async (schedId: string, customDate?: string) => {
    if (!schedId) return
    const dateToUse = customDate || effectiveDateStr
    const cacheKey = `live-session:${schedId}:${dateToUse}`
    const cached = getCachedData<LiveSessionContext>(cacheKey)

    // 0ms Cache Hydration: Render immediately from in-memory cache without loading flash
    if (cached) {
      setSessionContext(cached)
      const cachedAttendance: Record<string, boolean> = {}
      cached.expectedRoster.forEach((s) => {
        const fromAtt =
          cached?.existingAttendance?.[s.enrollmentId] ??
          cached?.existingAttendance?.[s.rollNumber]
        if (fromAtt !== undefined) {
          cachedAttendance[s.enrollmentId] = fromAtt
        } else if (cached?.existingLog?.absentRolls) {
          cachedAttendance[s.enrollmentId] = !cached.existingLog.absentRolls.includes(s.rollNumber)
        } else {
          cachedAttendance[s.enrollmentId] = true
        }
      })
      setSessionAttendance(cachedAttendance)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetchWithClientCache(cacheKey, () => getLiveSessionContext(schedId, dateToUse), { staleTimeMs: 10_000 })
      if (res.success && res.data) {
        setSessionContext(res.data)
        setCachedData(cacheKey, res.data)

        // Initialize attendance map: default all enrolled to Present (true) unless existingLog attendance is found
        const initialAttendance: Record<string, boolean> = {}
        res.data.expectedRoster.forEach((s) => {
          const fromAtt =
            res.data?.existingAttendance?.[s.enrollmentId] ??
            res.data?.existingAttendance?.[s.rollNumber]
          if (fromAtt !== undefined) {
            initialAttendance[s.enrollmentId] = fromAtt
          } else if (res.data?.existingLog?.absentRolls) {
            initialAttendance[s.enrollmentId] = !res.data.existingLog.absentRolls.includes(s.rollNumber)
          } else {
            initialAttendance[s.enrollmentId] = true
          }
        })
        setSessionAttendance(initialAttendance)
      } else {
        setSessionToast({ text: res.error || 'Failed to load session context.', type: 'error' })
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error loading live session.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [effectiveDateStr])

  // Centralized Live Session, Workstation Board & Distress Queue Synchronizer
  const refreshLiveSessionAndBoard = useCallback(async () => {
    try {
      const labKey = currentLab.id || 'comp'
      const schedId = selectedScheduleId || liveOngoingSession?.id
      const [freshBoard, sessionRes, assistanceRes] = await Promise.all([
        fetchWithClientCache(`workstations:board:${labKey}`, () => getWorkstationBoardData(labKey), { staleTimeMs: 30_000 }),
        schedId
          ? fetchWithClientCache(`live-session:${schedId}:${effectiveDateStr}`, () => getLiveSessionContext(schedId, effectiveDateStr), { staleTimeMs: 10_000 })
          : null,
        fetchWithClientCache(`workstations:assistance:${labKey}`, () => getLiveAssistanceRequests(labKey), { staleTimeMs: 15_000 }),
      ])
      if (freshBoard) {
        setBoardData(freshBoard)
        setCachedData(`workstations:board:${labKey}`, freshBoard)
      }
      if (assistanceRes?.success && assistanceRes.requests) {
        setLiveAssistanceRequests(assistanceRes.requests)
      }
      if (sessionRes?.success && sessionRes.data) {
        const liveData = sessionRes.data
        setSessionContext(liveData)
        if (schedId) {
          setCachedData(`live-session:${schedId}:${effectiveDateStr}`, liveData)
        }
        setSessionAttendance((prev) => {
          const next = { ...prev }
          liveData.expectedRoster.forEach((s) => {
            if (next[s.enrollmentId] === undefined) {
              next[s.enrollmentId] = true
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error('Error synchronizing workstation board and live session:', err)
    }
  }, [currentLab.id, selectedScheduleId, liveOngoingSession?.id, effectiveDateStr])

  // Continuous real-time auto-synchronization for Live Cockpit & CAD Floor Telemetry
  useEffect(() => {
    let isMounted = true
    let inFlight = false

    const autoSync = async (force: boolean = false) => {
      if (!isMounted || inFlight) return
      if (!force && typeof document !== 'undefined' && document.hidden) return
      inFlight = true
      try {
        await refreshLiveSessionAndBoard()
      } catch {
        // Silently ignore transient network blips
      } finally {
        inFlight = false
      }
    }

    // 1. Initial sync
    autoSync(true)

    // 2. Continuous 10-second adaptive polling (checks visibility)
    const timer = setInterval(() => autoSync(false), 10000)

    // 3. Instant sync on focus / visibility return (forced)
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        autoSync(true)
      }
    }
    const handleFocus = () => autoSync(true)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    // 4. Instant real-time bus subscription across tabs/devices (forced, updates background tabs too!)
    const unsubWs = subscribeToSync('workstations', () => autoSync(true))
    const unsubAssist = subscribeToSync('assistance', () => autoSync(true))
    const unsubLogs = subscribeToSync('logs', () => {
      refreshLogs()
      autoSync(true)
    })
    const unsubSched = subscribeToSync('schedules', () => autoSync(true))

    return () => {
      isMounted = false
      clearInterval(timer)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubWs()
      unsubAssist()
      unsubLogs()
      unsubSched()
    }
  }, [refreshLiveSessionAndBoard, refreshLogs])

  // Auto-switch to ongoing scheduled session when time travels or period changes
  const prevTargetKeyRef = React.useRef<string>('')
  const prevModeRef = React.useRef<string>(mode)
  const userManuallySelectedRef = React.useRef<boolean>(false)

  useEffect(() => {
    if (mode !== 'live') {
      prevModeRef.current = mode
      return
    }

    const modeJustSwitchedToLive = prevModeRef.current !== 'live'
    prevModeRef.current = mode

    // If day is suspended (holiday/recess), clear any live session state immediately
    if (dateSuspension.isSuspended) {
      if (selectedScheduleId) setSelectedScheduleId('')
      if (sessionContext) setSessionContext(null)
      userManuallySelectedRef.current = false
      prevTargetKeyRef.current = `${effectiveDateStr}_suspended`
      return
    }

    const targetKey = `${effectiveDateStr}_${autoTargetSession?.id || 'free'}`
    if (prevTargetKeyRef.current !== targetKey || modeJustSwitchedToLive) {
      prevTargetKeyRef.current = targetKey

      if (!userManuallySelectedRef.current) {
        if (autoTargetSession) {
          setSelectedScheduleId(autoTargetSession.id)
          fetchLiveSession(autoTargetSession.id, effectiveDateStr)
          broadcastSync('schedules', { labId: currentLab.id, scheduleId: autoTargetSession.id })
        } else {
          // Free Lab: Clear session so Standby Cockpit Bar renders cleanly!
          setSelectedScheduleId('')
          setSessionContext(null)
          broadcastSync('schedules', { labId: currentLab.id, scheduleId: null })
        }
      } else if (selectedScheduleId) {
        // Re-fetch teacher-selected session with new simulated date
        fetchLiveSession(selectedScheduleId, effectiveDateStr)
      }
    }
  }, [
    mode,
    effectiveDateStr,
    autoTargetSession,
    selectedScheduleId,
    dateSuspension.isSuspended,
    fetchLiveSession,
    currentLab.id,
  ])

  // 3. Fetch Baseline Seating Plan when year/class changes in Mode B
  const fetchBaselineSeating = useCallback(async () => {
    if (!selectedClassId || !selectedYearId) return
    const labKey = currentLab.id || 'comp'
    const cacheKey = `seat-plan:${labKey}:${selectedYearId}:${selectedClassId}`
    const cached = getCachedData<CohortSeatPlanData>(cacheKey)

    // 0ms Cache Hydration: Render immediately from in-memory cache without loading flash
    if (cached) {
      setBaselinePlanData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    try {
      const res = await getLabSeatPlan({
        labId: labKey,
        classId: selectedClassId,
        academicYearId: selectedYearId,
      })
      if (res.success && res.data) {
        setBaselinePlanData(res.data)
        setCachedData(cacheKey, res.data)
      }
    } catch (err) {
      console.error('Failed to load baseline seating plan:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedClassId, selectedYearId, currentLab.id])

  useEffect(() => {
    if (mode === 'baseline') {
      fetchBaselineSeating()
    }
  }, [mode, fetchBaselineSeating])

  // -------------------------------------------------------------
  // INTERACTIVE ROLL-CALL HANDLERS (MODE A)
  // -------------------------------------------------------------
  const handleToggleRollPresence = (identifier: string | number) => {
    if (sessionContext?.existingLog?.isLocked) {
      setSessionToast({ text: 'Session is locked. Edit window has expired.', type: 'error' })
      return
    }
    const student =
      typeof identifier === 'string'
        ? sessionContext?.expectedRoster.find((s) => s.enrollmentId === identifier || s.studentId === identifier)
        : sessionContext?.expectedRoster.find((s) => s.rollNumber === identifier)
    const targetKey = student?.enrollmentId || String(identifier)

    try {
      navigator.vibrate?.(10)
    } catch {
      // Ignore vibration errors
    }

    setSessionAttendance((prev) => {
      const currentVal =
        prev[targetKey] ??
        (student?.rollNumber !== undefined ? prev[student.rollNumber] : undefined) ??
        true
      return {
        ...prev,
        [targetKey]: !currentVal,
      }
    })
  }

  const handleMarkAllPresent = () => {
    if (sessionContext?.existingLog?.isLocked) return
    if (!sessionContext) return
    const allPres: Record<string, boolean> = {}
    sessionContext.expectedRoster.forEach((s) => {
      allPres[s.enrollmentId] = true
    })
    setSessionAttendance(allPres)
    setSessionToast({ text: 'All enrolled students marked present.', type: 'success' })
  }

  const handleInvertAttendance = () => {
    if (sessionContext?.existingLog?.isLocked || !sessionContext) return
    setSessionAttendance((prev) => {
      const next: Record<string, boolean> = {}
      sessionContext.expectedRoster.forEach((s) => {
        const currentVal =
          prev[s.enrollmentId] ??
          (prev[s.rollNumber] !== undefined ? prev[s.rollNumber] : true)
        next[s.enrollmentId] = !currentVal
      })
      return next
    })
    setSessionToast({ text: 'Attendance marks inverted.', type: 'success' })
  }

  const handleFocusRoll = (roll: number) => {
    let targetWs: any = null
    if (mode === 'live' && sessionContext) {
      for (const [wsId, student] of Object.entries(sessionContext.seatPlan)) {
        if (student.rollNumber === roll) {
          targetWs = boardData.workstations.find((w) => w.id === wsId)
          break
        }
      }
    } else if (mode === 'baseline' && baselinePlanData) {
      const found = baselinePlanData.workstations.find((w) => w.assignment?.roll_number === roll)
      if (found) targetWs = found
    }

    if (targetWs) {
      viewport.focusWorkstation(targetWs.id, targetWs.pos_x, targetWs.pos_y)
      setSessionToast({ text: `Focused on Roll ${roll} at ${targetWs.label}`, type: 'success' })
    } else {
      setSessionToast({ text: `Roll ${roll} is not currently seated at a workstation.`, type: 'error' })
    }
  }

  const handleSubmitSession = async () => {
    if (!sessionContext) return
    setIsSavingSession(true)
    setSessionToast(null)

    try {
      const attendancePayload = sessionContext.expectedRoster.map((s) => {
        const isPres =
          sessionAttendance[s.enrollmentId] ??
          (sessionAttendance[s.rollNumber] !== undefined ? sessionAttendance[s.rollNumber] : true)
        return {
          studentId: s.studentId,
          enrollmentId: s.enrollmentId,
          rollNumber: s.rollNumber,
          isPresent: isPres !== false,
        }
      })

      const res = await submitLiveSession({
        scheduleId: sessionContext.scheduleId,
        practicalTitle: sessionContext.existingLog?.practicalTitle || `${sessionContext.subjectCode} Practical Session`,
        date: sessionContext.date,
        attendance: attendancePayload,
      })

      if (!res.success) {
        setSessionToast({ text: res.error || 'Failed to submit session log.', type: 'error' })
      } else {
        setSessionToast({ text: 'Practical session attendance saved & submitted successfully!', type: 'success' })
        fetchLiveSession(sessionContext.scheduleId)
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error submitting session log.', type: 'error' })
    } finally {
      setIsSavingSession(false)
    }
  }

  // Baseline Manual Seat Assignment Handlers (Mode B)
  const handleAssignStudentToStation = async (
    enrollmentId: string,
    workstationId: string,
    studentName: string,
    rollNumber: number,
    wsLabel: string
  ) => {
    if (!isPrivileged) return
    setLoading(true)
    try {
      const res = await assignStudentToSeat({
        lab_id: 'comp',
        class_id: selectedClassId,
        academic_year_id: selectedYearId,
        workstation_id: workstationId,
        enrollment_id: enrollmentId,
      })
      if (res.success) {
        setSessionToast({
          text: `Assigned Roll ${rollNumber} (${studentName}) to ${wsLabel}.`,
          type: 'success',
        })
        await fetchBaselineSeating()
        refreshLiveSessionAndBoard()
      } else {
        setSessionToast({ text: res.error || 'Failed to assign seat.', type: 'error' })
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error assigning seat.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDropStudentOnStation = async (e: React.DragEvent, targetWs: any) => {
    if (!isPrivileged) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverWsId(null)

    try {
      const raw = e.dataTransfer.getData('application/json')
      if (!raw) return
      const payload = JSON.parse(raw)
      if (payload.type === 'student' && payload.enrollment_id) {
        await handleAssignStudentToStation(
          payload.enrollment_id,
          targetWs.id,
          payload.student_name,
          payload.roll_number,
          targetWs.label
        )
      }
    } catch (err: any) {
      console.error('Error handling student drop:', err)
      setSessionToast({ text: 'Failed to process student assignment.', type: 'error' })
    }
  }

  // Handle Workstation Node Click depending on Mode
  const handleWorkstationClick = (ws: any) => {
    if (mode === 'live') {
      const fullWs = boardData.workstations.find((w) => w.id === ws.id) || ws
      setSelectedWorkstationId(ws.id)
      setSelectedWorkstationForIssue({
        ...fullWs,
        assignment: ws.assignment,
        session_override: ws.session_override,
        isPresent: ws.isPresent,
      })
      setIsIssueDrawerOpen(true)
    } else if (mode === 'baseline') {
      if (selectedStudentForAssign) {
        if (!isPrivileged) {
          setSessionToast({
            text: 'View only: Administrative role required to modify seating allocations.',
            type: 'error',
          })
          return
        }
        handleAssignStudentToStation(
          selectedStudentForAssign.enrollment_id,
          ws.id,
          selectedStudentForAssign.full_name,
          selectedStudentForAssign.roll_number,
          ws.label
        )
        setSelectedStudentForAssign(null)
        return
      }
      // If no student is pre-selected: open the Baseline Workstation Modal
      setActiveBaselineModalWs(ws)
    }
  }



  // Workstation Telemetry Counts
  const totalWorkstations = boardData.workstations.length
  const operationalCount = boardData.workstations.filter((w) => w.status === 'operational').length
  const faultCount = boardData.workstations.filter((w) => w.status === 'flagged' || ((w.active_issues?.length || 0) > 0)).length
  const repairCount = boardData.workstations.filter((w) => w.status === 'under_repair').length

  // Live Attendance Present Count
  const livePresentCount = sessionContext
    ? sessionContext.expectedRoster.filter((s) => {
        const isPres =
          sessionAttendance[s.enrollmentId] ??
          (sessionAttendance[s.rollNumber] !== undefined ? sessionAttendance[s.rollNumber] : true)
        return isPres !== false
      }).length
    : 0

  // 4. Compute Displaced & Unseated Students in Live Session Mode
  const displacedStudents = React.useMemo(() => {
    if (!sessionContext || mode !== 'live') return []

    const wsStatusMap = new Map<string, WorkstationWithIssues>()
    boardData.workstations.forEach((w) => wsStatusMap.set(w.id, w))

    const displaced: DisplacedStudent[] = []
    const seatedEnrollmentIds = new Set<string>()

    // Case 1: Workstations with assigned students that are faulted, under repair, or hardware-flagged
    for (const [wsId, student] of Object.entries(sessionContext.seatPlan)) {
      if (student.isOverride) {
        seatedEnrollmentIds.add(student.enrollmentId)
        continue
      }

      const ws = wsStatusMap.get(wsId)
      if (!ws || ws.is_active === false) {
        // Workstation was removed or decommissioned; student is unseated
        continue
      }

      seatedEnrollmentIds.add(student.enrollmentId)

      // If student is marked absent, they are not in the lab today and do not need relocation
      const isAbsent =
        (sessionAttendance[student.enrollmentId] ??
          (sessionAttendance[student.rollNumber] !== undefined ? sessionAttendance[student.rollNumber] : true)) ===
        false
      if (isAbsent) continue

      const isBroken =
        ws.status === 'under_repair' ||
        ws.status === 'flagged' ||
        (ws.active_issues &&
          ws.active_issues.some(
            (i) => i.status !== 'resolved' && (i.severity === 'critical' || i.severity === 'high')
          ))

      if (isBroken) {
        const primaryIssue = ws.active_issues?.[0]
        displaced.push({
          studentName: student.fullName,
          rollNumber: student.rollNumber,
          studentId: student.studentId,
          enrollmentId: student.enrollmentId,
          originalWsId: ws.id,
          originalWsLabel: ws.label,
          issueTitle: primaryIssue?.title || (ws.status === 'under_repair' ? 'Under Repair' : 'Hardware Fault'),
          severity: (primaryIssue?.severity as any) || 'high',
          type: 'faulted',
        })
      }
    }

    // Case 2: Enrolled cohort students who currently have NO workstation assigned
    // (e.g. workstation was deleted in CAD Floor Architect or student is unseated)
    for (const student of sessionContext.expectedRoster) {
      if (seatedEnrollmentIds.has(student.enrollmentId)) continue
      // If student is marked absent, they don't need a seat today
      const isAbsent =
        (sessionAttendance[student.enrollmentId] ??
          (sessionAttendance[student.rollNumber] !== undefined ? sessionAttendance[student.rollNumber] : true)) ===
        false
      if (isAbsent) continue

      displaced.push({
        studentName: student.fullName,
        rollNumber: student.rollNumber,
        studentId: student.studentId,
        enrollmentId: student.enrollmentId,
        originalWsId: '',
        originalWsLabel: 'Unassigned',
        issueTitle: 'No workstation allocated',
        severity: 'medium',
        type: 'unassigned',
      })
    }

    return displaced
  }, [sessionContext, boardData.workstations, mode, sessionAttendance])

  // Available operational workstations for temporary relocation
  // A workstation is available if:
  // 1. It is operational & active (not under repair or flagged with open faults)
  // 2. AND either has no student assigned OR its assigned student is marked absent for this session.
  const availableRelocationStations = React.useMemo(() => {
    return boardData.workstations
      .filter((w) => {
        // 1. Must NOT be under repair / servicing or flagged with open issues
        const isUnderRepair = w.status === 'under_repair' || w.active_issues?.some((i) => i.status === 'in_progress')
        const isFlagged = w.status === 'flagged' || (w.open_issues_count ?? 0) > 0 || w.active_issues?.some((i) => i.status === 'open')
        if (isUnderRepair || isFlagged) return false

        // 2. Must be operational and active
        if (w.status !== 'operational' || w.is_active === false) return false

        // Check occupancy for current live session
        const seatedStudent = sessionContext?.seatPlan?.[w.id]
        if (!seatedStudent) {
          // Completely unassigned / vacant
          return true
        }

        // If a student is assigned, workstation is available only if that assigned student is marked absent
        const isAbsent =
          (sessionAttendance[seatedStudent.enrollmentId] ??
            (sessionAttendance[seatedStudent.rollNumber] !== undefined
              ? sessionAttendance[seatedStudent.rollNumber]
              : true)) === false
        return isAbsent
      })
      .map((w) => {
        const seatedStudent = sessionContext?.seatPlan?.[w.id]
        const isAbsent = seatedStudent
          ? (sessionAttendance[seatedStudent.enrollmentId] ??
              (sessionAttendance[seatedStudent.rollNumber] !== undefined
                ? sessionAttendance[seatedStudent.rollNumber]
                : true)) === false
          : false
        return {
          id: w.id,
          label: w.label,
          description:
            isAbsent && seatedStudent
              ? `Vacant — Absent: ${seatedStudent.fullName}`
              : 'Empty & Operational',
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
  }, [boardData.workstations, sessionContext, sessionAttendance])

  // Dynamically derived active workstation for the unified sidebar drawer
  const activeDrawerWorkstation = React.useMemo(() => {
    const wsId = selectedWorkstationId || selectedWorkstationForIssue?.id
    if (!wsId) return null
    const baseWs = boardData.workstations.find((w) => w.id === wsId)
    if (!baseWs) return selectedWorkstationForIssue

    let nodeAssignment: any = null
    let isPresent: boolean | undefined = undefined

    if (mode === 'live' && sessionContext) {
      const liveAssigned = sessionContext.seatPlan?.[baseWs.id]
      if (liveAssigned) {
        nodeAssignment = {
          student_id: liveAssigned.studentId,
          student_name: liveAssigned.fullName,
          roll_number: liveAssigned.rollNumber,
          enrollment_id: liveAssigned.enrollmentId,
          is_override: liveAssigned.isOverride,
          photo_url: liveAssigned.photoUrl || null,
          has_photo: Boolean(liveAssigned.hasPhoto),
          original_workstation_label: liveAssigned.originalWorkstationLabel || null,
        }
        const isPres =
          sessionAttendance[liveAssigned.enrollmentId] ??
          (sessionAttendance[liveAssigned.rollNumber] !== undefined ? sessionAttendance[liveAssigned.rollNumber] : true)
        isPresent = isPres !== false
      }
    } else if (mode === 'baseline' && baselinePlanData) {
      const wsAssignment = baselinePlanData.workstations.find((w) => w.id === baseWs.id)?.assignment
      if (wsAssignment) {
        nodeAssignment = wsAssignment
      }
    }

    return {
      ...baseWs,
      assignment: nodeAssignment,
      session_override: nodeAssignment?.is_override
        ? {
          override_id: 'temp',
          student_id: (nodeAssignment as any).student_id,
          student_name: nodeAssignment.student_name,
          roll_number: nodeAssignment.roll_number,
          enrollment_id: (nodeAssignment as any).enrollment_id,
          photo_url: nodeAssignment.photo_url || null,
          has_photo: Boolean((nodeAssignment as any).has_photo),
          original_workstation_label: (nodeAssignment as any).original_workstation_label || null,
        }
        : null,
      isPresent,
    }
  }, [
    selectedWorkstationId,
    selectedWorkstationForIssue,
    boardData.workstations,
    mode,
    sessionContext,
    sessionAttendance,
    baselinePlanData,
  ])

  const handleAssignReplacement = async (
    targetWsId: string,
    enrollmentId: string,
    reason: string
  ) => {
    if (!selectedScheduleId || !sessionContext) return
    const activeDate = sessionContext.date || effectiveDateStr
    const res = await assignSessionSeatOverride({
      scheduleId: selectedScheduleId,
      sessionDate: activeDate,
      workstationId: targetWsId,
      enrollmentId,
    })
    if (res.success) {
      // If student was unassigned and user has permissions, also persist baseline allocation
      const targetStudent = displacedStudents.find((s) => s.enrollmentId === enrollmentId)
      if (targetStudent?.type === 'unassigned' && isPrivileged) {
        try {
          await assignStudentToSeat({
            lab_id: currentLab.id || 'comp',
            class_id: sessionContext.classId,
            academic_year_id: sessionContext.academicYearId,
            workstation_id: targetWsId,
            enrollment_id: enrollmentId,
          })
        } catch (e) {
          console.warn('Could not persist baseline seat allocation:', e)
        }
      }

      await refreshLiveSessionAndBoard()
      setSessionToast({
        text: targetStudent?.type === 'unassigned'
          ? 'Workstation assigned successfully!'
          : 'Temporary relocation assigned successfully!',
        type: 'success',
      })
    } else {
      throw new Error(res.error || 'Failed to assign replacement seat.')
    }
  }

  // Clear Cohort Seats with Confirmation
  const [isClearingSeats, setIsClearingSeats] = useState(false)
  const handleClearAllSeats = async () => {
    if (
      !confirm(
        'Are you sure you want to reset all workstation seat allocations for this cohort? All students will be returned to the unassigned tray.'
      )
    ) {
      return
    }
    setIsClearingSeats(true)
    try {
      const res = await clearAllCohortSeats({
        lab_id: 'comp',
        class_id: selectedClassId,
        academic_year_id: selectedYearId,
      })
      if (res.success) {
        setSessionToast({
          text: `Cohort seat plan cleared (${res.clearedCount || 0} seats released).`,
          type: 'success',
        })
        await fetchBaselineSeating()
        refreshLiveSessionAndBoard()
      } else {
        setSessionToast({ text: res.error || 'Failed to clear seat plan.', type: 'error' })
      }
    } catch (err: any) {
      setSessionToast({ text: err.message || 'Error clearing seat plan.', type: 'error' })
    } finally {
      setIsClearingSeats(false)
    }
  }

  // Unified Mode Switch Handler with Auto-Sync
  const handleSwitchMode = async (newMode: WorkspaceMode) => {
    setMode(newMode)
    if (newMode === 'live') {
      await refreshLiveSessionAndBoard()
    } else if (newMode === 'baseline') {
      try {
        const freshBoard = await getWorkstationBoardData(currentLab.id || 'comp')
        if (freshBoard) setBoardData(freshBoard)
        await fetchBaselineSeating()
      } catch (err) {
        console.error('Error refreshing baseline mode:', err)
      }
    }
  }

  return (
    <div className="space-y-4 w-full font-sans text-zinc-900 dark:text-zinc-100">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER & SINGLE UNIFIED VIEW SWITCHER                  */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Monitor className="h-4 w-4" />
            </span>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-zinc-950 dark:text-white tracking-tight">
              Floor Plan &amp; Live Cockpit
            </h1>
            <Badge className="bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20 text-[10px] font-bold">
              {currentLab.name || 'Computer Lab 01'} ({currentLab.code || 'COM-LAB'})
            </Badge>

            {/* Dynamic Facility Operational Status Badge */}
            {currentLab.status === 'Operational' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
                Operational
              </span>
            ) : currentLab.status === 'Under Maintenance' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 shadow-2xs">
                <Wrench className="h-3 w-3 text-amber-500" />
                Under Maintenance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-zinc-500/10 border border-zinc-500/25 text-zinc-500 dark:text-slate-400 shadow-2xs">
                <ShieldAlert className="h-3 w-3" />
                Facility Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
            Real-time CAD laboratory floor map, live session roll-call, and student seating assignments
          </p>
        </div>

        {/* The Single Unified Mode Switcher (Clean, no duplicate bars!) */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#151E32] border border-zinc-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleSwitchMode('live')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === 'live'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Live Session Cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('baseline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === 'baseline'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-slate-300 hover:text-zinc-950 dark:hover:text-white'
                }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Baseline Seating</span>
            </button>
          </div>

          {/* Dedicated Big-Screen Projection Button */}
          <Link
            href={`/computer-lab/projector?schedule_id=${selectedScheduleId || ''}`}
            target="_blank"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs rounded-xl border-zinc-200 dark:border-white/10 bg-white/5 hover:bg-white/10 text-zinc-700 dark:text-slate-200 hover:text-zinc-950 dark:hover:text-white gap-1.5 shadow-2xs"
              title="Open dedicated wall projector display in a new tab"
            >
              <Maximize2 className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Projector View</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Cautionary Alert Banner if Laboratory Room is Under Maintenance */}
      {currentLab.status === 'Under Maintenance' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-3.5 flex items-start gap-3 text-xs text-amber-200 shadow-2xs animate-in fade-in duration-200">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-heading font-bold text-amber-100 flex items-center gap-2">
              <span>Laboratory Room Under Maintenance</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                Notice
              </span>
            </div>
            <p className="text-amber-300/90 text-[11px] leading-relaxed">
              This facility is currently designated as &ldquo;Under Maintenance&rdquo;. Hardware servicing, preventive cleaning, or BIOS/software updates may be ongoing. Practical sessions may experience station unavailability.
            </p>
          </div>
        </div>
      )}

      {/* 3. High-Density Facility & Workstation Telemetry Cards (Rule #10: ~76px 2-row layout) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total CAD Workstations */}
        <div className="glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                <Monitor className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Total Stations
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-500 dark:text-slate-400 px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.04]">
              Cap {currentLab.capacity || 40}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-[22px] font-extrabold font-heading text-zinc-950 dark:text-white tabular-nums">
              {totalWorkstations}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              4 Rows &bull; 1 Podium
            </span>
          </div>
        </div>

        {/* Card 2: Operational Workstations */}
        <div className="glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                Operational
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-500/10">
              {totalWorkstations > 0 ? Math.round((operationalCount / totalWorkstations) * 100) : 100}%
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-[22px] font-extrabold font-heading text-emerald-600 dark:text-emerald-400 tabular-nums">
              {operationalCount}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans">
              {dateSuspension.isSuspended ? 'Facility in Recess' : 'Ready for Session'}
            </span>
          </div>
        </div>

        {/* Card 3: Flagged Hardware / Software Issues */}
        <Link
          href="/maintenance/workstations"
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-amber-500/40 ${faultCount > 0 ? 'border-amber-500/30' : ''
            }`}
          title="Open Flagged Issues in Lab Diagnostics & Maintenance Workbench"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${faultCount > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-zinc-500/10 text-zinc-400'
                }`}>
                <AlertTriangle className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Flagged Issues
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${faultCount > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
              }`}>
              {faultCount === 0 ? 'Nominal' : `${faultCount} Open`}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${faultCount > 0 ? 'text-amber-500' : 'text-zinc-950 dark:text-white'
              }`}>
              {faultCount}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans flex items-center gap-1">
              <span>{faultCount > 0 ? 'Diagnostics Triage' : 'Zero Open Faults'}</span>
              <span className="text-indigo-400 font-mono text-[10px]">&rarr;</span>
            </span>
          </div>
        </Link>

        {/* Card 4: Under Repair */}
        <Link
          href="/maintenance/workstations"
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-rose-500/40 ${repairCount > 0 ? 'border-rose-500/30' : ''
            }`}
          title="Open Stations Under Repair in Lab Diagnostics & Maintenance Workbench"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${repairCount > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-zinc-500/10 text-zinc-400'
                }`}>
                <Wrench className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Under Repair
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${repairCount > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
              }`}>
              {repairCount === 0 ? 'Clear' : 'Servicing'}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${repairCount > 0 ? 'text-rose-500' : 'text-zinc-950 dark:text-white'
              }`}>
              {repairCount}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-sans flex items-center gap-1">
              <span>{repairCount > 0 ? 'Active Servicing' : 'Full Availability'}</span>
              <span className="text-indigo-400 font-mono text-[10px]">&rarr;</span>
            </span>
          </div>
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODE A: LIVE SESSION COCKPIT CONTROLS                         */}
      {/* ------------------------------------------------------------- */}
      {mode === 'live' && (
        <div className="space-y-3">
          {/* Ambient Simulated Time Strip */}
          {isMounted && isSimulating && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold font-mono tracking-tight text-amber-300">
                      SIMULATED TIME ACTIVE
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/25 font-mono font-semibold uppercase text-amber-100">
                      {currentDayKey.toUpperCase()} &bull; {effectiveDateStr}
                    </span>
                    <span className="text-xs font-mono font-bold text-white tabular-nums">
                      {timeDisplayStr}
                    </span>
                    {nepaliDateInfo && (
                      <span className="text-[11px] text-amber-300/80 font-devanagari">
                        ({nepaliDateInfo.formattedDateNp})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    {liveOngoingSession ? (
                      <span>
                        🟢 Ongoing Routine Slot: <strong>{liveOngoingSession.batchName} &bull; {liveOngoingSession.subjectName}</strong> ({liveOngoingSession.startTime}–{liveOngoingSession.endTime})
                      </span>
                    ) : (
                      <span>
                        Off-hours / recess in simulated time. Choose any scheduled slot below to inspect roster &amp; PC telemetry.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => resetToLiveTime()}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Restore clock to live real-world system time"
                >
                  Restore System Clock
                </button>
              </div>
            </div>
          )}


          {dateSuspension.isSuspended ? (
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/30 via-[#101726] to-[#101726] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                      {dateSuspension.badge || 'Official Institutional Recess'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Suspension Active
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                      {nepaliDateInfo.formattedDateNp} &bull; {effectiveDateStr}
                    </span>
                  </div>
                  <h3 className="font-heading font-extrabold text-base text-white mt-1">
                    {dateSuspension.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                    {dateSuspension.description}
                  </p>
                </div>
              </div>

              {/* Operational Directives */}
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-emerald-300 font-medium text-[11px]">Attendance Not Required</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <Wrench className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-indigo-300 font-medium text-[11px]">Maintenance Access Open</span>
                </div>
                <Link
                  href="/schedules"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 font-medium"
                >
                  View Timetable &rarr;
                </Link>
              </div>
            </div>
          ) : sessionContext ? (
            <>
              {/* Displaced Student Triage Queue */}
              <DisplacedStudentsQueue
                displacedStudents={displacedStudents}
                availableWorkstations={availableRelocationStations}
                onAssignReplacement={handleAssignReplacement}
              />

              <LiveCockpitBar
                sessionContext={sessionContext}
                presentCount={livePresentCount}
                totalCount={sessionContext.expectedRoster.length}
                isSaving={isSavingSession}
                onMarkAllPresent={handleMarkAllPresent}
                onInvertAttendance={handleInvertAttendance}
                onFocusRoll={handleFocusRoll}
                onSubmitSession={() => {
                  setSessionActionModalMode('log')
                  setIsSessionActionModalOpen(true)
                }}
                timingStatus={sessionTimingStatus}
                onSkipSession={() => {
                  setSessionActionModalMode('skip')
                  setIsSessionActionModalOpen(true)
                }}
                onManageSession={() => {
                  setSessionActionModalMode('log')
                  setIsSessionActionModalOpen(true)
                }}
                onSwitchSession={() => {
                  userManuallySelectedRef.current = false
                  setSelectedScheduleId('')
                  setSessionContext(null)
                  broadcastSync('schedules', { labId: currentLab.id, scheduleId: null })
                }}
                upNextSession={upNextMicroPill}
              />
            </>
          ) : (
            <>
              {/* Non-Blocking Concluded Unlogged Practical Reminder Banner */}
              {unloggedPastSession && (
                <div className="rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/20 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">
                      <strong>Pending Practical Log:</strong> The session for <strong className="font-semibold">{unloggedPastSession.batchName}</strong> ({unloggedPastSession.subjectName}) concluded at {unloggedPastSession.endTime} without a submitted practical log.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        userManuallySelectedRef.current = true
                        setSelectedScheduleId(unloggedPastSession.id)
                        fetchLiveSession(unloggedPastSession.id, effectiveDateStr)
                      }}
                      className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      Submit Practical Log
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#101726] px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                {/* Left Side: Status Dot, Session Title, and Micro Period info with subtle badge */}
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <span
                    className="flex h-2.5 w-2.5 rounded-full shrink-0 bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  />

                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="font-heading font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white tracking-tight truncate">
                      Lab Available &bull; Free Period
                    </h3>

                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0">
                      Ready
                    </Badge>
                  </div>

                  <span className="hidden sm:inline text-zinc-300 dark:text-slate-600">&bull;</span>

                  <span className="text-xs text-zinc-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    {nextPreviewSession ? (
                      <span>
                        Next Session: <strong className="text-zinc-800 dark:text-slate-200 font-semibold">{nextPreviewSession.batchName}</strong> ({nextPreviewSession.subjectName}) at {nextPreviewSession.startTime}
                      </span>
                    ) : (
                      <span>No further sessions scheduled today &bull; Free Period</span>
                    )}
                  </span>
                </div>

                {/* Right Side: Select Timetable Slot & Start Unscheduled Session */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {scheduledSessions.length > 0 && (
                    <div className="relative min-w-[220px] sm:min-w-[260px] max-w-full sm:max-w-xs">
                      <Select
                        value={selectedScheduleId}
                        onChange={(e) => {
                          const newId = e.target.value
                          userManuallySelectedRef.current = Boolean(newId)
                          setSelectedScheduleId(newId)
                          if (newId) {
                            fetchLiveSession(newId, effectiveDateStr)
                            broadcastSync('schedules', { labId: currentLab.id, scheduleId: newId })
                          } else {
                            setSessionContext(null)
                            broadcastSync('schedules', { labId: currentLab.id, scheduleId: null })
                          }
                        }}
                        className="h-9 text-xs bg-zinc-50/80 dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-zinc-200 rounded-xl px-3 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 cursor-pointer shadow-2xs w-full"
                        suppressHydrationWarning
                      >
                        <option value="">-- Select Timetable Slot --</option>
                        {!isMounted ? (
                          <option value="" disabled>Select Timetable Slot</option>
                        ) : todaySessions.length === 0 ? (
                          <option value="" disabled>No scheduled sessions today</option>
                        ) : (
                          todaySessions.map((s) => {
                            const isLive = s.id === liveOngoingSession?.id
                            const isNext = s.id === nextUpcomingSession?.id
                            const isDone = isSessionLogged(s.id)
                            const isSkip = isSessionSkipped(s.id)
                            const tag = isSkip ? '[SKIPPED] ' : isLive ? '[LIVE] ' : isNext ? '[NEXT] ' : isDone ? '[DONE] ' : ''
                            return (
                              <option key={s.id} value={s.id}>
                                {tag}{s.startTime} • {s.batchName} ({s.subjectName})
                              </option>
                            )
                          })
                        )}
                      </Select>
                    </div>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsAdHocModalOpen(true)}
                    className="h-9 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Start Unscheduled Session</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE B: BASELINE SEATING CONTROLS (TIER 1)                     */}
      {/* ------------------------------------------------------------- */}
      {mode === 'baseline' && (
        <div className="glass-card rounded-xl p-2.5 sm:px-4 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <GraduationCap className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-slate-200">Cohort:</span>
              {!isPrivileged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-500/10 text-zinc-500 dark:text-slate-400 border border-zinc-200 dark:border-white/5">
                  View Only
                </span>
              )}
            </div>

            {/* Class & Academic Year side-by-side with tight height */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-8 text-xs bg-zinc-100 dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg min-w-[130px]"
              >
                {authorizedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              {academicYears.length > 0 && (
                <Select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="h-8 text-xs bg-zinc-100 dark:bg-[#151E32] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-lg min-w-[185px] sm:min-w-[210px]"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Compact stats pill */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-600 dark:text-slate-400 bg-zinc-100 dark:bg-[#151E32]/60 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/5">
              <span>Enrolled: <strong className="text-zinc-900 dark:text-white font-mono">{baselinePlanData?.total_students || 0}</strong></span>
              <span>&bull;</span>
              <span>Seated: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{baselinePlanData?.assigned_count || 0}</strong></span>
              <span>&bull;</span>
              <span>Unassigned: <strong className="text-amber-600 dark:text-amber-400 font-mono">{baselinePlanData?.unassigned_count || 0}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Print Wall Chart Button (Hidden on Mobile) */}
            <Link
              href={`/print/seating-chart?class_id=${selectedClassId}&academic_year_id=${selectedYearId}`}
              target="_blank"
              className="hidden md:inline-flex"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs rounded-lg border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-200 hover:bg-zinc-100 dark:hover:bg-white/5 gap-1.5"
              >
                <Printer className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Print Chart</span>
              </Button>
            </Link>

            {/* Unassigned Students Tray Toggle Button */}
            <Button
              type="button"
              variant={isSlideDrawerOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsSlideDrawerOpen(!isSlideDrawerOpen)}
              className={`h-8 px-2.5 text-xs rounded-lg gap-1.5 transition-all ${isSlideDrawerOpen
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-slate-200 hover:bg-zinc-100 dark:hover:bg-white/5'
                }`}
            >
              <Users className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Unassigned ({baselinePlanData?.unassigned_count || 0})</span>
            </Button>

            {isPrivileged && (
              <div className="hidden md:flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    setLoading(true)
                    const res = await autoAssignRemainingSeats({
                      lab_id: 'comp',
                      class_id: selectedClassId,
                      academic_year_id: selectedYearId,
                      strategy: 'roll_asc',
                    })
                    if (res.success && res.data) {
                      setSessionToast({
                        text: `Auto-assigned ${res.data.assigned_count} students in sequential Roll order.`,
                        type: 'success',
                      })
                    }
                    await fetchBaselineSeating()
                    refreshLiveSessionAndBoard()
                  }}
                  className="h-8 px-2.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5"
                  title="Auto-populate remaining unseated students by Roll Number (1..N)"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Auto-Assign (Roll)</span>
                </Button>

                {(baselinePlanData?.assigned_count || 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isClearingSeats}
                    onClick={handleClearAllSeats}
                    className="h-8 px-2.5 text-xs rounded-lg border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5"
                    title="Reset all workstation allocations for this cohort"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
                    <span>Clear Plan</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile / Compact View Mode Switcher */}
      <div className="md:hidden flex items-center justify-between p-2 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-[#101726]/80 backdrop-blur-sm shadow-xs">
        <span className="text-xs font-heading font-bold text-zinc-600 dark:text-slate-300 pl-1.5 flex items-center gap-1.5">
          <Monitor className="h-3.5 w-3.5 text-indigo-500" />
          <span>Mobile View Mode:</span>
        </span>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-[#0B0F19] p-0.5 rounded-xl border border-zinc-200 dark:border-white/10">
          <button
            type="button"
            onClick={() => setMobileLabView('bench_list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${mobileLabView === 'bench_list'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Aisle Deck (Fast)</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileLabView('canvas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${mobileLabView === 'canvas'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>2D Floor Map</span>
          </button>
        </div>
      </div>

      {/* Mobile Thumb-Friendly Bench List View (Visible when Bench List mode is active on mobile) */}
      {mobileLabView === 'bench_list' && (
        <div className="block md:hidden w-full">
          <MobileBenchRollcallView
            workstations={boardData.workstations}
            sessionContext={sessionContext}
            sessionAttendance={sessionAttendance}
            onToggleAttendance={handleToggleRollPresence}
            onMarkAllPresent={handleMarkAllPresent}
            onInvertAttendance={handleInvertAttendance}
            onRelocateStudent={async (destWsId, enrollmentId) => {
              const schedId = selectedScheduleId || liveOngoingSession?.id
              if (!schedId) return
              const res = await assignSessionSeatOverride({
                scheduleId: schedId,
                sessionDate: effectiveDateStr,
                workstationId: destWsId,
                enrollmentId,
              })
              if (res.success) {
                setSessionToast({ text: 'Student relocated successfully.', type: 'success' })
                refreshLiveSessionAndBoard()
              } else {
                setSessionToast({ text: res.error || 'Relocation failed.', type: 'error' })
              }
            }}
            onReportIssue={(ws) => {
              setSelectedWorkstationId(ws.id)
              setSelectedWorkstationForIssue(ws)
              setIsIssueDrawerOpen(true)
            }}
            onViewWorkstation={(ws) => {
              setSelectedWorkstationId(ws.id)
              setSelectedWorkstationForIssue(ws)
              setIsIssueDrawerOpen(true)
            }}
            isLiveSession={Boolean(sessionContext)}
            isSuspended={dateSuspension.isSuspended}
            suspensionTitle={dateSuspension.title}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}

      {/* 4. HERO FLOOR CANVAS & UNASSIGNED STUDENT DOCK */}
      <div className={`flex flex-col xl:flex-row items-start gap-3 w-full ${mobileLabView === 'bench_list' ? 'hidden md:flex' : 'flex'}`}>
        {/* Full-width Hero Floor Canvas */}
        <div
          {...viewport.containerProps}
          className={`relative flex-1 w-full min-w-0 h-[650px] sm:h-[750px] min-h-[500px] rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-slate-100 dark:bg-[#0B0F19] overflow-hidden select-none shadow-xl ${viewport.isPanning || viewport.isPanToolActive ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
        >
          {/* Floating CAD HUD Controls */}
          <CanvasControlsHud
            zoom={viewport.zoom}
            isPanToolActive={viewport.isPanToolActive}
            isMinimapVisible={isMinimapVisible}
            onZoomIn={viewport.zoomIn}
            onZoomOut={viewport.zoomOut}
            onResetZoom={viewport.resetZoom}
            onFitToScreen={viewport.fitToScreen}
            onTogglePanTool={viewport.togglePanTool}
            onToggleMinimap={() => setIsMinimapVisible((v) => !v)}
            terminalScale={terminalScale}
            onSetTerminalScale={setTerminalScale}
          />

          {/* Floating Operational Lifecycle Banner */}
          {mode === 'live' && sessionContext && sessionTimingStatus?.status === 'upcoming' && (
            userManuallySelectedRef.current && (sessionTimingStatus.startsInMins || 0) > 10 ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/95 dark:bg-[#0D131F]/95 border border-indigo-400 dark:border-indigo-500/40 text-indigo-800 dark:text-indigo-300 text-xs shadow-xl backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-[0_0_6px_#6366f1]" />
                <span className="font-heading font-black text-[11px] uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  INSPECTION PREVIEW MODE
                </span>
                <span className="text-zinc-600 dark:text-slate-300 text-[11px] hidden sm:inline">
                  &bull; Viewing <strong className="text-zinc-900 dark:text-white">{sessionContext.subjectCode}</strong> ({sessionContext.className}) starting at <strong className="text-indigo-700 dark:text-indigo-200">{sessionContext.startTime}</strong> ({sessionTimingStatus.startsInMins}m)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    userManuallySelectedRef.current = false
                    if (liveOngoingSession) {
                      setSelectedScheduleId(liveOngoingSession.id)
                      fetchLiveSession(liveOngoingSession.id, effectiveDateStr)
                    } else {
                      setSelectedScheduleId('')
                      setSessionContext(null)
                    }
                  }}
                  className="ml-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Return to Free Lab
                </button>
              </div>
            ) : (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-[#0D131F]/95 border border-amber-400 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs shadow-xl backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                <span className="font-heading font-black text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  STANDBY PREVIEW MODE
                </span>
                <span className="text-zinc-600 dark:text-slate-300 text-[11px] hidden sm:inline">
                  &bull; Pre-allocated seating for <strong className="text-zinc-900 dark:text-white">{sessionContext.subjectCode}</strong> ({sessionContext.className}). Begins at <strong className="text-amber-700 dark:text-amber-200">{sessionContext.startTime}</strong> ({sessionTimingStatus.startsInMins}m).
                </span>
              </div>
            )
          )}

          {/* Collapsible Minimap Radar */}
          {isMinimapVisible && (
            <CanvasMinimapRadar
              workstations={renderedWorkstations.map((w) => ({
                ...w,
                isPresent:
                  mode === 'live' && sessionContext && sessionContext.seatPlan[w.id]
                    ? (sessionAttendance[sessionContext.seatPlan[w.id].enrollmentId] ??
                       (sessionAttendance[sessionContext.seatPlan[w.id].rollNumber] !== undefined
                         ? sessionAttendance[sessionContext.seatPlan[w.id].rollNumber]
                         : true)) !== false
                    : undefined,
              }))}
              zoom={viewport.zoom}
              pan={viewport.pan}
              containerWidth={viewport.containerRef.current?.clientWidth || 1000}
              containerHeight={viewport.containerRef.current?.clientHeight || 562}
              onPanChange={viewport.setPan}
              onClose={() => setIsMinimapVisible(false)}
            />
          )}

          <div
            style={{
              width: '1360px',
              height: '780px',
              position: 'absolute',
              left: 0,
              top: 0,
              ...viewport.canvasTransformStyle,
            }}
            className="cad-canvas-grid"
          >
            {/* Real-Life Architectural Desk Tables & Corridor Structures */}
            <LabDeskStructureOverlay />

            {/* Database Floor Landmarks */}
            {(Array.isArray(floorElements) ? floorElements : []).map((el) => (
              <FloorLandmarkNode key={el.id} element={el} />
            ))}

            {/* Workstations Canvas (Deduplicated Coordinates) */}
            {renderedWorkstations.map((ws) => {
              // Determine assignment depending on active mode
              let nodeAssignment: any = null
              let isPresent: boolean | undefined = undefined

              if (mode === 'live' && sessionContext) {
                const liveAssigned = sessionContext.seatPlan[ws.id]
                if (liveAssigned) {
                  nodeAssignment = {
                    student_id: liveAssigned.studentId,
                    student_name: liveAssigned.fullName,
                    roll_number: liveAssigned.rollNumber,
                    enrollment_id: liveAssigned.enrollmentId,
                    is_override: liveAssigned.isOverride,
                    photo_url: liveAssigned.photoUrl || null,
                    has_photo: Boolean(liveAssigned.hasPhoto),
                    original_workstation_label: liveAssigned.originalWorkstationLabel || null,
                  }
                  const isPres =
                    sessionAttendance[liveAssigned.enrollmentId] ??
                    (sessionAttendance[liveAssigned.rollNumber] !== undefined ? sessionAttendance[liveAssigned.rollNumber] : true)
                  isPresent = isPres !== false
                }
              } else if (mode === 'baseline' && baselinePlanData) {
                const wsAssignment = baselinePlanData.workstations.find((w) => w.id === ws.id)?.assignment
                if (wsAssignment) {
                  nodeAssignment = wsAssignment
                }
              }

              const wsWithAssignment = {
                ...ws,
                assignment: nodeAssignment,
                session_override: nodeAssignment?.is_override
                  ? {
                    override_id: 'temp',
                    student_id: (nodeAssignment as any).student_id,
                    student_name: nodeAssignment.student_name,
                    roll_number: nodeAssignment.roll_number,
                    photo_url: nodeAssignment.photo_url || null,
                    has_photo: Boolean((nodeAssignment as any).has_photo),
                    original_workstation_label: (nodeAssignment as any).original_workstation_label || null,
                  }
                  : null,
                isPresent,
              }

              return (
                <WorkstationNode
                  key={ws.id}
                  workstation={wsWithAssignment as any}
                  isLayoutMode={false}
                  isSeatPlanMode={mode === 'live' || mode === 'baseline'}
                  isSelected={activeWsModal?.id === ws.id || (isIssueDrawerOpen && (selectedWorkstationId === ws.id || selectedWorkstationForIssue?.id === ws.id)) || activeBaselineModalWs?.id === ws.id}
                  isDropTarget={dragOverWsId === ws.id}
                  isFocused={viewport.focusedWsId === ws.id}
                  isAssistanceRequested={Boolean(
                    liveAssistanceRequests.find(
                      (r) => r.workstationId === ws.id || r.stationLabel.toLowerCase() === ws.label.toLowerCase()
                    )
                  )}
                  assistanceRequest={
                    liveAssistanceRequests.find(
                      (r) => r.workstationId === ws.id || r.stationLabel.toLowerCase() === ws.label.toLowerCase()
                    ) || null
                  }
                  onAcknowledgeAssistance={async (reqId) => {
                    const res = await acknowledgeAssistanceRequest(reqId)
                    if (res.success) {
                      setLiveAssistanceRequests((prev) => prev.filter((r) => r.id !== reqId))
                    }
                  }}
                  density={viewport.zoom < 0.75 ? 'compact' : 'standard'}
                  terminalScale={terminalScale}
                  isStandby={mode === 'live' && sessionTimingStatus?.status === 'upcoming'}
                  onClick={() => handleWorkstationClick(wsWithAssignment)}
                  onDragOver={
                    mode === 'baseline' && isPrivileged
                      ? (e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        setDragOverWsId(ws.id)
                      }
                      : undefined
                  }
                  onDragLeave={() => {
                    if (dragOverWsId === ws.id) setDragOverWsId(null)
                  }}
                  onDrop={
                    mode === 'baseline' && isPrivileged
                      ? (e) => handleDropStudentOnStation(e, wsWithAssignment)
                      : undefined
                  }
                />
              )
            })}

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-[#0B0F19]/60 backdrop-blur-xs flex items-center justify-center z-40">
                <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#151E32] px-4 py-2 border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-900 dark:text-white shadow-md">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Synchronizing lab state...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Student Sidebar (Only in Baseline Mode when open - never obscures PCs!) */}
        {mode === 'baseline' && isSlideDrawerOpen && (
          <div className="w-full xl:w-84 xl:max-w-[340px] shrink-0 sticky top-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-3 border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#101726] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-heading font-extrabold text-xs text-zinc-900 dark:text-white">
                  Unassigned Tray
                </h4>
                <Badge className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] border border-indigo-200 dark:border-indigo-500/20">
                  {baselinePlanData?.unassigned_students.length || 0}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setIsSlideDrawerOpen(false)}
                className="p-1 rounded-lg text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Collapse unassigned student tray"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <StudentTray
              unassignedStudents={baselinePlanData?.unassigned_students || []}
              selectedStudent={selectedStudentForAssign}
              onSelectStudent={setSelectedStudentForAssign}
              onAutoAssign={async () => {
                setLoading(true)
                await autoAssignRemainingSeats({
                  lab_id: 'comp',
                  class_id: selectedClassId,
                  academic_year_id: selectedYearId,
                  strategy: 'roll_asc',
                })
                await fetchBaselineSeating()
                refreshLiveSessionAndBoard()
              }}
              isPrivileged={isPrivileged}
              className="rounded-t-none border-t-0"
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. LEGEND BAR                                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#101726] p-3 text-xs text-zinc-700 dark:text-slate-300 flex-wrap shadow-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#34d399]" />
            <span>Present / Operational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Absent / Station Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span>Assigned Workstation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Session Override</span>
          </div>
        </div>

        {mode === 'live' && (
          <div className="text-[11px] text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Click any workstation card to toggle Present / Absent.</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODALS & DRAWERS                                              */}
      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* MODALS & DRAWERS                                              */}
      {/* ------------------------------------------------------------- */}
      {/* Start Ad-Hoc Session Modal */}
      <StartAdHocSessionModal
        isOpen={isAdHocModalOpen}
        onClose={() => setIsAdHocModalOpen(false)}
        onSessionStarted={(newSchedId) => {
          setSelectedScheduleId(newSchedId)
          fetchLiveSession(newSchedId)
          broadcastSync('schedules', { labId: currentLab.id, scheduleId: newSchedId })
        }}
        classes={authorizedClasses}
        subjects={authorizedSubjects}
        classSubjects={classSubjects}
      />

      {/* Unified Workstation Sidebar Drawer (Roll-Call, Assistance, Issues & Problem Reporting) */}
      <WorkstationIssueDrawer
        isOpen={isIssueDrawerOpen}
        onClose={() => {
          setIsIssueDrawerOpen(false)
          setSelectedWorkstationId(null)
          setSelectedWorkstationForIssue(null)
        }}
        workstation={activeDrawerWorkstation}
        categories={boardData.categories}
        isPrivileged={isPrivileged}
        currentUserId={boardData.user_id}
        currentUserName={boardData.user_name}
        assistanceRequest={
          activeDrawerWorkstation
            ? liveAssistanceRequests.find(
              (r) =>
                r.workstationId === activeDrawerWorkstation.id ||
                r.stationLabel?.toLowerCase() === activeDrawerWorkstation.label?.toLowerCase()
            ) || null
            : null
        }
        onAcknowledgeAssistance={async (reqId) => {
          const res = await acknowledgeAssistanceRequest(reqId)
          if (res.success) {
            setLiveAssistanceRequests((prev) => prev.filter((r) => r.id !== reqId))
            broadcastSync('assistance')
          }
        }}
        onTogglePresence={mode === 'live' && sessionContext ? handleToggleRollPresence : undefined}
        onAssignOverride={
          mode === 'live' && sessionContext
            ? async (targetWsId, enrollmentId) => {
              const activeDate = sessionContext.date || effectiveDateStr
              const res = await assignSessionSeatOverride({
                scheduleId: sessionContext.scheduleId,
                sessionDate: activeDate,
                workstationId: targetWsId,
                enrollmentId,
              })
              if (res.success) {
                await refreshLiveSessionAndBoard()
                setSessionToast({
                  text: 'Temporary relocation assigned successfully!',
                  type: 'success',
                })
              } else {
                throw new Error(res.error || 'Failed to reassign seat.')
              }
            }
            : undefined
        }
        availableWorkstations={availableRelocationStations}
        displacedStudents={displacedStudents}
        onAssignReplacement={
          mode === 'live' && sessionContext
            ? handleAssignReplacement
            : undefined
        }
        isLocked={sessionContext?.existingLog?.isLocked}
        onSuccess={async () => {
          await refreshLiveSessionAndBoard()
          setSessionToast({
            text: `Updated diagnostics & status for ${activeDrawerWorkstation?.label || 'workstation'}.`,
            type: 'success',
          })
        }}
      />

      {/* Temporary Session Override Modal (Mode A) */}
      {isOverrideModalOpen && activeWsModal && sessionContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#101726] p-5 shadow-2xl space-y-4 font-sans text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-zinc-900 dark:text-white">
                    Temporary Seat Override
                  </h3>
                  <p className="text-[11px] text-zinc-600 dark:text-slate-400">
                    Assign student to <strong className="text-zinc-900 dark:text-white">{activeWsModal.label}</strong> for today only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOverrideModalOpen(false)
                  setActiveWsModal(null)
                }}
                className="p-1 rounded-lg text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-slate-300">
                Select Student from Roster
              </label>
              <Select
                value={overrideStudentEnrollmentId}
                onChange={(e) => setOverrideStudentEnrollmentId(e.target.value)}
                className="w-full h-9.5 text-xs bg-white dark:bg-[#151E32] border-zinc-300 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl"
              >
                {(() => {
                  const seatedIds = new Set(Object.values(sessionContext.seatPlan).map((p) => p.enrollmentId))
                  return (
                    <>
                      {/* Prioritize unseated students */}
                      {sessionContext.expectedRoster
                        .filter((s) => !seatedIds.has(s.enrollmentId))
                        .map((s) => (
                          <option key={s.enrollmentId} value={s.enrollmentId}>
                            Roll {s.rollNumber} — {s.fullName} (Unassigned)
                          </option>
                        ))}
                      {/* Then seated students */}
                      {sessionContext.expectedRoster
                        .filter((s) => seatedIds.has(s.enrollmentId))
                        .map((s) => {
                          const isPres =
                            sessionAttendance[s.enrollmentId] ??
                            (sessionAttendance[s.rollNumber] !== undefined ? sessionAttendance[s.rollNumber] : true)
                          const isAbsent = isPres === false
                          return (
                            <option key={s.enrollmentId} value={s.enrollmentId}>
                              Roll {s.rollNumber} — {s.fullName} {isAbsent ? '(Absent)' : '(Currently at PC)'}
                            </option>
                          )
                        })}
                    </>
                  )
                })()}
              </Select>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/90 leading-relaxed">
                This temporarily reassigns the student for today&apos;s session without mutating the baseline cohort plan.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOverrideModalOpen(false)
                  setActiveWsModal(null)
                }}
                className="h-8.5 text-xs rounded-xl border-white/10 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!overrideStudentEnrollmentId || loading}
                onClick={async () => {
                  if (!overrideStudentEnrollmentId || !activeWsModal || !sessionContext) return
                  setLoading(true)
                  try {
                    const res = await assignSessionSeatOverride({
                      scheduleId: sessionContext.scheduleId,
                      sessionDate: sessionContext.date,
                      workstationId: activeWsModal.id,
                      enrollmentId: overrideStudentEnrollmentId,
                    })
                    if (res.success) {
                      await fetchLiveSession(sessionContext.scheduleId)
                      setIsOverrideModalOpen(false)
                      setActiveWsModal(null)
                      setOverrideStudentEnrollmentId('')
                    } else {
                      alert(res.error || 'Failed to assign session seat override.')
                    }
                  } catch (err: any) {
                    alert(err.message || 'Error assigning session override.')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="h-8.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 gap-1.5"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>Confirm Override</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Baseline Workstation Assignment Popover / Modal (Mode B) */}
      {activeBaselineModalWs && mode === 'baseline' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 dark:border-indigo-500/30 bg-white dark:bg-[#101726] p-5 shadow-2xl space-y-4 text-zinc-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                  <Monitor className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-sm text-zinc-900 dark:text-white">
                      Workstation {activeBaselineModalWs.label}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-slate-300">
                      {activeBaselineModalWs.row_label || 'Floor Grid'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                    Baseline seat allocation for {authorizedClasses.find((c) => c.id === selectedClassId)?.name || selectedClassId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveBaselineModalWs(null)
                  setSelectedAssignModalEnrollmentId('')
                }}
                className="p-1 rounded-lg text-zinc-400 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Occupant Details */}
            {activeBaselineModalWs.assignment ? (
              <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 font-mono">
                    Currently Assigned Student
                  </span>
                  <Badge className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/20 text-[10px]">
                    Seated
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                    R-{activeBaselineModalWs.assignment.roll_number}
                  </span>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-zinc-900 dark:text-white">
                      {activeBaselineModalWs.assignment.student_name}
                    </h4>
                    <span className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono">
                      Roll Number {activeBaselineModalWs.assignment.roll_number}
                    </span>
                  </div>
                </div>

                {isPrivileged && (
                  <div className="pt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={async () => {
                        setLoading(true)
                        try {
                          const seatPlanId = activeBaselineModalWs.assignment?.seat_plan_id
                          if (!seatPlanId) return
                          const res = await clearSeatAssignment(seatPlanId)
                          if (res.success) {
                            setSessionToast({
                              text: `Unseated ${activeBaselineModalWs.assignment?.student_name} from ${activeBaselineModalWs.label}.`,
                              type: 'success',
                            })
                            setActiveBaselineModalWs(null)
                            await fetchBaselineSeating()
                            refreshLiveSessionAndBoard()
                          } else {
                            setSessionToast({ text: res.error || 'Failed to clear seat.', type: 'error' })
                          }
                        } catch (err: any) {
                          setSessionToast({ text: err.message || 'Error clearing seat.', type: 'error' })
                        } finally {
                          setLoading(false)
                        }
                      }}
                      className="h-8 text-xs rounded-xl border-rose-300 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Unseat Student</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#151E32]/60 text-center space-y-2">
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-300">
                  This workstation is currently <strong className="text-emerald-600 dark:text-emerald-400">Available</strong>.
                </span>
                {isPrivileged ? (
                  <div className="space-y-2 text-left pt-2">
                    <label className="block text-[11px] font-semibold text-zinc-700 dark:text-slate-300">
                      Assign Unassigned Student:
                    </label>
                    <Select
                      value={selectedAssignModalEnrollmentId}
                      onChange={(e) => setSelectedAssignModalEnrollmentId(e.target.value)}
                      className="w-full h-9 text-xs bg-white dark:bg-[#0B0F19] border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl"
                    >
                      <option value="">-- Select Student to Seat Here --</option>
                      {(baselinePlanData?.unassigned_students || []).map((s) => (
                        <option key={s.enrollment_id} value={s.enrollment_id}>
                          Roll {s.roll_number} — {s.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 dark:text-slate-400">
                    Seating allocations are managed by Lab In-Charge and Super Admin.
                  </p>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-white/[0.08]">
              {/* Report Problem (Available to both teachers and in-charge!) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const fullWs = boardData.workstations.find((w) => w.id === activeBaselineModalWs.id) || activeBaselineModalWs
                  setSelectedWorkstationId(fullWs.id)
                  setSelectedWorkstationForIssue(fullWs as any)
                  setIsIssueDrawerOpen(true)
                  setActiveBaselineModalWs(null)
                }}
                className="h-8 text-xs rounded-xl border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1.5"
                title="Report hardware fault or maintenance issue on this machine"
              >
                <Wrench className="h-3 w-3" />
                <span>Report Problem</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveBaselineModalWs(null)
                    setSelectedAssignModalEnrollmentId('')
                  }}
                  className="h-8 text-xs rounded-xl border-white/10 text-slate-300"
                >
                  Close
                </Button>

                {isPrivileged && !activeBaselineModalWs.assignment && selectedAssignModalEnrollmentId && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const student = baselinePlanData?.unassigned_students.find(
                        (s) => s.enrollment_id === selectedAssignModalEnrollmentId
                      )
                      if (!student) return
                      await handleAssignStudentToStation(
                        student.enrollment_id,
                        activeBaselineModalWs.id,
                        student.full_name,
                        student.roll_number,
                        activeBaselineModalWs.label
                      )
                      setActiveBaselineModalWs(null)
                      setSelectedAssignModalEnrollmentId('')
                    }}
                    className="h-8 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Assign Seat</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* UNIFIED SESSION ACTION MODAL (UNIFORM ACROSS SYSTEM)          */}
      {/* ------------------------------------------------------------- */}
      {isSessionActionModalOpen && modalSessionItem && (
        <SessionActionModal
          isOpen={isSessionActionModalOpen}
          onClose={() => setIsSessionActionModalOpen(false)}
          session={modalSessionItem}
          sessionDate={sessionContext?.date || effectiveDateStr}
          existingLog={modalExistingLog}
          initialTotalStudents={sessionContext?.expectedRoster.length}
          initialAbsentRolls={liveAbsentRolls}
          initialAbsentCount={liveAbsentRolls.length}
          allRoutines={routines}
          initialMode={sessionActionModalMode}
          onSuccess={(msg) => setSessionToast({ text: msg, type: 'success' })}
          onDeleteSession={deleteSession}
          onExtendSession={extendSession}
          onMergeSession={mergeSession}
          onUnmergeSession={unmergeSession}
          onSaveLog={handleSaveLogFromModal}
          onSkipSession={handleSkipFromModal}
          onUnskipSession={unskipSession}
          seatingSnapshot={currentSeatingSnapshot || undefined}
        />
      )}

      {/* Floating Toast Notification (Reserved for Meaningful Actions, Auto-Dismisses in 3.5s) */}
      {sessionToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[100] flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md max-w-md animate-in slide-in-from-right fade-in duration-300 ${sessionToast.type === 'success'
              ? 'bg-white/95 dark:bg-[#101726]/95 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-[0_8px_32px_rgba(16,185,129,0.15)]'
              : 'bg-white/95 dark:bg-[#101726]/95 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 shadow-[0_8px_32px_rgba(244,63,94,0.15)]'
            }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {sessionToast.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-semibold leading-snug">{sessionToast.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSessionToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
            title="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
