'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
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
import { createPracticalLog } from '@/app/actions/logs'
import dynamic from 'next/dynamic'
import { useRoutineState } from '@/hooks/use-routine-state'
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
import { evaluateDateSuspension } from '@/lib/calendar-policy'
import type { WorkstationBoardData, WorkstationWithIssues } from '@/types/workstations'
import type { CohortSeatPlanData, WorkstationWithAssignment } from '@/lib/types/seat-plans'
import type { StudentWithEnrollment } from '@/lib/types/students'
import type { LabFloorElementRow } from '@/types/database'

export type WorkspaceMode = 'live' | 'baseline'

interface ComputerLabWorkspaceProps {
  initialBoardData: WorkstationBoardData
  initialLabFacility?: {
    id: string
    name: string
    code: string
    capacity: number
    type: string
    status: string
    is_active?: boolean
  }
  scheduledSessions: Array<{
    id: string
    startTime: string
    endTime: string
    dayKey: string
    subjectName: string
    batchName: string
    teacherName: string
    classSubjectId: string
  }>
  authorizedClasses: Array<{ id: string; name: string }>
  authorizedSubjects: Array<{
    id: string
    code: string
    name: string
    classId: string
    className: string
  }>
  classSubjects: Array<{
    id: string
    classId: string
    subjectId: string
    className: string
    subjectName: string
    subjectCode: string
  }>
  isPrivileged: boolean
  isTeacher: boolean
}

