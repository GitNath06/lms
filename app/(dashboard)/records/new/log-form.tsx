'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPracticalLog } from '@/app/actions/logs'
import { getStudentsByClass } from '@/app/actions/students'
import type { StudentWithEnrollment } from '@/lib/types/students'
import { useLogsState } from '@/hooks/use-logs-state'
import { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { NepaliDatePicker } from '@/components/ui/nepali-date-picker'
import {
  FileCheck,
  Users,
  Sparkles,
  BookOpen,
  Clock,
  Building2,
  Grid3X3,
  Hash,
  RotateCcw,
  Calendar,
  AlertCircle,
  Info,
  X,
  Loader2,
} from 'lucide-react'
import {
  computeMultiPeriodLabel,
  cleanSubjectTitle,
  formatSubjectHeading,
  formatClassBatchLabel,
  matchesGrade,
} from '@/lib/master-data'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { useUserScope } from '@/hooks/use-user-scope'

type Lab = Database['public']['Tables']['labs']['Row']
type Teacher = { id: string; full_name: string }

export default function LogForm({
  labs = [],
  teachers = [],
  scopedOptions: rawScopedOptions,
  initialClasses = [],
}: {
  labs?: Lab[]
  teachers?: Teacher[]
  scopedOptions?: any
  initialClasses?: any[]
} = {}) {
  const router = useRouter()
  const { saveLog } = useLogsState()
  const { scope: clientScope } = useUserScope()
  const scopedOptions = rawScopedOptions || (clientScope ? {
    scope: clientScope,
    isPrivileged: clientScope.isPrivileged,
    isTeacher: clientScope.isTeacher,
    assignedClasses: clientScope.assignedClasses,
    assignedSubjects: clientScope.assignedSubjects,
    assignedLabIds: clientScope.assignedLabIds,
    teacher: {
      id: clientScope.userId || clientScope.teacherProfile?.teacherId || '',
      name: clientScope.fullName || clientScope.teacherProfile?.name || 'Assigned Subject Teacher',
      email: clientScope.email,
    },
  } : undefined)
  const {
    isLoading: isInfraLoading,
    classes: infraClasses,
    subjects: infraSubjects,
    faculty: infraFaculty,
    labs: infraLabs,
    periods: infraPeriods,
    getHolidayForDate
  } = useInfrastructureState()

  const isTeacher = Boolean(scopedOptions && !scopedOptions.isPrivileged)

  // Live classes pool: prioritize server-provided initialClasses, then live infraClasses
  const rawClasses = useMemo(() => {
    if (initialClasses && initialClasses.length > 0) return initialClasses
    if (infraClasses && infraClasses.length > 0) return infraClasses
    if (isTeacher && scopedOptions?.assignedClasses && scopedOptions.assignedClasses.length > 0) {
      return scopedOptions.assignedClasses.map((clsName: string) => ({
        id: clsName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: clsName,
        section: 'A',
        capacity: 40,
        stream: clsName.includes('11') || clsName.includes('12') ? 'Science' : 'General',
        is_active: true,
      }))
    }
    return []
  }, [initialClasses, infraClasses, isTeacher, scopedOptions])

  // Compute available classes: if non-privileged teacher, strictly filter to their assigned classes
  const availableClasses = useMemo(() => {
    if (isTeacher && scopedOptions?.assignedClasses?.length > 0) {
      return rawClasses.filter((c: any) =>
        scopedOptions.assignedClasses.some((ac: string) => ac === c.name || matchesGrade(ac, c.name))
      )
    }
    return rawClasses
  }, [isTeacher, scopedOptions, rawClasses])

  // Live subjects pool: live infraSubjects from PostgreSQL without hardcoded fallbacks
  const rawSubjects = useMemo(() => {
    if (infraSubjects && infraSubjects.length > 0) return infraSubjects
    if (isTeacher && scopedOptions?.assignedSubjects && scopedOptions.assignedSubjects.length > 0) {
      return scopedOptions.assignedSubjects
    }
    return []
  }, [infraSubjects, isTeacher, scopedOptions])

  // Merged effective labs (server labs + live infra labs)
  const effectiveLabs = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    labs.forEach((l) => map.set(l.id, { id: l.id, name: l.name }))
    if (infraLabs) {
      infraLabs.forEach((l) => map.set(l.id, { id: l.id, name: l.name }))
    }
    return Array.from(map.values())
  }, [labs, infraLabs])

  // Merged effective teachers (server teachers + live infra faculty)
  const effectiveTeachers = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string }>()
    teachers.forEach((t) => map.set(t.id, { id: t.id, full_name: t.full_name }))
    if (infraFaculty) {
      infraFaculty.forEach((f) => map.set(f.id, { id: f.id, full_name: f.name }))
    }
    return Array.from(map.values())
  }, [teachers, infraFaculty])

  const defaultClass = availableClasses[0] || { id: '', name: 'Select Class', capacity: 40 }
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClass.id)
  const activeClassObj = availableClasses.find((c: any) => c.id === selectedClassId) || defaultClass

  // Auto-sync selected class if current selection is invalid or when availableClasses loads
  useEffect(() => {
    if (availableClasses.length > 0) {
      const exists = availableClasses.some((c: any) => c.id === selectedClassId)
      if (!exists) {
        setSelectedClassId(availableClasses[0].id)
      }
    }
  }, [availableClasses, selectedClassId])

  const [classStudents, setClassStudents] = useState<StudentWithEnrollment[]>([])

  useEffect(() => {
    let isMounted = true
    getStudentsByClass({ classId: selectedClassId }).then((res) => {
      if (isMounted && res.success && res.data) {
        setClassStudents(res.data)
        if (res.data.length > 0) {
          setTotalStudents(res.data.length)
        }
      }
    })
    return () => {
      isMounted = false
    }
  }, [selectedClassId])

  // Helper to dynamically filter subjects for a class
  const getSubjectsForClassObj = useCallback(
    (clsName: string, clsId?: string) => {
      if (!clsName && !clsId) return []
      const direct = rawSubjects.filter((s: any) =>
        (clsId && s.classId === clsId) ||
        (clsName && s.grade === clsName) ||
        (clsName && matchesGrade(s.grade, clsName))
      )
      return direct
    },
    [rawSubjects]
  )

  // Filter subjects strictly for the selected class and teacher
  const classSubjects = useMemo(() => {
    if (isTeacher && scopedOptions?.assignedSubjects?.length > 0) {
      const teacherSubs = scopedOptions.assignedSubjects.filter((s: any) =>
        (activeClassObj?.id && s.classId === activeClassObj.id) ||
        s.grade === activeClassObj?.name ||
        matchesGrade(s.grade, activeClassObj?.name)
      )
      if (teacherSubs.length > 0) return teacherSubs
    }
    return getSubjectsForClassObj(activeClassObj?.name, activeClassObj?.id)
  }, [isTeacher, scopedOptions, activeClassObj, getSubjectsForClassObj])

  const initialSub = classSubjects[0] || { code: '', title: '', labId: 'comp' }

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(initialSub.code)

  // Auto-sync selected subject when class changes or when subjects load
  useEffect(() => {
    if (classSubjects.length > 0) {
      const exists = classSubjects.some((s: any) => s.code === selectedSubjectCode)
      if (!exists) {
        setSelectedSubjectCode(classSubjects[0].code)
        if (classSubjects[0].labId) setSelectedLabId(classSubjects[0].labId)
      }
    }
  }, [classSubjects, selectedSubjectCode])

  // 1. Facility & In-Charge (Auto-synced to subject's designated teacher & room)
  const [selectedLabId, setSelectedLabId] = useState<string>(initialSub.labId || effectiveLabs[0]?.id || 'comp')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    isTeacher
      ? scopedOptions?.teacher?.id || effectiveTeachers[0]?.id || ''
      : initialSub.teacherId || effectiveTeachers[0]?.id || ''
  )
  const [isDualLab, setIsDualLab] = useState<boolean>(false)
  const [secondaryLabId, setSecondaryLabId] = useState<string>(
    effectiveLabs.find((l) => l.id !== (initialSub.labId || effectiveLabs[0]?.id || 'comp'))?.id || effectiveLabs[1]?.id || effectiveLabs[0]?.id || 'comp'
  )

  // 2. Session Date
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const activeHoliday = getHolidayForDate(sessionDate)
  const isHoliday = !!activeHoliday

  // 3. Academic Period Selection (Default: Single period, e.g. first available)
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['t1'])

  useEffect(() => {
    if (infraPeriods && infraPeriods.length > 0) {
      const nonBreak = infraPeriods.find(
        (p) => !p.id.toLowerCase().includes('break') && !p.name?.toLowerCase().includes('break')
      )
      if (nonBreak && selectedPeriods.length === 1 && selectedPeriods[0] === 't1' && !infraPeriods.some((p) => p.id === 't1')) {
        setSelectedPeriods([nonBreak.id])
      }
    }
  }, [infraPeriods, selectedPeriods])

  // 5. Attendance State: Roll Grid by default (all students present by default)
  const [attendanceMode, setAttendanceMode] = useState<'grid' | 'counter'>('grid')
  const [totalStudents, setTotalStudents] = useState<number>(
    'strength' in activeClassObj ? (activeClassObj as any).strength : ('students' in activeClassObj ? (activeClassObj as any).students : 40)
  )
  const [absentRolls, setAbsentRolls] = useState<number[]>([])
  const [absentCountInput, setAbsentCountInput] = useState<number>(0)

  const markedAbsentStudents = useMemo(() => {
    return absentRolls.map((roll) => {
      const student = classStudents.find((s) => s.roll_number === roll)
      return {
        roll,
        name: student ? student.full_name : `Roll ${roll}`,
        photo_url: student?.photo_url || null,
      }
    })
  }, [absentRolls, classStudents])

  // 6. Practical Topic & Observations (Starts clean for instructor input)
  const [practicalTitle, setPracticalTitle] = useState<string>('')
  const [remarks, setRemarks] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  // Turnout calculation & strict clamping (0% to 100% max)
  const effectiveAbsentCount =
    attendanceMode === 'grid'
      ? absentRolls.length
      : Math.min(totalStudents, Math.max(0, absentCountInput))
  const presentStudents = Math.min(totalStudents, Math.max(0, totalStudents - effectiveAbsentCount))
  const attendancePercentage =
    totalStudents > 0
      ? Math.min(100, Math.max(0, Math.round((presentStudents / totalStudents) * 100)))
      : 0

  // Multi-period computed label (uses live infraPeriods for accurate timing calculation)
  const periodInfo = useMemo(() => {
    return computeMultiPeriodLabel(selectedPeriods, infraPeriods)
  }, [selectedPeriods, infraPeriods])

  const togglePeriod = (slotId: string) => {
    if (selectedPeriods.includes(slotId)) {
      if (selectedPeriods.length === 1) return // keep at least 1
      setSelectedPeriods(selectedPeriods.filter((p) => p !== slotId))
    } else {
      setSelectedPeriods([...selectedPeriods, slotId].sort())
    }
  }

  const toggleRollNumber = (roll: number) => {
    let nextAbsent: number[]
    if (absentRolls.includes(roll)) {
      nextAbsent = absentRolls.filter((r) => r !== roll)
    } else {
      nextAbsent = [...absentRolls, roll]
    }
    setAbsentRolls(nextAbsent)
    setAbsentCountInput(nextAbsent.length)
  }

  // Reactive class change: Auto-selects corresponding subjects without overriding practical topic or absentees
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
    const targetClass = availableClasses.find((c: any) => c.id === classId) || rawClasses.find((c: any) => c.id === classId)
    if (targetClass) {
      const cap = (targetClass as any).capacity || (targetClass as any).strength || 36
      setTotalStudents(cap)
      setAbsentCountInput(0)
      setAbsentRolls([])

      const validSubs = getSubjectsForClassObj(targetClass.name)
      if (validSubs.length > 0) {
        const firstSub = validSubs[0]
        setSelectedSubjectCode(firstSub.code)
        if (!isTeacher && firstSub.teacherId) setSelectedTeacherId(firstSub.teacherId)
        if (firstSub.labId) setSelectedLabId(firstSub.labId)
      }
    }
  }

  // Reactive subject change: Auto-selects corresponding subject teacher and laboratory
  const handleSubjectChange = (code: string) => {
    setSelectedSubjectCode(code)
    const sub =
      (isTeacher && scopedOptions?.assignedSubjects?.length > 0
        ? scopedOptions.assignedSubjects.find((s: any) => s.code === code)
        : null) || classSubjects.find((s: any) => s.code === code) || rawSubjects.find((s: any) => s.code === code && (s.classId === selectedClassId || s.grade === activeClassObj?.name)) || rawSubjects.find((s: any) => s.code === code)

    if (sub) {
      if (!isTeacher && sub.teacherId) setSelectedTeacherId(sub.teacherId)
      if (sub.labId) setSelectedLabId(sub.labId)
    }
  }

  const handleAbsentCountChange = (val: number) => {
    const clamped = Math.min(totalStudents, Math.max(0, val))
    setAbsentCountInput(clamped)
    // Synchronize roll grid with first N absentees
    setAbsentRolls(Array.from({ length: clamped }, (_, i) => totalStudents - i))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setDuplicateId(null)

    if (isHoliday && activeHoliday) {
      setError(`Session logging is suspended: ${sessionDate} is marked as an institutional holiday (${activeHoliday.name}).`)
      setIsSubmitting(false)
      return
    }

    const chosenSubject = classSubjects.find((s: any) => s.code === selectedSubjectCode) || rawSubjects.find((s: any) => s.code === selectedSubjectCode && (s.classId === selectedClassId || s.grade === activeClassObj?.name)) || rawSubjects.find((s: any) => s.code === selectedSubjectCode)
    const rawSubjectTitle = chosenSubject
      ? (chosenSubject.title || chosenSubject.name || chosenSubject.fullName || selectedSubjectCode)
      : selectedSubjectCode
    const cleanSubjectTitleOnly = cleanSubjectTitle(selectedSubjectCode, rawSubjectTitle)
    const finalFormattedSubject = formatSubjectHeading(selectedSubjectCode, cleanSubjectTitleOnly)

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

    const teacherObj = effectiveTeachers.find((t) => t.id === selectedTeacherId)
    const teacherName = isTeacher
      ? (scopedOptions?.teacher?.name || teacherObj?.full_name || 'Assigned Subject Teacher')
      : (teacherObj ? teacherObj.full_name : 'Assigned Subject Teacher')
    const labObj = effectiveLabs.find((l) => l.id === selectedLabId)
    const secondaryLabObj = isDualLab ? effectiveLabs.find((l) => l.id === secondaryLabId) : null
    const finalLabName = isDualLab && secondaryLabObj
      ? `${labObj ? labObj.name : selectedLabId} + ${secondaryLabObj.name}`
      : (labObj ? labObj.name : 'Laboratory')
    const finalRemarks = isDualLab && secondaryLabObj
      ? (remarks ? `${remarks} • Dual-facility session in ${labObj?.name} and ${secondaryLabObj.name}.` : `Dual-facility practical in ${labObj?.name} and ${secondaryLabObj.name}.`)
      : remarks

    try {
      const res = await createPracticalLog({
        lab_id: selectedLabId,
        teacher_id: selectedTeacherId,
        teacher: teacherName,
        date: sessionDate,
        period_label: periodInfo.label,
        subject_name: finalFormattedSubject,
        batch_group: activeClassObj.name,
        practical_title: practicalTitle,
        total_students: safeTotal,
        present_students: safePresent,
        absent_students: safeAbsent,
        absent_rolls: sanitizedRolls,
        remarks: finalRemarks,
        status: 'conducted',
        topic_learned: practicalTitle,
      })

      if (!res.success) {
        setError(res.error || 'Failed to record practical session.')
        if (res.duplicateId) setDuplicateId(res.duplicateId)
        setIsSubmitting(false)
        return
      }

      await saveLog({
        id: res.log?.id,
        sessionId: `adhoc-${Date.now()}`,
        date: sessionDate,
        dayKey: 'sun',
        slotId: selectedPeriods[0] || 't2',
        timeSlot: periodInfo.label,
        subjectCode: selectedSubjectCode,
        subjectTitle: cleanSubjectTitleOnly,
        grade: activeClassObj.name,
        teacher: teacherObj ? teacherObj.full_name : 'Assigned Subject Teacher',
        lab: finalLabName,
        labId: selectedLabId,
        isDualLab: isDualLab,
        secondaryLab: isDualLab && secondaryLabObj ? secondaryLabObj.name : undefined,
        secondaryLabId: isDualLab && secondaryLabObj ? secondaryLabObj.id : undefined,
        status: 'conducted',
        topicLearned: practicalTitle,
        totalStudents: safeTotal,
        presentStudents: safePresent,
        absentStudents: safeAbsent,
        absentRolls: sanitizedRolls,
        remarks: finalRemarks,
      })

      router.push('/records')
      router.refresh()
    } catch (err: any) {
      console.warn('Practical log submit error:', err)
      setError(err.message || 'An error occurred while saving the practical log.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isInfraLoading && availableClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 glass-card rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <p className="text-sm font-sans text-zinc-500 dark:text-zinc-400">Loading curriculum infrastructure...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3.5 rounded-xl text-xs border border-rose-200 dark:border-rose-900/60 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          {duplicateId && (
            <a
              href={`/records?search=${encodeURIComponent(activeClassObj.name)}`}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] shrink-0 inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Open in Records ➔</span>
            </a>
          )}
        </div>
      )}

      {/* Main Responsive 2-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Session Context, Periods & Experiment (7 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Session Environment & Class */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4.5 shadow-xs space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <h3 className="text-xs font-semibold text-zinc-950 dark:text-white uppercase tracking-wider font-sans">
                  Session Environment & Curriculum
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium font-sans">
                Active Lab Setup
              </Badge>
            </div>

            {/* Facility & In-Charge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <span>Laboratory Facility</span>
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <Select
                  required
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="h-10 text-sm font-medium font-sans"
                >
                  {effectiveLabs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5 font-sans">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                    <span>Subject Teacher</span>
                    <span className="text-rose-500 font-normal">*</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-sans">
                    {isTeacher ? 'Authenticated Identity' : 'Auto-selected for Subject'}
                  </span>
                </div>
                {isTeacher ? (
                  <div className="h-10 px-3.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-sans text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span className="font-semibold truncate">{scopedOptions?.teacher?.name || 'Assigned Faculty'}</span>
                    <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                      Current User
                    </Badge>
                  </div>
                ) : (
                  <Select
                    required
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="h-10 text-sm font-medium font-sans"
                  >
                    {effectiveTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            {/* Multi-Lab Facility Practical Section */}
            <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-50/70 dark:bg-zinc-900/50 p-3.5 space-y-3 font-sans">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="log-dual-lab-toggle"
                  className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Multi-Lab Facility Practical</span>
                  <span
                    title="Single class conducting a practical session across two or more laboratories simultaneously (e.g. Class 9 FCA utilizing both Computer Lab & Physics Lab)."
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-help"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </label>
                <input
                  id="log-dual-lab-toggle"
                  type="checkbox"
                  checked={isDualLab}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setIsDualLab(checked)
                    if (checked && secondaryLabId === selectedLabId) {
                      const alt = effectiveLabs.find((l) => l.id !== selectedLabId)
                      if (alt) setSecondaryLabId(alt.id)
                    }
                  }}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              {isDualLab && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-in fade-in duration-150">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>Secondary Laboratory</span>
                      <span className="text-rose-500 font-normal">*</span>
                    </label>
                    <Select
                      value={secondaryLabId}
                      onChange={(e) => setSecondaryLabId(e.target.value)}
                      className="h-10 text-sm font-medium font-sans"
                    >
                      {effectiveLabs.map((lab) => (
                        <option
                          key={lab.id}
                          value={lab.id}
                          disabled={lab.id === selectedLabId}
                        >
                          {lab.name} {lab.id === selectedLabId ? '(Primary Lab)' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center text-xs text-zinc-600 dark:text-zinc-400 font-sans p-2.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 self-end">
                    Both facilities will be certified under this practical log.
                  </div>
                </div>
              )}
            </div>

            {/* Date & Class / Batch Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>Session Date</span>
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <NepaliDatePicker
                  value={sessionDate}
                  onChange={(d) => setSessionDate(d || new Date().toISOString().split('T')[0])}
                  placeholder="मिति छान्नुहोस् / Select Nepali Date"
                  inputClassName={`h-10 text-sm font-sans ${
                    isHoliday
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 font-bold'
                      : ''
                  }`}
                />
                {isHoliday && activeHoliday && (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-1.5 font-sans">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-semibold">{activeHoliday.name} (Holiday Recess)</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Class / Batch Section</span>
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <Select
                  required
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="h-10 text-sm font-medium font-sans"
                >
                  {availableClasses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {formatClassBatchLabel(c)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Subject Selector strictly filtered by selected class */}
            <div className="space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Practical Curriculum Subject ({formatClassBatchLabel(activeClassObj) || activeClassObj.name})</span>
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold font-sans">
                  {classSubjects.length} {classSubjects.length === 1 ? 'Subject' : 'Subjects'} for {formatClassBatchLabel(activeClassObj) || activeClassObj.name}
                </span>
              </div>
              <Select
                required
                value={selectedSubjectCode}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="h-10 text-sm font-medium font-sans"
              >
                {classSubjects.length > 0 ? (
                  classSubjects.map((s: any) => (
                    <option key={s.code} value={s.code}>
                      {formatSubjectHeading(s.code, s.title || s.name || s.fullName)} ({s.lab || s.labName || 'Laboratory'})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No subjects mapped for this class in active curriculum
                  </option>
                )}
              </Select>
            </div>
          </div>

          {/* Card 2: Ultra-Compact Horizontal Timeline Periods Strip */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-2.5 font-sans">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-sans">
                  Academic Period Slot(s)
                </span>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold font-sans">
                {periodInfo.timeRange}
              </span>
            </div>

            {/* Sleek Horizontal Period Chips Bar */}
            <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5 pt-1">
              {((infraPeriods && infraPeriods.length > 0) ? infraPeriods : []).map((slot) => {
                const isBreak = slot.id === 'break' || slot.id?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('break') || slot.name?.toLowerCase().includes('recess')
                if (isBreak) return null // Skip break
                const isSelected = selectedPeriods.includes(slot.id)
                // Short name like "P1", "P2"
                const shortName = slot.name.replace('Period ', 'P').replace('Pre-Period', 'Pre')
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => togglePeriod(slot.id)}
                    className={`py-1.5 px-1 rounded-xl text-xs font-semibold font-sans transition-all border flex flex-col items-center justify-center text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs scale-[1.03]'
                        : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                    title={`${slot.name} (${slot.label})`}
                  >
                    <span className="text-[11px] font-bold">{shortName}</span>
                    <span
                      className={`text-[8.5px] truncate w-full ${
                        isSelected ? 'text-indigo-100' : 'text-zinc-400'
                      }`}
                    >
                      {slot.label.split(' - ')[0]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="text-[10px] text-zinc-400 font-sans flex items-center justify-between pt-0.5">
              <span>Click chips to merge multiple consecutive periods.</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {selectedPeriods.length} {selectedPeriods.length > 1 ? 'Periods Block' : 'Period'}
              </span>
            </div>
          </div>

          {/* Card 3: Experiment Topic & Teacher Observations */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4.5 shadow-xs space-y-4 font-sans">
            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span>Practical Experiment / Topic</span>
                <span className="text-rose-500 font-normal">*</span>
              </label>
              <Input
                required
                type="text"
                value={practicalTitle}
                onChange={(e) => setPracticalTitle(e.target.value)}
                placeholder="e.g. Verification of Ohm's Law / Binary Search Trees / Titration"
                className="h-10 text-sm font-medium font-sans"
              />
            </div>

            <div className="space-y-1.5 font-sans">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Teacher Remarks & Observations (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional session observations, equipment condition, or notes..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-sm font-sans text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Attendance Hub (Roll Grid + Counter) (5 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4.5 shadow-xs space-y-4 font-sans">
            {/* Header with Attendance Mode Switcher */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider font-sans">
                  Attendance Register
                </h3>
              </div>

              {/* Mode Switcher: Roll Grid (DEFAULT) vs Quick Count */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] border border-zinc-200/80 dark:border-zinc-700/80 font-sans">
                <button
                  type="button"
                  onClick={() => setAttendanceMode('grid')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-semibold ${
                    attendanceMode === 'grid'
                      ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Grid3X3 className="h-3 w-3" />
                  <span>Roll Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceMode('counter')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-semibold ${
                    attendanceMode === 'counter'
                      ? 'bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Hash className="h-3 w-3" />
                  <span>Quick Count</span>
                </button>
              </div>
            </div>

            {/* Live Turnout KPIs: Total, Present, Absent, Turnout % */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-center font-sans">
                <span className="text-[10px] text-zinc-400 block uppercase font-semibold">Enrolled</span>
                <span className="text-lg font-extrabold text-zinc-950 dark:text-white tabular-nums font-heading">
                  {totalStudents}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center font-sans">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-semibold">
                  Present
                </span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums font-heading">
                  {presentStudents}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-center font-sans">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 block uppercase font-semibold">
                  Absent
                </span>
                <span className="text-lg font-extrabold text-rose-600 dark:text-rose-400 tabular-nums font-heading">
                  {effectiveAbsentCount}
                </span>
              </div>
            </div>

            {/* Attendance Progress Bar (Clamped strictly to 100%) */}
            <div className="space-y-1 font-sans">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-zinc-600 dark:text-zinc-400">Student Attendance Rate</span>
                <span
                  className={
                    attendancePercentage >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : attendancePercentage >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {attendancePercentage}% Attendance
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    attendancePercentage >= 80
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : attendancePercentage >= 50
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-rose-500 to-red-600'
                  }`}
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
            </div>

            {/* ======================================================== */}
            {/* VIEW A: INTERACTIVE ROLL GRID (DEFAULT BY SPECIFICATION)  */}
            {/* ======================================================== */}
            {attendanceMode === 'grid' && (
              <div className="space-y-2 pt-1 font-sans">
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Tap rolls to toggle Absent / Present:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAbsentRolls([])
                      setAbsentCountInput(0)
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>All Present</span>
                  </button>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[260px] overflow-y-auto p-2.5 bg-zinc-50/70 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  {Array.from({ length: totalStudents }, (_, i) => i + 1).map((roll) => {
                    const isAbsent = absentRolls.includes(roll)
                    return (
                      <button
                        key={roll}
                        type="button"
                        onClick={() => toggleRollNumber(roll)}
                        className={`h-10 rounded-xl text-sm font-sans font-bold transition-all flex items-center justify-center border ${
                          isAbsent
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs scale-95'
                            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        title={isAbsent ? `Roll ${roll}: Absent` : `Roll ${roll}: Present`}
                      >
                        {roll}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Red = Marked Absent
                  </span>
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">{effectiveAbsentCount} marked absent</span>
                </div>

                {/* Marked Absent Students Visual Face Tray */}
                {markedAbsentStudents.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      <span>Marked Absent Students ({markedAbsentStudents.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto p-2 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/40">
                      {markedAbsentStudents.map((st) => (
                        <div
                          key={st.roll}
                          className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 pl-1 pr-2 py-1 rounded-lg text-xs shadow-2xs group"
                        >
                          <div className="h-6 w-6 rounded-full overflow-hidden border border-rose-400/30 bg-zinc-800 flex items-center justify-center shrink-0">
                            {st.photo_url ? (
                              <img src={st.photo_url} alt={st.name} loading="lazy" width={24} height={24} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[9px] font-bold text-rose-400 font-heading">
                                {st.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="font-mono text-[9px] font-extrabold text-rose-600 dark:text-rose-400 leading-tight">
                              R-{st.roll}
                            </span>
                            <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[85px] leading-tight">
                              {st.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleRollNumber(st.roll)}
                            className="ml-1 p-0.5 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
                            title="Restore student to present"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* VIEW B: QUICK COUNT ENTRY (DIRECT NUMERIC OVERRIDE)     */}
            {/* ======================================================== */}
            {attendanceMode === 'counter' && (
              <div className="space-y-3 pt-1 font-sans">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                  <div className="space-y-1.5 font-sans">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Total Enrolled Headcount</span>
                      <span className="text-zinc-400 text-[10px] font-normal">Synced with {activeClassObj.name}</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={totalStudents}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1)
                        setTotalStudents(val)
                        if (absentCountInput > val) setAbsentCountInput(val)
                      }}
                      className="h-10 text-sm font-medium font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 font-sans">
                      <label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        Absent Students
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={totalStudents}
                        value={absentCountInput}
                        onChange={(e) => handleAbsentCountChange(parseInt(e.target.value) || 0)}
                        className="h-10 text-sm font-sans border-rose-300 dark:border-rose-900 font-bold"
                      />
                    </div>

                    <div className="space-y-1.5 font-sans">
                      <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Present Count
                      </label>
                      <div className="h-10 rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/40 px-3.5 text-sm font-sans font-bold flex items-center text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {presentStudents} Students
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom Action Bar on Mobile */}
          <div className="sticky bottom-0 z-30 bg-white/95 dark:bg-[#101726]/95 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] p-3 sm:p-4 shadow-lg sm:shadow-xs flex items-center justify-between gap-3 font-sans">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 2) {
                  router.back()
                } else {
                  router.push('/records')
                }
              }}
              disabled={isSubmitting}
              className="h-11 min-h-[44px] px-4 text-xs font-semibold font-sans"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isHoliday}
              className={`font-semibold gap-1.5 px-6 shadow-xs text-xs sm:text-sm h-11 min-h-[44px] font-sans ${
                isHoliday
                  ? 'bg-zinc-400 dark:bg-zinc-700 text-zinc-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>
                {isHoliday
                  ? 'Logging Suspended (Holiday)'
                  : isSubmitting
                  ? 'Recording...'
                  : 'Save & Submit Practical Log'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
