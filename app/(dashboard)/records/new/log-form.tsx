'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPracticalLog } from '@/app/actions/logs'
import { useLogsState } from '@/hooks/use-logs-state'
import { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
  Info
} from 'lucide-react'
import {
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  MASTER_TIME_SLOTS,
  computeMultiPeriodLabel
} from '@/lib/master-data'
import { useInfrastructureState } from '@/hooks/use-infrastructure-state'
import { matchesGrade } from '@/lib/context/institutional-relationships'

type Lab = Database['public']['Tables']['labs']['Row']
type Teacher = { id: string; full_name: string }

export default function LogForm({
  labs,
  teachers,
  scopedOptions,
}: {
  labs: Lab[]
  teachers: Teacher[]
  scopedOptions?: any
}) {
  const router = useRouter()
  const { saveLog } = useLogsState()
  const {
    classes: infraClasses,
    subjects: infraSubjects,
    faculty: infraFaculty,
    labs: infraLabs,
    getHolidayForDate
  } = useInfrastructureState()

  const isTeacher = Boolean(scopedOptions && !scopedOptions.isPrivileged)

  // Live classes pool with fallback
  const rawClasses = useMemo(() => {
    return infraClasses && infraClasses.length > 0 ? infraClasses : DEFAULT_CLASSES
  }, [infraClasses])

  // Compute available classes: if non-privileged teacher, strictly filter to their assigned classes
  const availableClasses = useMemo(() => {
    if (isTeacher && scopedOptions?.assignedClasses?.length > 0) {
      return rawClasses.filter((c: any) =>
        scopedOptions.assignedClasses.some((ac: string) => ac === c.name || matchesGrade(ac, c.name))
      )
    }
    return rawClasses
  }, [isTeacher, scopedOptions, rawClasses])

  // Live subjects pool with fallback
  const rawSubjects = useMemo(() => {
    return infraSubjects && infraSubjects.length > 0 ? infraSubjects : DEFAULT_SUBJECTS
  }, [infraSubjects])

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

  // 4. Class / Batch & Subject (Initialized to teacher's first class)
  const defaultClass = availableClasses[0] || DEFAULT_CLASSES[0]
  const [selectedClassId, setSelectedClassId] = useState<string>(defaultClass.id)
  const activeClassObj = availableClasses.find((c: any) => c.id === selectedClassId) || defaultClass

  // Helper to dynamically filter subjects for a class
  const getSubjectsForClassObj = useCallback(
    (clsName: string) => {
      if (!clsName) return rawSubjects
      const direct = rawSubjects.filter((s: any) => s.grade === clsName)
      if (direct.length > 0) return direct
      const fuzzy = rawSubjects.filter((s: any) => matchesGrade(s.grade, clsName))
      if (fuzzy.length > 0) return fuzzy
      return rawSubjects
    },
    [rawSubjects]
  )

  // Filter subjects strictly for the selected class and teacher
  const classSubjects = useMemo(() => {
    if (isTeacher && scopedOptions?.assignedSubjects?.length > 0) {
      const teacherSubs = scopedOptions.assignedSubjects.filter((s: any) =>
        s.grade === activeClassObj?.name || matchesGrade(s.grade, activeClassObj?.name)
      )
      if (teacherSubs.length > 0) return teacherSubs
    }
    return getSubjectsForClassObj(activeClassObj?.name)
  }, [isTeacher, scopedOptions, activeClassObj, getSubjectsForClassObj])

  const initialSub = classSubjects[0] || rawSubjects[0] || DEFAULT_SUBJECTS[0]

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(initialSub.code)

  // 1. Facility & In-Charge (Auto-synced to subject's designated teacher & room)
  const [selectedLabId, setSelectedLabId] = useState<string>(initialSub.labId || effectiveLabs[0]?.id || 'comp')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    isTeacher
      ? scopedOptions?.teacher?.id || 't1'
      : initialSub.teacherId || effectiveTeachers[0]?.id || 't1'
  )
  const [isDualLab, setIsDualLab] = useState<boolean>(false)
  const [secondaryLabId, setSecondaryLabId] = useState<string>(
    effectiveLabs.find((l) => l.id !== (initialSub.labId || effectiveLabs[0]?.id || 'comp'))?.id || 'phys'
  )

  // 2. Session Date
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const activeHoliday = getHolidayForDate(sessionDate)
  const isHoliday = !!activeHoliday

  // 3. Multi-Period Selection (Default: P1 & P2)
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['t2', 't3'])

  // 5. Attendance State: Roll Grid by default + Quick Count Mode Available
  const [attendanceMode, setAttendanceMode] = useState<'grid' | 'counter'>('grid')
  const [totalStudents, setTotalStudents] = useState<number>(
    'strength' in activeClassObj ? (activeClassObj as any).strength : ('students' in activeClassObj ? (activeClassObj as any).students : 40)
  )
  const [absentRolls, setAbsentRolls] = useState<number[]>([14, 28])
  const [absentCountInput, setAbsentCountInput] = useState<number>(2)

  // 6. Practical Topic & Observations (Auto-synced from subject default)
  const [practicalTitle, setPracticalTitle] = useState<string>(
    initialSub.defaultTopic || 'Verification of Binary Search Tree Operations & Node Insertion'
  )
  const [remarks, setRemarks] = useState<string>(
    'Workstations functioning normally. Equipment cleaned and restored after practical.'
  )

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

  // Multi-period computed label
  const periodInfo = computeMultiPeriodLabel(selectedPeriods)

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

  // Reactive class change: Auto-selects corresponding subjects
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
    const targetClass = availableClasses.find((c: any) => c.id === classId) || rawClasses.find((c: any) => c.id === classId)
    if (targetClass) {
      const cap = (targetClass as any).capacity || (targetClass as any).strength || 36
      setTotalStudents(cap)
      setAbsentCountInput(2)
      setAbsentRolls([14, 28].filter((r) => r <= cap))

      const validSubs = getSubjectsForClassObj(targetClass.name)
      if (validSubs.length > 0) {
        const firstSub = validSubs[0]
        setSelectedSubjectCode(firstSub.code)
        if (!isTeacher && firstSub.teacherId) setSelectedTeacherId(firstSub.teacherId)
        if (firstSub.labId) setSelectedLabId(firstSub.labId)
        if ((firstSub as any).defaultTopic) setPracticalTitle((firstSub as any).defaultTopic)
      }
    }
  }

  // Reactive subject change: Auto-selects corresponding subject teacher and laboratory
  const handleSubjectChange = (code: string) => {
    setSelectedSubjectCode(code)
    const sub =
      (isTeacher && scopedOptions?.assignedSubjects?.length > 0
        ? scopedOptions.assignedSubjects.find((s: any) => s.code === code)
        : null) || rawSubjects.find((s: any) => s.code === code)

    if (sub) {
      if (!isTeacher && sub.teacherId) setSelectedTeacherId(sub.teacherId)
      if (sub.labId) setSelectedLabId(sub.labId)
      if ((sub as any).defaultTopic) setPracticalTitle((sub as any).defaultTopic)
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

    const chosenSubject = rawSubjects.find((s: any) => s.code === selectedSubjectCode) || DEFAULT_SUBJECTS.find((s) => s.code === selectedSubjectCode)
    const finalSubjectName = chosenSubject
      ? (('fullName' in chosenSubject ? (chosenSubject as any).fullName : (chosenSubject as any).title) || selectedSubjectCode)
      : selectedSubjectCode

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
        subject_name: `${selectedSubjectCode} - ${finalSubjectName}`,
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
        subjectTitle: finalSubjectName,
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
                <Input
                  required
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className={`h-10 text-sm font-sans ${
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
                      {c.name} {c.stream ? `— ${c.stream}` : ''} ({c.capacity || c.strength || 36} Students)
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
                  <span>Practical Curriculum Subject ({activeClassObj.name})</span>
                  <span className="text-rose-500 font-normal">*</span>
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold font-sans">
                  {classSubjects.length} {classSubjects.length === 1 ? 'Subject' : 'Subjects'} for {activeClassObj.name}
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
                      {s.code} — {s.title} ({s.lab || s.labName || 'Laboratory'})
                    </option>
                  ))
                ) : (
                  rawSubjects.map((s: any) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.title} ({s.lab || s.labName || 'Laboratory'})
                    </option>
                  ))
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
              {MASTER_TIME_SLOTS.map((slot) => {
                if (slot.id === 't6') return null // Skip break
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
                placeholder="e.g. Verification of Binary Search Tree Operations"
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
                placeholder="Workstation stability, student progress, hardware condition..."
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

          {/* Quick Endorsement Submission Footer Card */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs flex items-center justify-between gap-3 font-sans">
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
              className="h-10 px-4 text-xs font-semibold font-sans"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isHoliday}
              className={`font-semibold gap-1.5 px-6 shadow-xs text-xs h-10 font-sans ${
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
                  : 'Save & Submit Log'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
