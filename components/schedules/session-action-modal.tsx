'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  Merge,
  Clock,
  Users,
  Trash2,
  Split,
  CalendarPlus,
  UserCheck,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Wrench,
} from 'lucide-react'
import {
  MasterRoutineItem,
  MASTER_TIME_SLOTS,
  DAYS,
  LAB_ROOMS,
  DayKey,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  formatGradeBadge
} from '@/lib/master-data'
import { getNepalDateStr } from '@/lib/nepali-date'
import { matchesGrade } from '@/lib/context/institutional-relationships'
import { PracticalLogRecord } from '@/hooks/use-logs-state'
import { createPracticalLog } from '@/app/actions/logs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useSubstitutionState } from '@/hooks/use-substitution-state'
import { useIncidentState } from '@/hooks/use-incident-state'
import { UserProfile } from '@/app/actions/auth'
import { resolveUserScope } from '@/lib/context/user-scope'

const TEACHER_NAME_MAP: Record<string, string> = {
  t1: 'Dr. Rajesh Sharma (Computer Science)',
  t2: 'Dr. Prakash Adhikari (Physics)',
  t3: 'Ms. Sunita Thapa (Chemistry)',
  t4: 'Er. Anish Karki (Electronics)',
  t5: 'Dr. Nirmala Poudel (Biology)',
}

export type ModalMode = 'log' | 'skip' | 'merge' | 'adhoc' | 'book' | 'delete' | 'edit' | 'substitute' | 'incident'

interface SessionActionModalProps {
  isOpen: boolean
  onClose: () => void
  session: MasterRoutineItem | null
  existingLog?: PracticalLogRecord | null
  allRoutines?: MasterRoutineItem[]
  initialMode?: ModalMode
  currentUser?: UserProfile | null
  onSuccess?: (message: string) => void
  onDeleteSession?: (sessionId: string) => void
  onExtendSession?: (sessionId: string, span: number) => void
  onMergeSession?: (
    sessionId: string,
    nextSessionId?: string,
    mergedCode?: string,
    mergedTitle?: string,
    mergedGrade?: string,
    mergedTeacher?: string
  ) => void
  onUnmergeSession?: (sessionId: string) => void
  onAddSession?: (session: MasterRoutineItem) => void
  onSaveLog?: (logData: Omit<PracticalLogRecord, 'id' | 'createdAt'> & { id?: string }) => void
  onSkipSession?: (sessionId: string, reason: string) => void
  onUnskipSession?: (sessionId: string) => void
}

export default function SessionActionModal(props: SessionActionModalProps) {
  if (!props.isOpen) return null

  return (
    <SessionActionModalContent
      key={`${props.session?.id || 'new'}-${props.initialMode}-${props.session?.dayKey || 'day'}-${props.session?.slotId || 'slot'}`}
      {...props}
    />
  )
}