export function ComputerLabWorkspace({
  initialBoardData,
  initialLabFacility,
  scheduledSessions,
  authorizedClasses,
  authorizedSubjects,
  classSubjects,
  isPrivileged,
  isTeacher,
}: ComputerLabWorkspaceProps) {
  // 1. Primary Unified Mode Switcher (Zero duplicate tab strips)
  const [mode, setMode] = useState<WorkspaceMode>('live')

  // Live Facility Infrastructure State & Calendar Policy
  const { labs, holidays } = useInfrastructureState()
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

  // Board Data & Landmarks
  const [boardData, setBoardData] = useState<WorkstationBoardData>(initialBoardData)
  const [floorElements, setFloorElements] = useState<LabFloorElementRow[]>([])
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  // -------------------------------------------------------------
  // SIMULATED / LIVE TIME ENGINE INTEGRATION
  // -------------------------------------------------------------
  const [isMounted, setIsMounted] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState<Date>(() => new Date())
  const [isSimulating, setIsSimulating] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
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

  // Identify live ongoing session & today's sessions for simulated time
  const { liveOngoingSession, todaySessions } = React.useMemo(() => {
    // If today is an official holiday or institutional recess (e.g. Sunday week off), all sessions are suspended
    if (dateSuspension.isSuspended) {
      return {
        liveOngoingSession: null,
        todaySessions: [],
      }
    }

    const today = sortSessionsChronologically(
      scheduledSessions.filter(
        (s) => s.dayKey?.toLowerCase() === currentDayKey.toLowerCase()
      )
    )

    let ongoing = null

    for (const s of today) {
      const startMin = parseTimeToMinutes(s.startTime)
      const endMin = parseTimeToMinutes(s.endTime)
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        ongoing = s
        break
      }
    }

    return {
      liveOngoingSession: ongoing,
      todaySessions: today,
    }
  }, [scheduledSessions, currentDayKey, currentMinutes, parseTimeToMinutes, dateSuspension.isSuspended])

  // -------------------------------------------------------------
  // MODE A: LIVE SESSION STATE
  // -------------------------------------------------------------
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('')
  const [sessionContext, setSessionContext] = useState<LiveSessionContext | null>(null)
  const [sessionAttendance, setSessionAttendance] = useState<Record<number, boolean>>({})
  const [isAdHocModalOpen, setIsAdHocModalOpen] = useState(false)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [sessionToast, setSessionToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Derived Timing Status for Selected Live/Upcoming Session
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

  // -------------------------------------------------------------
  // UNIFIED SCHEDULE ROUTINE & SESSION ACTION MODAL INTEGRATION
  // -------------------------------------------------------------
  const {
    routines,
    deleteSession,
    extendSession,
    mergeSession,
    unmergeSession,
    skipSession,
    unskipSession,
  } = useRoutineState()

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
      .filter((s) => sessionAttendance[s.rollNumber] === false)
      .map((s) => s.rollNumber)
  }, [sessionContext, sessionAttendance])

  // Build live 48-station seating snapshot from board workstations
  const currentSeatingSnapshot = React.useMemo(() => {
    if (!sessionContext) return null
    return boardData.workstations.map((ws: any) => {
      const student = ws.session_override || ws.assignment
      const rollNumber = student?.roll_number ?? null
      const isAbsent = rollNumber !== null ? sessionAttendance[rollNumber] === false : false
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

      const res = await createPracticalLog({
        id: logData.id || sessionContext.existingLog?.id,
        schedule_id: sessionContext.scheduleId,
        class_subject_id: sessionContext.classSubjectId,
        lab_id: 'comp',
        date: logData.date || sessionContext.date,
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
        setSessionToast({
          text: 'Practical session log & workstation seating recorded successfully!',
          type: 'success',
        })
        setIsSessionActionModalOpen(false)
        await fetchLiveSession(sessionContext.scheduleId, effectiveDateStr)
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
      const res = await createPracticalLog({
        schedule_id: sessionContext.scheduleId,
        class_subject_id: sessionContext.classSubjectId,
        lab_id: 'comp',
        date: sessionContext.date,
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
        setSessionToast({ text: 'Session successfully marked as skipped.', type: 'success' })
        setIsSessionActionModalOpen(false)
        await fetchLiveSession(sessionContext.scheduleId, effectiveDateStr)
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
  const [selectedClassId, setSelectedClassId] = useState<string>(
    authorizedClasses[0]?.id || '12eng'
  )
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
        const [elRes, yearsRes] = await Promise.all([
          getLabFloorElements(currentLab.id || 'comp'),
          getAcademicYears(),
        ])
        if (elRes.success && elRes.data) setFloorElements(elRes.data)
        if (yearsRes.success && yearsRes.data) {
          setAcademicYears(yearsRes.data)
          const curr = yearsRes.data.find((y: any) => y.is_current)
          if (curr) setSelectedYearId(curr.id)
        }
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

  // Poll live student terminal assistance requests for the cockpit beacon (only when Live mode active)
  useEffect(() => {
    if (mode !== 'live') return

    let isMounted = true
    let inFlight = false

    const fetchRequests = async () => {
      if (inFlight || (typeof document !== 'undefined' && document.hidden)) return
      inFlight = true
      try {
        const res = await getLiveAssistanceRequests(currentLab.id || 'comp')
        if (isMounted && res.success && res.requests) {
          setLiveAssistanceRequests(res.requests)
        }
      } catch {
        // Silently ignore transient network blips
      } finally {
        inFlight = false
      }
    }

    fetchRequests()
    const timer = setInterval(fetchRequests, 20000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [currentLab.id, mode])

  // 2. Fetch Live Session Context when selectedScheduleId changes or simulated date changes
  const fetchLiveSession = useCallback(async (schedId: string, customDate?: string) => {
    if (!schedId) return
    setLoading(true)
    try {
      const dateToUse = customDate || effectiveDateStr
      const res = await getLiveSessionContext(schedId, dateToUse)
      if (res.success && res.data) {
        setSessionContext(res.data)

        // Initialize attendance map: default all enrolled to Present (true) unless existingLog attendance is found
        const initialAttendance: Record<number, boolean> = {}
        res.data.expectedRoster.forEach((s) => {
          if (res.data?.existingAttendance && res.data.existingAttendance[s.rollNumber] !== undefined) {
            initialAttendance[s.rollNumber] = res.data.existingAttendance[s.rollNumber]
          } else if (res.data?.existingLog?.absentRolls) {
            initialAttendance[s.rollNumber] = !res.data.existingLog.absentRolls.includes(s.rollNumber)
          } else {
            initialAttendance[s.rollNumber] = true
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

  // Centralized Live Session & Board Synchronizer
  const refreshLiveSessionAndBoard = useCallback(async () => {
    try {
      const [freshBoard, sessionRes] = await Promise.all([
        getWorkstationBoardData(currentLab.id || 'comp'),
        (selectedScheduleId || liveOngoingSession?.id)
          ? getLiveSessionContext(selectedScheduleId || liveOngoingSession!.id, effectiveDateStr)
          : null,
      ])
      if (freshBoard) setBoardData(freshBoard)
      if (sessionRes?.success && sessionRes.data) {
        const liveData = sessionRes.data
        setSessionContext(liveData)
        setSessionAttendance((prev) => {
          const next = { ...prev }
          liveData.expectedRoster.forEach((s) => {
            if (next[s.rollNumber] === undefined) {
              next[s.rollNumber] = true
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error('Error synchronizing workstation board and live session:', err)
    }
  }, [currentLab.id, selectedScheduleId, liveOngoingSession?.id, effectiveDateStr])

  // Auto-switch to ongoing scheduled session when time travels or period changes
  const prevPeriodKeyRef = React.useRef<string>('')
  const prevModeRef = React.useRef<string>(mode)
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
      prevPeriodKeyRef.current = `${effectiveDateStr}_suspended`
      return
    }

    const periodKey = `${effectiveDateStr}_${liveOngoingSession?.id || 'none'}`
    if (prevPeriodKeyRef.current !== periodKey || modeJustSwitchedToLive) {
      prevPeriodKeyRef.current = periodKey

      if (liveOngoingSession) {
        setSelectedScheduleId(liveOngoingSession.id)
        fetchLiveSession(liveOngoingSession.id, effectiveDateStr)
      } else if (!selectedScheduleId) {
        // Fallback only to today's sessions, NEVER load rogue sessions from other days!
        const fallback = todaySessions[0]
        if (fallback) {
          setSelectedScheduleId(fallback.id)
          fetchLiveSession(fallback.id, effectiveDateStr)
        } else {
          setSessionContext(null)
        }
      } else {
        // Re-fetch existing selected session with new simulated date
        fetchLiveSession(selectedScheduleId, effectiveDateStr)
      }
    }
  }, [mode, effectiveDateStr, liveOngoingSession, selectedScheduleId, todaySessions, dateSuspension.isSuspended, fetchLiveSession])

  // 3. Fetch Baseline Seating Plan when year/class changes in Mode B
  const fetchBaselineSeating = useCallback(async () => {
    if (!selectedClassId || !selectedYearId) return
    setLoading(true)
    try {
      const res = await getLabSeatPlan({
        labId: 'comp',
        classId: selectedClassId,
        academicYearId: selectedYearId,
      })
      if (res.success && res.data) {
        setBaselinePlanData(res.data)
      }
    } catch (err) {
      console.error('Failed to load baseline seating plan:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedClassId, selectedYearId])

  useEffect(() => {
    if (mode === 'baseline') {
      fetchBaselineSeating()
    }
  }, [mode, fetchBaselineSeating])

  // -------------------------------------------------------------
  // INTERACTIVE ROLL-CALL HANDLERS (MODE A)
  // -------------------------------------------------------------
  const handleToggleRollPresence = (rollNumber: number) => {
    if (sessionContext?.existingLog?.isLocked) {
      setSessionToast({ text: 'Session is locked. Edit window has expired.', type: 'error' })
      return
    }
    setSessionAttendance((prev) => ({
      ...prev,
      [rollNumber]: !prev[rollNumber],
    }))
  }

  const handleMarkAllPresent = () => {
    if (sessionContext?.existingLog?.isLocked) return
    if (!sessionContext) return
    const allPres: Record<number, boolean> = {}
    sessionContext.expectedRoster.forEach((s) => {
      allPres[s.rollNumber] = true
    })
    setSessionAttendance(allPres)
    setSessionToast({ text: 'All enrolled students marked present.', type: 'success' })
  }

  const handleInvertAttendance = () => {
    if (sessionContext?.existingLog?.isLocked || !sessionContext) return
    setSessionAttendance((prev) => {
      const next: Record<number, boolean> = {}
      sessionContext.expectedRoster.forEach((s) => {
        next[s.rollNumber] = !prev[s.rollNumber]
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
      const attendancePayload = sessionContext.expectedRoster.map((s) => ({
        studentId: s.studentId,
        enrollmentId: s.enrollmentId,
        rollNumber: s.rollNumber,
        isPresent: sessionAttendance[s.rollNumber] !== false,
      }))

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
    ? sessionContext.expectedRoster.filter((s) => sessionAttendance[s.rollNumber] !== false).length
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
      if (sessionAttendance[student.rollNumber] === false) continue

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
      if (sessionAttendance[student.rollNumber] === false) continue

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
        return sessionAttendance[seatedStudent.rollNumber] === false
      })
      .map((w) => {
        const seatedStudent = sessionContext?.seatPlan?.[w.id]
        const isAbsent = seatedStudent ? sessionAttendance[seatedStudent.rollNumber] === false : false
        return {
          id: w.id,
          label: w.label,
          description: isAbsent && seatedStudent
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
          original_workstation_label: liveAssigned.originalWorkstationLabel || null,
        }
        isPresent = sessionAttendance[liveAssigned.rollNumber] !== false
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
            student_name: nodeAssignment.student_name,
            roll_number: nodeAssignment.roll_number,
            enrollment_id: nodeAssignment.enrollment_id,
            photo_url: nodeAssignment.photo_url || null,
            original_workstation_label: nodeAssignment.original_workstation_label || null,
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'live'
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'baseline'
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
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-amber-500/40 ${
            faultCount > 0 ? 'border-amber-500/30' : ''
          }`}
          title="Open Flagged Issues in Lab Diagnostics & Maintenance Workbench"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${
                faultCount > 0 ? 'bg-amber-500/15 text-amber-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <AlertTriangle className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Flagged Issues
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
              faultCount > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
            }`}>
              {faultCount === 0 ? 'Nominal' : `${faultCount} Open`}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${
              faultCount > 0 ? 'text-amber-500' : 'text-zinc-950 dark:text-white'
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
          className={`glass-card p-2.5 sm:p-3 rounded-xl flex flex-col justify-between h-[76px] cursor-pointer transition-all hover:border-rose-500/40 ${
            repairCount > 0 ? 'border-rose-500/30' : ''
          }`}
          title="Open Stations Under Repair in Lab Diagnostics & Maintenance Workbench"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-md ${
                repairCount > 0 ? 'bg-rose-500/15 text-rose-500' : 'bg-zinc-500/10 text-zinc-400'
              }`}>
                <Wrench className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-400 dark:text-slate-400">
                Under Repair
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
              repairCount > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-400'
            }`}>
              {repairCount === 0 ? 'Clear' : 'Servicing'}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className={`text-xl sm:text-[22px] font-extrabold font-heading tabular-nums ${
              repairCount > 0 ? 'text-rose-500' : 'text-zinc-950 dark:text-white'
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
                  setSelectedScheduleId('')
                  setSessionContext(null)
                }}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#101726] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-sm text-white flex items-center gap-2">
                  <Play className="h-4 w-4 text-indigo-400 fill-indigo-400" />
                  <span>Select a Session to Launch Cockpit</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Pick a scheduled timetable slot or start an unscheduled ad-hoc makeup session.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {scheduledSessions.length > 0 && (
                  <Select
                    value={selectedScheduleId}
                    onChange={(e) => {
                      const newId = e.target.value
                      setSelectedScheduleId(newId)
                      if (newId) {
                        fetchLiveSession(newId, effectiveDateStr)
                      } else {
                        setSessionContext(null)
                      }
                    }}
                    className="h-9 text-xs bg-[#151E32] border-white/10 text-white rounded-xl min-w-[240px]"
                  >
                    <option value="">-- Choose Timetable Slot (Computer Lab) --</option>
                    {todaySessions.length === 0 ? (
                      <option value="" disabled>No scheduled Computer Lab sessions today</option>
                    ) : (
                      todaySessions.map((s) => {
                        const isLive = s.id === liveOngoingSession?.id
                        const startMin = parseTimeToMinutes(s.startTime)
                        const isUpcoming = currentMinutes < startMin
                        const tag = isLive
                          ? '🟢 LIVE NOW: '
                          : isUpcoming
                          ? `🕒 UPCOMING (${s.startTime}): `
                          : `✓ PAST (${s.startTime}): `
                        return (
                          <option key={s.id} value={s.id}>
                            {tag}{s.batchName} &bull; {s.subjectName} ({s.startTime}–{s.endTime})
                          </option>
                        )
                      })
                    )}
                  </Select>
                )}

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAdHocModalOpen(true)}
                  className="h-9 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Start Unscheduled Session</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE B: BASELINE SEATING CONTROLS (TIER 1)                     */}
      {/* ------------------------------------------------------------- */}
      {mode === 'baseline' && (
        <div className="rounded-xl border border-white/[0.08] bg-[#101726] px-3 py-2 sm:px-4 sm:py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-1">
              <GraduationCap className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-200">Cohort:</span>
              {!isPrivileged && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-500/10 text-slate-400 border border-white/5">
                  View Only
                </span>
              )}
            </div>

            {/* Class & Academic Year side-by-side with tight height */}
            <div className="flex items-center gap-1.5">
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="h-8 text-xs bg-[#151E32] border-white/10 text-white rounded-lg min-w-[130px]"
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
                  className="h-8 text-xs bg-[#151E32] border-white/10 text-white rounded-lg min-w-[110px]"
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
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-[#151E32]/60 px-2.5 py-1 rounded-lg border border-white/5">
              <span>Enrolled: <strong className="text-white font-mono">{baselinePlanData?.total_students || 0}</strong></span>
              <span>&bull;</span>
              <span>Seated: <strong className="text-emerald-400 font-mono">{baselinePlanData?.assigned_count || 0}</strong></span>
              <span>&bull;</span>
              <span>Unassigned: <strong className="text-amber-400 font-mono">{baselinePlanData?.unassigned_count || 0}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Print Wall Chart Button */}
            <Link
              href={`/print/seating-chart?class_id=${selectedClassId}&academic_year_id=${selectedYearId}`}
              target="_blank"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs rounded-lg border-white/10 text-slate-200 hover:bg-white/5 gap-1.5"
              >
                <Printer className="h-3.5 w-3.5 text-indigo-400" />
                <span>Print Chart</span>
              </Button>
            </Link>

            {/* Unassigned Students Tray Toggle Button */}
            <Button
              type="button"
              variant={isSlideDrawerOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsSlideDrawerOpen(!isSlideDrawerOpen)}
              className={`h-8 px-2.5 text-xs rounded-lg gap-1.5 transition-all ${
                isSlideDrawerOpen
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'border-white/10 text-slate-200 hover:bg-white/5'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-indigo-400" />
              <span>Unassigned ({baselinePlanData?.unassigned_count || 0})</span>
            </Button>

            {isPrivileged && (
              <>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}

      {/* 4. HERO FLOOR CANVAS & UNASSIGNED STUDENT DOCK */}
      <div className="flex flex-col xl:flex-row items-start gap-3 w-full">
        {/* Full-width Hero Floor Canvas */}
        <div
          {...viewport.containerProps}
          className={`relative flex-1 w-full min-w-0 rounded-2xl border border-white/[0.08] bg-[#0B0F19] overflow-hidden select-none shadow-2xl ${
            viewport.isPanning || viewport.isPanToolActive ? 'cursor-grab active:cursor-grabbing' : ''
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
          />

          {/* Floating Operational Lifecycle Banner (Live vs. Standby Preview) */}
          {mode === 'live' && sessionContext && (
            sessionTimingStatus?.status === 'upcoming' ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0D131F]/95 border border-amber-500/40 text-amber-300 text-xs shadow-2xl backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                <span className="font-heading font-black text-[11px] uppercase tracking-wider text-amber-300">
                  STANDBY PREVIEW MODE
                </span>
                <span className="text-slate-300 text-[11px] hidden sm:inline">
                  &bull; Pre-allocated seating for <strong className="text-white">{sessionContext.subjectCode}</strong> ({sessionContext.className}). Begins at <strong className="text-amber-200">{sessionContext.startTime}</strong> ({sessionTimingStatus.startsInMins}m).
                </span>
              </div>
            ) : sessionTimingStatus?.status === 'live' ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#091E18]/95 border border-emerald-500/50 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                </span>
                <span className="font-heading font-black text-[11px] uppercase tracking-wider text-emerald-300">
                  LIVE SESSION ACTIVE
                </span>
                <span className="text-slate-200 text-[11px] hidden sm:inline">
                  &bull; <strong className="text-white">{sessionContext.subjectCode}</strong> practical in progress. In-seat roll-call live.
                </span>
              </div>
            ) : null
          )}

          {/* Collapsible Minimap Radar */}
          {isMinimapVisible && (
            <CanvasMinimapRadar
              workstations={boardData.workstations.map((w) => ({
                ...w,
                isPresent:
                  mode === 'live' && sessionContext && sessionContext.seatPlan[w.id]
                    ? sessionAttendance[sessionContext.seatPlan[w.id].rollNumber] !== false
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
              ...viewport.canvasTransformStyle,
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.04) 0%, transparent 80%),
                linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: '100% 100%, 32px 32px, 32px 32px',
            }}
            className="relative w-full aspect-[16/9] min-h-[440px] sm:min-h-[560px]"
          >
            {/* Real-Life Architectural Desk Tables & Corridor Structures */}
            <LabDeskStructureOverlay />

            {/* Database Floor Landmarks */}
            {floorElements.map((el) => (
              <FloorLandmarkNode key={el.id} element={el} />
            ))}

            {/* Workstations Canvas */}
            {boardData.workstations.map((ws) => {
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
                    original_workstation_label: liveAssigned.originalWorkstationLabel || null,
                  }
                  isPresent = sessionAttendance[liveAssigned.rollNumber] !== false
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
                      student_name: nodeAssignment.student_name,
                      roll_number: nodeAssignment.roll_number,
                      photo_url: nodeAssignment.photo_url || null,
                      original_workstation_label: nodeAssignment.original_workstation_label || null,
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
              <div className="absolute inset-0 bg-[#0B0F19]/60 backdrop-blur-xs flex items-center justify-center z-40">
                <div className="flex items-center gap-2 rounded-xl bg-[#151E32] px-4 py-2 border border-white/10 text-xs font-semibold text-white">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Synchronizing lab state...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unassigned Student Sidebar (Only in Baseline Mode when open - never obscures PCs!) */}
        {mode === 'baseline' && isSlideDrawerOpen && (
          <div className="w-full xl:w-84 xl:max-w-[340px] shrink-0 sticky top-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-3 border border-white/[0.08] bg-[#101726] rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <h4 className="font-heading font-extrabold text-xs text-white">
                  Unassigned Tray
                </h4>
                <Badge className="bg-indigo-500/10 text-indigo-300 text-[10px]">
                  {baselinePlanData?.unassigned_students.length || 0}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => setIsSlideDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#101726] p-3 text-xs text-slate-300 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span>Present / Operational</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Absent / Station Offline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
            <span>Assigned Workstation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>Session Override</span>
          </div>
        </div>

        {mode === 'live' && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-heading font-extrabold text-sm text-white">
                    Temporary Seat Override
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Assign student to <strong className="text-white">{activeWsModal.label}</strong> for today only
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOverrideModalOpen(false)
                  setActiveWsModal(null)
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Select Student from Roster
              </label>
              <Select
                value={overrideStudentEnrollmentId}
                onChange={(e) => setOverrideStudentEnrollmentId(e.target.value)}
                className="w-full h-9.5 text-xs bg-[#151E32] border-white/10 text-white rounded-xl"
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
                          const isAbsent = sessionAttendance[s.rollNumber] === false
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#101726] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Monitor className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-extrabold text-sm text-white">
                      Workstation {activeBaselineModalWs.label}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                      {activeBaselineModalWs.row_label || 'Floor Grid'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
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
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Current Occupant Details */}
            {activeBaselineModalWs.assignment ? (
              <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                    Currently Assigned Student
                  </span>
                  <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[10px]">
                    Seated
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-mono font-bold flex items-center justify-center text-xs">
                    R-{activeBaselineModalWs.assignment.roll_number}
                  </span>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-white">
                      {activeBaselineModalWs.assignment.student_name}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
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
                      className="h-8 text-xs rounded-xl border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Unseat Student</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-white/10 bg-[#151E32]/60 text-center space-y-2">
                <span className="text-xs font-semibold text-slate-300">
                  This workstation is currently <strong className="text-emerald-400">Available</strong>.
                </span>
                {isPrivileged ? (
                  <div className="space-y-2 text-left pt-2">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      Assign Unassigned Student:
                    </label>
                    <Select
                      value={selectedAssignModalEnrollmentId}
                      onChange={(e) => setSelectedAssignModalEnrollmentId(e.target.value)}
                      className="w-full h-9 text-xs bg-[#0B0F19] border-white/10 text-white rounded-xl"
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
                  <p className="text-[11px] text-slate-400">
                    Seating allocations are managed by Lab In-Charge and Super Admin.
                  </p>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
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
          className={`fixed bottom-6 right-6 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md max-w-md animate-in slide-in-from-right fade-in duration-300 ${
            sessionToast.type === 'success'
              ? 'bg-[#101726]/95 border-emerald-500/30 text-emerald-300 shadow-[0_8px_32px_rgba(16,185,129,0.2)]'
              : 'bg-[#101726]/95 border-rose-500/30 text-rose-300 shadow-[0_8px_32px_rgba(244,63,94,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {sessionToast.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4.5 w-4.5 text-rose-400 shrink-0" />
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