function SessionActionModalContent({
  onClose,
  session,
  existingLog = null,
  allRoutines = [],
  initialMode = 'log',
  currentUser = null,
  onSuccess,
  onDeleteSession,
  onMergeSession,
  onUnmergeSession,
  onAddSession,
  onSaveLog,
  onSkipSession,
  onUnskipSession,
}: SessionActionModalProps) {
  const isBookingMode =
    initialMode === 'book' ||
    initialMode === 'adhoc' ||
    Boolean(session?.id?.startsWith('adhoc') || session?.id?.startsWith('quick-book'))

  const [activeTab, setActiveTab] = useState<ModalMode>(isBookingMode ? 'book' : initialMode === 'edit' ? 'log' : initialMode)

  const userScope = resolveUserScope(currentUser)
  const isTeacher = userScope.isTeacher
  const teacherName = userScope.teacherProfile?.name || currentUser?.full_name || ''
  const isOwnSession =
    !isTeacher ||
    (session?.teacher && (
      session.teacher.toLowerCase().includes(teacherName.toLowerCase()) ||
      teacherName.toLowerCase().includes(session.teacher.toLowerCase())
    )) ||
    (session?.requestedBy && (
      session.requestedBy.toLowerCase().includes(teacherName.toLowerCase()) ||
      teacherName.toLowerCase().includes(session.requestedBy.toLowerCase())
    ))

  const {
    faculty: infraFaculty,
    subjects: infraSubjects,
    classes: infraClasses,
    labs: infraLabs,
    getHolidayForDate,
  } = useInfrastructureState()

  const todayStr = getNepalDateStr(new Date())
  const holidayItem = getHolidayForDate(todayStr)
  const isHoliday = Boolean(holidayItem)

  const allClasses = (infraClasses && infraClasses.length > 0) ? infraClasses : DEFAULT_CLASSES
  const scopedClasses = (isTeacher && userScope.assignedClasses.length > 0)
    ? allClasses.filter((c) =>
        userScope.assignedClasses.some((ac) => ac === c.name || c.name.includes(ac) || ac.includes(c.name))
      )
    : allClasses

  const rawInitialGrade = formatGradeBadge(session?.grade || '12C')
  const initialGrade = (isTeacher && userScope.assignedClasses.length > 0)
    ? (scopedClasses.find((c) => c.name === rawInitialGrade)?.name || scopedClasses[0]?.name || userScope.assignedClasses[0])
    : rawInitialGrade

  const getSubjectsForGrade = useCallback((gradeName: string) => {
    const rawSubs = (infraSubjects && infraSubjects.length > 0) ? infraSubjects : DEFAULT_SUBJECTS
    // 1. Direct match
    const direct = rawSubs.filter((s) => s.grade === gradeName)
    let candidate = direct
    // 2. If no direct match, fuzzy match
    if (candidate.length === 0) {
      const fuzzy = rawSubs.filter((s) => matchesGrade(s.grade, gradeName))
      if (fuzzy.length > 0) candidate = fuzzy
    }
    // 3. If still empty, return all raw subjects
    if (candidate.length === 0) {
      candidate = rawSubs
    }

    if (isTeacher && userScope.assignedSubjects.length > 0) {
      const filtered = candidate.filter((s) =>
        userScope.assignedSubjects.some((asub) =>
          asub.code.toLowerCase() === s.code.toLowerCase() ||
          asub.title.toLowerCase().includes(s.title.toLowerCase()) ||
          s.title.toLowerCase().includes(asub.title.toLowerCase())
        )
      )
      return filtered.length > 0 ? filtered : candidate
    }
    return candidate
  }, [infraSubjects, isTeacher, userScope.assignedSubjects])

  // Booking form state
  const [bookDayKey, setBookDayKey] = useState<DayKey>(session?.dayKey || 'mon')
  const [bookSlotId, setBookSlotId] = useState<string>(session?.slotId || 't2')
  const [bookGrade, setBookGrade] = useState<string>(initialGrade)

  // Reactive bookClassSubjects dependent on bookGrade
  const bookClassSubjects = useMemo(() => {
    return getSubjectsForGrade(bookGrade)
  }, [getSubjectsForGrade, bookGrade])

  const initialBookSub = bookClassSubjects[0] || (infraSubjects && infraSubjects[0]) || DEFAULT_SUBJECTS[0]
  const initialCls = scopedClasses.find((c: any) => c.name === initialGrade) || allClasses.find((c: any) => c.name === initialGrade)

  const [bookSubjectCode, setBookSubjectCode] = useState<string>(session?.subjectCode || initialBookSub.code)
  const [bookSubjectTitle, setBookSubjectTitle] = useState<string>(session?.subjectTitle || initialBookSub.title)
  const [bookLabKey, setBookLabKey] = useState<MasterRoutineItem['labKey']>(
    (session?.labKey || initialBookSub.labId || 'comp') as MasterRoutineItem['labKey']
  )
  const [bookTeacher, setBookTeacher] = useState<string>(
    isTeacher
      ? teacherName
      : (session?.teacher || (initialBookSub as any)?.teacherName || 'Dr. Rajesh Sharma')
  )
  const [bookSpan, setBookSpan] = useState<number>(session?.span || 1)
  const [bookStudents, setBookStudents] = useState<number>((initialCls as any)?.capacity || (initialCls as any)?.strength || session?.defaultStudents || 38)

  const handleBookGradeChange = (newGrade: string) => {
    setBookGrade(newGrade)
    const cls = scopedClasses.find((c) => c.name === newGrade) || allClasses.find((c) => c.name === newGrade)
    if (cls) {
      setBookStudents((cls as any).capacity || (cls as any).strength || 36)
    }
    const matching = getSubjectsForGrade(newGrade)
    if (matching.length > 0) {
      const sub = matching[0]
      setBookSubjectCode(sub.code)
      setBookSubjectTitle(sub.title)
      setBookLabKey((sub.labId || 'comp') as MasterRoutineItem['labKey'])
      if (!isTeacher) {
        const teacher = infraFaculty.find((f) => f.id === sub.teacherId)
        setBookTeacher(teacher ? teacher.name : (sub as any).teacherName || 'Dr. Rajesh Sharma')
      }
    }
  }

  const handleBookSubjectChange = (code: string) => {
    setBookSubjectCode(code)
    const sub = infraSubjects.find((s) => s.code === code) || DEFAULT_SUBJECTS.find((s) => s.code === code)
    if (sub) {
      setBookSubjectTitle(sub.title)
      setBookLabKey((sub.labId || 'comp') as MasterRoutineItem['labKey'])
      if (!isTeacher) {
        const teacher = infraFaculty.find((f) => f.id === sub.teacherId)
        setBookTeacher(teacher ? teacher.name : (sub as any).teacherName || 'Dr. Rajesh Sharma')
      }
    }
  }

  // Find consecutive next session for merging
  const currentSlotIdx = session ? MASTER_TIME_SLOTS.findIndex((t) => t.id === session.slotId) : -1
  const span = session?.span || 1
  const nextSlotIdx = currentSlotIdx !== -1 ? currentSlotIdx + span : -1
  const nextSlot = nextSlotIdx < MASTER_TIME_SLOTS.length ? MASTER_TIME_SLOTS[nextSlotIdx] : null

  const nextSession = (session && nextSlot)
    ? allRoutines.find((r) => r.dayKey === session.dayKey && r.slotId === nextSlot.id)
    : null

  const isAlreadyMergedOrExtended = (session?.span || 1) > 1 || (session?.subjectCode.includes(' + ') ?? false)

  // Existing session state initialized directly without cascading useEffect renders
  const [totalStudents, setTotalStudents] = useState<number>(
    existingLog?.totalStudents || session?.defaultStudents || 36
  )
  const [absentRolls, setAbsentRolls] = useState<number[]>(existingLog?.absentRolls || [])
  const [attendanceMode, setAttendanceMode] = useState<'counter' | 'grid'>('counter')
  const [absentCountInput, setAbsentCountInput] = useState<number>(existingLog?.absentStudents || 0)
  const [topicLearned, setTopicLearned] = useState<string>(existingLog?.topicLearned || '')
  const [selectedLab] = useState<string>(existingLog?.lab || session?.lab || 'Computer Lab')
  const [selectedTeacher] = useState<string>(existingLog?.teacher || session?.teacher || '')
  const [skipReason, setSkipReason] = useState<string>(
    existingLog?.skipReason || 'Theory Class Conducted in Classroom'
  )

  const currentLabKey = isBookingMode ? bookLabKey : (session?.labKey || 'comp')
  const targetLabInfo = (infraLabs || []).find(
    (l) => l.id === currentLabKey || l.name?.toLowerCase().includes(currentLabKey.toLowerCase())
  )
  const isLabUnderMaintenance = targetLabInfo?.status === 'Under Maintenance'
  const mergedCode = nextSession ? `${session?.subjectCode} + ${nextSession.subjectCode}` : (session?.subjectCode || '')
  const mergedTitle = nextSession ? `${session?.subjectTitle} & ${nextSession.subjectTitle}` : (session?.subjectTitle || '')
  const [remarks, setRemarks] = useState<string>(existingLog?.remarks || '')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const { assignProxy } = useSubstitutionState()
  const { logIncident } = useIncidentState()

  // Substitution state
  const [subTeacherId, setSubTeacherId] = useState<string>(infraFaculty[0]?.id || 't4')
  const [subDate, setSubDate] = useState<string>(getNepalDateStr())
  const [subReason, setSubReason] = useState<string>('Official Leave / Exam Duty')
  const [subError, setSubError] = useState<string | null>(null)

  // Incident & Damage state
  const [incTitle, setIncTitle] = useState<string>('')
  const [incType, setIncType] = useState<'breakage' | 'malfunction' | 'chemical_hazard' | 'burnt_apparatus' | 'missing' | 'other'>('breakage')
  const [incSeverity, setIncSeverity] = useState<'minor' | 'moderate' | 'major_critical'>('minor')
  const [incEquipment, setIncEquipment] = useState<string>('')
  const [incQuantity, setIncQuantity] = useState<number>(1)
  const [incRolls, setIncRolls] = useState<string>('')
  const [incRemarks, setIncRemarks] = useState<string>('')

  const effectiveAbsentCount =
    attendanceMode === 'grid'
      ? absentRolls.length
      : Math.max(0, Math.min(totalStudents, absentCountInput))
  const presentStudents = Math.min(totalStudents, Math.max(0, totalStudents - effectiveAbsentCount))
  const attendancePercent =
    totalStudents > 0
      ? Math.min(100, Math.max(0, Math.round((presentStudents / totalStudents) * 100)))
      : 0

  const toggleRollNumber = (roll: number) => {
    setAbsentRolls((prev) =>
      prev.includes(roll) ? prev.filter((r) => r !== roll) : [...prev, roll]
    )
  }

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubError(null)

    if (activeTab === 'book') {
      if (isLabUnderMaintenance) {
        setSubError(`Cannot book slot: "${targetLabInfo?.name || 'Selected laboratory'}" is currently Under Maintenance.`)
        setIsSubmitting(false)
        return
      }
      const dayObj = DAYS.find((d) => d.id === bookDayKey)
      const slotObj = MASTER_TIME_SLOTS.find((s) => s.id === bookSlotId)
      const labObj = LAB_ROOMS.find((l) => l.id === bookLabKey) || LAB_ROOMS[0]

      const labCategory =
        bookLabKey === 'comp'
          ? 'Computer'
          : bookLabKey === 'phys'
          ? 'Physics'
          : bookLabKey === 'chem'
          ? 'Chemistry'
          : bookLabKey === 'bio'
          ? 'Biology'
          : 'Electronics'

      const dotColor =
        bookLabKey === 'comp'
          ? 'bg-indigo-500'
          : bookLabKey === 'phys'
          ? 'bg-cyan-500'
          : bookLabKey === 'chem'
          ? 'bg-rose-500'
          : bookLabKey === 'bio'
          ? 'bg-emerald-500'
          : 'bg-amber-500'

      const accentColor =
        bookLabKey === 'comp'
          ? 'border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-zinc-950 dark:text-white'
          : bookLabKey === 'phys'
          ? 'border-l-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 text-zinc-950 dark:text-white'
          : bookLabKey === 'chem'
          ? 'border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-zinc-950 dark:text-white'
          : bookLabKey === 'bio'
          ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-zinc-950 dark:text-white'
          : 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-zinc-950 dark:text-white'

      const badgeColor =
        bookLabKey === 'comp'
          ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700'
          : bookLabKey === 'phys'
          ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700'
          : bookLabKey === 'chem'
          ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-700'
          : bookLabKey === 'bio'
          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700'
          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-700'

      const assignedTeacher = isTeacher ? (currentUser?.full_name || 'Subject Teacher') : bookTeacher

      const newSessionItem: MasterRoutineItem = {
        id: `sess-${Date.now()}`,
        day: dayObj?.label || 'Monday',
        dayKey: bookDayKey,
        timeSlot: slotObj?.label || '10:10 - 11:00',
        slotId: bookSlotId,
        span: bookSpan,
        subjectCode: bookSubjectCode,
        subjectTitle: bookSubjectTitle,
        grade: bookGrade,
        gradeKey: ('class-' + (bookGrade.replace(/\D/g, '') || '12')) as MasterRoutineItem['gradeKey'],
        teacher: assignedTeacher,
        lab: labObj.name as MasterRoutineItem['lab'],
        labKey: bookLabKey,
        defaultStudents: bookStudents,
        category: labCategory,
        dotColor,
        badgeColor,
        accentColor,
        status: isTeacher ? 'requested' : 'confirmed',
        requestedBy: isTeacher ? (currentUser?.full_name || 'Subject Teacher') : undefined,
      }

      if (onAddSession) {
        onAddSession(newSessionItem)
      }
      if (onSuccess) {
        if (isTeacher) {
          onSuccess(`Practical slot booking request submitted for ${dayObj?.label} (${assignedTeacher})!`)
        } else {
          onSuccess(`Practical session booked successfully for ${dayObj?.label}!`)
        }
      }
      onClose()
      return
    }

    if (!session) return

    if (activeTab === 'delete') {
      if (isTeacher) {
        setSubError('Subject Teachers are not authorized to delete scheduled sessions.')
        setIsSubmitting(false)
        return
      }
      if (onDeleteSession) {
        onDeleteSession(session.id)
        if (onSuccess) onSuccess('Schedule slot removed.')
        onClose()
        return
      }
    } else if (activeTab === 'merge') {
      if (isAlreadyMergedOrExtended && onUnmergeSession) {
        onUnmergeSession(session.id)
        if (onSuccess) onSuccess('Session split back into separate slots.')
      } else if (onMergeSession) {
        const finalCode = mergedCode || (nextSession ? `${session.subjectCode} + ${nextSession.subjectCode}` : session.subjectCode)
        const finalTitle = mergedTitle || (nextSession ? `${session.subjectTitle} & ${nextSession.subjectTitle}` : `${session.subjectTitle} (Extended Block)`)

        if (nextSession) {
          const combinedGrade = session.grade === nextSession.grade ? session.grade : `${session.grade} & ${nextSession.grade}`
          const combinedTeacher = session.teacher === nextSession.teacher ? session.teacher : `${session.teacher} & ${nextSession.teacher}`
          onMergeSession(session.id, nextSession.id, finalCode, finalTitle, combinedGrade, combinedTeacher)
          if (onSuccess) onSuccess(`Merged ${session.subjectCode} with ${nextSession.subjectCode}!`)
        } else {
          onMergeSession(session.id, undefined, finalCode, finalTitle)
          if (onSuccess) onSuccess(`Extended ${session.subjectCode} duration!`)
        }
      }
      onClose()
    } else if (activeTab === 'log') {
      if (isHoliday) {
        setSubError(`Session logging is locked: Today is an official institutional holiday (${holidayItem?.name || 'Academic Recess'}). Practicals are automatically cancelled and no logs can be created.`)
        setIsSubmitting(false)
        return
      }

      const sanitizedRolls = Array.from(
        new Set(
          absentRolls
            .map((r) => (typeof r === 'number' ? r : parseInt(String(r), 10)))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      ).sort((a, b) => a - b)

      const safeTotal = Math.max(1, totalStudents)
      const safeAbsent = Math.max(0, Math.min(safeTotal, effectiveAbsentCount))
      const safePresent = Math.max(0, Math.min(safeTotal, safeTotal - safeAbsent))

      const logRecord = {
        id: existingLog?.id,
        sessionId: session.id,
        date: getNepalDateStr(),
        dayKey: session.dayKey,
        slotId: session.slotId,
        timeSlot: session.timeSlot,
        subjectCode: session.subjectCode,
        subjectTitle: session.subjectTitle,
        grade: session.grade,
        teacher: selectedTeacher || session.teacher,
        lab: selectedLab,
        status: 'conducted' as const,
        topicLearned: topicLearned || 'Conducted Practical Curriculum Experiment',
        totalStudents: safeTotal,
        presentStudents: safePresent,
        absentStudents: safeAbsent,
        absentRolls: sanitizedRolls,
        remarks,
      }

      if (onSaveLog) {
        onSaveLog(logRecord)
      } else {
        // Fallback server action persistence only if onSaveLog is not provided
        createPracticalLog({
          schedule_id: session.id,
          lab_id: session.labKey || 'comp',
          teacher_id: selectedTeacher || session.teacher,
          date: getNepalDateStr(),
          period_label: session.timeSlot,
          subject_name: `${session.subjectCode} - ${session.subjectTitle}`,
          batch_group: session.grade,
          practical_title: topicLearned || 'Conducted Practical Curriculum Experiment',
          total_students: safeTotal,
          present_students: safePresent,
          absent_students: safeAbsent,
          remarks,
          status: 'conducted',
          topic_learned: topicLearned,
        }).catch(() => {})
      }

      if (onSuccess) onSuccess('Practical log recorded successfully.')
      onClose()
    } else if (activeTab === 'skip') {
      if (isHoliday) {
        setSubError(`Sessions on institutional holidays cannot be marked as skipped. They are automatically cancelled due to academic recess.`)
        setIsSubmitting(false)
        return
      }

      if (!isOwnSession) {
        setSubError(`Subject Teachers can only skip their own assigned sessions. This session belongs to ${session.teacher}.`)
        setIsSubmitting(false)
        return
      }

      const finalSkipReason = skipReason + (remarks ? ` - ${remarks}` : '')
      if (onSkipSession) {
        onSkipSession(session.id, finalSkipReason)
      }

      if (onSaveLog) {
        onSaveLog({
          id: existingLog?.id,
          sessionId: session.id,
          date: getNepalDateStr(),
          dayKey: session.dayKey,
          slotId: session.slotId,
          timeSlot: session.timeSlot,
          subjectCode: session.subjectCode,
          subjectTitle: session.subjectTitle,
          grade: session.grade,
          teacher: selectedTeacher || session.teacher,
          lab: selectedLab,
          status: 'skipped',
          skipReason,
          remarks,
          totalStudents: 0,
          presentStudents: 0,
          absentStudents: 0,
        })
      }
      if (onSuccess) onSuccess(`Session marked as skipped: ${skipReason}`)
      onClose()
      return
    } else if (activeTab === 'substitute' && session) {
      const subFacultyObj = infraFaculty.find((f) => f.id === subTeacherId)
      const res = await assignProxy({
        schedule_id: session.id,
        date: subDate,
        slot_id: session.slotId,
        lab_id: session.labKey || 'comp',
        original_teacher_id: session.teacher,
        original_teacher_name: session.teacher,
        substitute_teacher_id: subTeacherId,
        substitute_teacher_name: subFacultyObj ? subFacultyObj.name : subTeacherId,
        reason: subReason,
      })

      if (!res.success) {
        setSubError(res.error || 'Failed to assign proxy teacher')
        setIsSubmitting(false)
        return
      }

      if (onSuccess) onSuccess(`Proxy teacher assigned: ${subFacultyObj?.name} for ${session.teacher}`)
      onClose()
    } else if (activeTab === 'incident' && session) {
      await logIncident({
        lab_id: session.labKey || 'comp',
        schedule_id: session.id,
        date: getNepalDateStr(),
        session_label: `${session.timeSlot} (${session.grade})`,
        subject_name: `${session.subjectCode} - ${session.subjectTitle}`,
        subject_teacher_name: selectedTeacher || session.teacher,
        batch_name: session.grade,
        title: incTitle || `${incRemarks?.substring(0, 40) || 'Practical Breakage / Incident'} (${session.lab})`,
        incident_type: incType,
        severity: incSeverity,
        equipment_name: incEquipment || 'Laboratory Equipment',
        quantity: 1,
        student_rolls: incRolls || undefined,
        resolution_notes: incRemarks || undefined,
        reported_by: selectedTeacher || session.teacher,
      })

      if (onSuccess) onSuccess('Incident reported. Alerts dispatched to Admin, Lab In-Charge & HOD.')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200/90 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4.5 px-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-100 uppercase">
              {isBookingMode ? 'Schedule Practical Laboratory Slot' : 'Practical Session Operations'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Maintenance Warning Banner */}
        {isLabUnderMaintenance && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 text-xs font-sans">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Notice: Laboratory Under Scheduled Maintenance</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
                {targetLabInfo?.name || 'This laboratory'} is currently designated as Under Maintenance. Practical session booking and routine execution are restricted until servicing is completed.
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation (Only shown for existing scheduled sessions) */}
        {!isBookingMode && (
          <div className="flex items-center gap-1 p-2 bg-zinc-100/70 dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('log')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'log'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{existingLog ? 'Edit Log' : 'Log Attendance'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('skip')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'skip'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Skip</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('merge')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'merge'
                  ? isAlreadyMergedOrExtended
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              {isAlreadyMergedOrExtended ? (
                <>
                  <Split className="h-3.5 w-3.5" />
                  <span>Split</span>
                </>
              ) : nextSession ? (
                <>
                  <Merge className="h-3.5 w-3.5" />
                  <span>Merge</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  <span>Extend</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('substitute')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 text-[11px] ${
                activeTab === 'substitute'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              <UserCheck className="h-3 w-3" />
              <span>Substitute</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('incident')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 text-[11px] ${
                activeTab === 'incident'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Damage</span>
            </button>

            {/* Delete Tab Hidden for Teachers */}
            {!isTeacher && (
              <button
                type="button"
                onClick={() => setActiveTab('delete')}
                className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 text-[11px] ${
                  activeTab === 'delete'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                }`}
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}

        {/* Modal Body Form */}
        <form onSubmit={handleActionSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* A. NEW BOOKING FORM */}
          {activeTab === 'book' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 text-xs font-mono flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-zinc-700 dark:text-zinc-300">
                  Book and allocate a new practical laboratory session for the academic routine.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 font-mono">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Day of Week *
                  </label>
                  <Select
                    value={bookDayKey}
                    onChange={(e) => setBookDayKey(e.target.value as DayKey)}
                  >
                    {DAYS.filter((d) => !d.isWeekend).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label} ({d.nepaliName})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Period Slot *
                  </label>
                  <Select
                    value={bookSlotId}
                    onChange={(e) => setBookSlotId(e.target.value)}
                  >
                    {MASTER_TIME_SLOTS.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.name} ({slot.label})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Class & Subject Selector (Strictly Filtered by Class) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Target Class / Batch *
                    </label>
                    {isTeacher && userScope.assignedClasses.length > 0 && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                        {scopedClasses.length} Assigned Classes
                      </span>
                    )}
                  </div>
                  <Select
                    value={bookGrade}
                    onChange={(e) => handleBookGradeChange(e.target.value)}
                  >
                    {scopedClasses.map((c: any) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name} — {c.stream || 'General'} ({c.capacity || c.strength || 36} Students)
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Curriculum Subject *
                    </label>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                      {bookClassSubjects.length} for {bookGrade}
                    </span>
                  </div>
                  <Select
                    value={bookSubjectCode}
                    onChange={(e) => handleBookSubjectChange(e.target.value)}
                  >
                    {bookClassSubjects.length > 0 ? (
                      bookClassSubjects.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.title}
                        </option>
                      ))
                    ) : (
                      DEFAULT_SUBJECTS.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.title}
                        </option>
                      ))
                    )}
                  </Select>
                </div>
              </div>

              {/* Facility & Subject Teacher In-Charge */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Laboratory Facility *
                    </label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      Auto-synced
                    </span>
                  </div>
                  <Select
                    value={bookLabKey}
                    onChange={(e) => setBookLabKey(e.target.value as MasterRoutineItem['labKey'])}
                  >
                    {((infraLabs && infraLabs.length > 0) ? infraLabs : LAB_ROOMS).map((lab: any) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1 font-mono">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Subject Teacher *
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      {isTeacher ? 'Self (Locked)' : 'Auto-assigned'}
                    </span>
                  </div>
                  {isTeacher ? (
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                      <span className="truncate">{currentUser?.full_name}</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0">
                        Self
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={bookTeacher}
                      onChange={(e) => setBookTeacher(e.target.value)}
                    >
                      {infraFaculty.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name} ({f.role || 'Faculty'})
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Practical Syllabus Title / Focus
                </label>
                <Input
                  type="text"
                  required
                  value={bookSubjectTitle}
                  onChange={(e) => setBookSubjectTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms Lab"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 font-mono">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Slot Duration
                  </label>
                  <Select
                    value={bookSpan.toString()}
                    onChange={(e) => setBookSpan(parseInt(e.target.value) || 1)}
                  >
                    <option value="1">1 Period (45-50 min)</option>
                    <option value="2">2 Periods Combined (90 min Block)</option>
                  </Select>
                </div>

                <div className="space-y-1 font-mono">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Expected Students
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={bookStudents}
                    onChange={(e) => setBookStudents(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* B. LOG ATTENDANCE TAB */}
          {activeTab === 'log' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between font-mono">
                <div>
                  <h4 className="text-xs font-bold text-zinc-950 dark:text-white">
                    {session?.subjectCode} — {session?.subjectTitle}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    {session?.grade} • {session?.lab}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {session?.timeSlot}
                </Badge>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-zinc-400" />
                      Attendance Registry
                    </span>
                    <div className="flex items-center bg-zinc-200 dark:bg-zinc-800 p-0.5 rounded-md text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setAttendanceMode('counter')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          attendanceMode === 'counter'
                            ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold shadow-xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        Count
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendanceMode('grid')}
                        className={`px-2 py-0.5 rounded transition-all ${
                          attendanceMode === 'grid'
                            ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-bold shadow-xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        Roll Grid
                      </button>
                    </div>
                  </div>

                  <Badge
                    variant={
                      attendancePercent >= 80
                        ? 'success'
                        : attendancePercent >= 50
                        ? 'warning'
                        : 'destructive'
                    }
                  >
                    {presentStudents} Present ({attendancePercent}%)
                  </Badge>
                </div>

                {attendanceMode === 'counter' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 font-mono">Total Enrolled</label>
                      <Input
                        type="number"
                        min="1"
                        value={totalStudents}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                          setTotalStudents(val)
                          if (absentCountInput > val) setAbsentCountInput(val)
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 font-mono">Absent</label>
                      <Input
                        type="number"
                        min="0"
                        max={totalStudents}
                        value={absentCountInput}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0)
                          setAbsentCountInput(Math.min(val, totalStudents))
                        }}
                        className="border-amber-400 dark:border-amber-600 font-bold"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-500 font-mono">Present</label>
                      <div className="flex h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs items-center justify-center font-mono font-bold">
                        {presentStudents}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-32 overflow-y-auto p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                      {Array.from({ length: totalStudents }, (_, i) => i + 1).map((roll) => {
                        const isAbsent = absentRolls.includes(roll)
                        return (
                          <button
                            key={roll}
                            type="button"
                            onClick={() => toggleRollNumber(roll)}
                            title={isAbsent ? `Roll ${roll}: Absent (click to mark present)` : `Roll ${roll}: Present (click to mark absent)`}
                            className={`h-7 rounded text-xs font-mono font-bold transition-all cursor-pointer active:scale-95 select-none ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs hover:bg-rose-700'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {roll}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Practical Topic / What Was Learned *
                </label>
                <Input
                  type="text"
                  required
                  value={topicLearned}
                  onChange={(e) => setTopicLearned(e.target.value)}
                  placeholder="e.g. Verification of Hooke's Law"
                />
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Equipment status, student notes..."
                  className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          {/* C. SKIP TAB */}
          {activeTab === 'skip' && (
            <div className="space-y-4 animate-in fade-in duration-150 font-mono">
              {!isOwnSession ? (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Ownership Guard: Restricted Action</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    As a Subject Teacher, you are only authorized to skip your own scheduled practical sessions. This slot is currently assigned to <strong>{session?.teacher}</strong>.
                  </p>
                </div>
              ) : session?.isSkipped || session?.status === 'skipped' ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>This practical session is currently marked as SKIPPED</span>
                  </div>
                  <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
                    Reason: <strong>{session.skippedReason || 'Class Rescheduled / Not Conducted'}</strong>
                  </p>
                  {session.skippedBy && (
                    <p className="text-[10px] text-zinc-500">Flagged by: {session.skippedBy}</p>
                  )}
                  {onUnskipSession && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onUnskipSession(session.id)
                        if (onSuccess) onSuccess('Session unskipped and restored to active timetable.')
                        onClose()
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold mt-2"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Unskip / Restore Session
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
                    Marking this session as skipped records an institutional audit trail for why the laboratory was not utilized today.
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Reason for Non-Conduction
                    </label>
                    <Select
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                    >
                      <option value="Theory Class Conducted in Classroom">Theory Class Conducted in Classroom</option>
                      <option value="Assigned Teacher on Leave / Absent">Assigned Teacher on Leave / Absent</option>
                      <option value="Institutional Event / Assembly">Institutional Event / Assembly</option>
                      <option value="Power Failure / Maintenance">Power Failure / Maintenance</option>
                      <option value="Examination Period">Examination Period</option>
                      <option value="Other">Other Reason</option>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Additional notes..."
                      className="flex w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* D. MERGE TAB */}
          {activeTab === 'merge' && (
            <div className="space-y-4 animate-in fade-in duration-150 font-mono">
              {isAlreadyMergedOrExtended ? (
                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-xs space-y-2">
                  <div className="text-violet-900 dark:text-violet-200 font-bold flex items-center gap-1.5">
                    <Split className="h-4 w-4" />
                    <span>Split Multi-Period Block</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300 text-[11px]">
                    This session is currently a consolidated multi-period block. Splitting will unmerge it back into single periods.
                  </p>
                </div>
              ) : nextSession ? (
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
                  <div className="text-indigo-900 dark:text-indigo-200 font-bold flex items-center gap-1.5">
                    <Merge className="h-4 w-4" />
                    <span>Merge with {nextSession.subjectCode}</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300 text-[11px]">
                    Consolidates both consecutive classes into a combined 2-period practical block.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-xs space-y-2">
                  <div className="text-violet-900 dark:text-violet-200 font-bold flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>Extend into Next Period</span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300 text-[11px]">
                    The next period is free. Extending will stretch this experiment across 2 consecutive slots.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* E. DELETE TAB */}
          {activeTab === 'delete' && (
            <div className="space-y-4 animate-in fade-in duration-150 font-mono">
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <Trash2 className="h-4 w-4" />
                  <span>Remove Schedule Slot</span>
                </div>
                <p>
                  Are you sure you want to remove <strong>{session?.subjectCode}</strong> ({session?.day} at {session?.timeSlot}) from the routine?
                </p>
              </div>
            </div>
          )}

          {/* F. PROXY / SUBSTITUTE ASSIGNMENT TAB */}
          {activeTab === 'substitute' && session && (
            <div className="space-y-4 animate-in fade-in duration-150 font-mono">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <span>Teacher Substitution Assignment</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-sans">
                  Assign an available substitute teacher to conduct <strong>{session.subjectCode}</strong> ({session.timeSlot}) in place of <strong>{session.teacher}</strong>.
                </p>
              </div>

              {subError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{subError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Original Subject Teacher
                  </label>
                  <Input
                    type="text"
                    disabled
                    value={session.teacher}
                    className="bg-zinc-100 dark:bg-zinc-800 text-xs opacity-80"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Effective Date
                  </label>
                  <Input
                    type="date"
                    value={subDate}
                    onChange={(e) => setSubDate(e.target.value)}
                    className="text-xs bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Select Substitute Subject Teacher *
                </label>
                <Select
                  value={subTeacherId}
                  onChange={(e) => {
                    setSubTeacherId(e.target.value)
                    setSubError(null)
                  }}
                >
                  {infraFaculty
                    .filter((f) => f.name.toLowerCase() !== session.teacher.toLowerCase())
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.dept || f.role || 'Teacher'})
                      </option>
                    ))}
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Reason for Proxy Assignment
                </label>
                <Input
                  type="text"
                  placeholder="e.g. University practical examiner duty / sick leave"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-900"
                />
              </div>
            </div>
          )}

          {/* G. REPORT INCIDENT / BREAKAGE TAB */}
          {activeTab === 'incident' && session && (
            <div className="space-y-3.5 animate-in fade-in duration-150 font-mono">
              <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-950 dark:text-rose-200">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Report Laboratory Incident or Equipment Breakage</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-300 font-sans">
                  Instantly notifies <strong>Admin</strong>, <strong>Lab In-Charge</strong>, and routes major damages to <strong>Head of Department (HOD)</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Incident Type *
                  </label>
                  <Select
                    value={incType}
                    onChange={(e) => setIncType(e.target.value as any)}
                  >
                    <option value="breakage">Equipment Breakage (Tools/Glassware)</option>
                    <option value="malfunction">Equipment Malfunction (No Power/Faulty)</option>
                    <option value="burnt_apparatus">Burnt Component / Overload</option>
                    <option value="chemical_hazard">Chemical Spill / Hazard</option>
                    <option value="missing">Missing Equipment / Tool</option>
                    <option value="other">Other Operational Incident</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Severity Level *
                  </label>
                  <Select
                    value={incSeverity}
                    onChange={(e) => setIncSeverity(e.target.value as any)}
                  >
                    <option value="minor">Minor (Low Cost / Internal Fix)</option>
                    <option value="moderate">Moderate (Requires Store Replacement)</option>
                    <option value="major_critical">Major / Critical (HOD Attention Required)</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Incident Headline / Title *
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Glassware fracture or device malfunction during experiment"
                  value={incTitle}
                  onChange={(e) => setIncTitle(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-between">
                  <span>What Happened & Damage Circumstances *</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Specify equipment, cause, and safety steps</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={incRemarks}
                  onChange={(e) => setIncRemarks(e.target.value)}
                  placeholder="Describe what equipment broke or malfunctioned, how it occurred, safety steps taken, replacement needed..."
                  className="flex w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Involved Student Roll(s) (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Roll 12, 19 (Class 12C)"
                  value={incRolls}
                  onChange={(e) => setIncRolls(e.target.value)}
                  className="text-xs bg-white dark:bg-zinc-900"
                />
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={
                isSubmitting ||
                (activeTab === 'skip' && (!isOwnSession || Boolean(session?.isSkipped || session?.status === 'skipped')))
              }
              className={`gap-1.5 font-bold text-white shadow-xs ${
                activeTab === 'book'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : activeTab === 'log'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : activeTab === 'skip'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : activeTab === 'merge'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : activeTab === 'substitute'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                'Processing...'
              ) : activeTab === 'book' ? (
                <>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span>{isTeacher ? 'Submit Slot Booking Request' : 'Allocate & Save Schedule'}</span>
                </>
              ) : activeTab === 'log' ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{existingLog ? 'Update Practical Record' : 'Confirm Practical Record'}</span>
                </>
              ) : activeTab === 'skip' ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    {!isOwnSession
                      ? 'Skip Restricted (Other Teacher)'
                      : session?.isSkipped || session?.status === 'skipped'
                      ? 'Already Skipped'
                      : 'Confirm Skip Flag'}
                  </span>
                </>
              ) : activeTab === 'merge' ? (
                isAlreadyMergedOrExtended ? (
                  <>
                    <Split className="h-3.5 w-3.5" />
                    <span>Split Block</span>
                  </>
                ) : (
                  <>
                    <Merge className="h-3.5 w-3.5" />
                    <span>Confirm Merge</span>
                  </>
                )
              ) : activeTab === 'substitute' ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Assign Proxy Teacher</span>
                </>
              ) : activeTab === 'incident' ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Submit Damage Report</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
