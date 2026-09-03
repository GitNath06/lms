'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPracticalLog } from '@/app/actions/logs'
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
  AlertCircle
} from 'lucide-react'
import {
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  MASTER_TIME_SLOTS,
  computeMultiPeriodLabel
} from '@/lib/master-data'

type Lab = Database['public']['Tables']['labs']['Row']
type Teacher = { id: string; full_name: string }

export default function LogForm({ labs, teachers }: { labs: Lab[]; teachers: Teacher[] }) {
  const router = useRouter()

  // 4. Class / Batch & Subject (Initialized to 12C)
  const [selectedClassId, setSelectedClassId] = useState<string>('12c')
  const activeClassObj = DEFAULT_CLASSES.find((c) => c.id === selectedClassId) || DEFAULT_CLASSES[0]

  // Filter subjects strictly for the selected class
  const classSubjects = DEFAULT_SUBJECTS.filter((s) => s.grade === activeClassObj.name)
  const initialSub = classSubjects[0] || DEFAULT_SUBJECTS[0]

  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>(initialSub.code)

  // 1. Facility & In-Charge (Auto-synced to subject's designated teacher & room)
  const [selectedLabId, setSelectedLabId] = useState<string>(initialSub.labId || labs[0]?.id || 'comp')
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(initialSub.teacherId || teachers[0]?.id || 't1')

  // 2. Session Date
  const [sessionDate, setSessionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  // 3. Multi-Period Selection (Default: P1 & P2)
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(['t2', 't3'])

  // 5. Attendance State: Roll Grid by default + Quick Count Mode Available
  const [attendanceMode, setAttendanceMode] = useState<'grid' | 'counter'>('grid')
  const [totalStudents, setTotalStudents] = useState<number>(activeClassObj.strength)
  const [absentRolls, setAbsentRolls] = useState<number[]>([14, 28])
  const [absentCountInput, setAbsentCountInput] = useState<number>(2)

  // 6. Practical Topic & Observations (Auto-synced from subject default)
  const [practicalTitle, setPracticalTitle] = useState<string>(
    initialSub.defaultTopic || 'Verification of Binary Search Tree Operations & Node Insertion'
  )
  const [remarks, setRemarks] = useState<string>(
    'Workstations functioning normally. Apparatus cleaned and restored after practical.'
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setSelectedPeriods([...selectedPeriods, slotId])
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

  // Reactive class change: Filters subjects, auto-selects subject, teacher, lab, and headcount
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
    const cls = DEFAULT_CLASSES.find((c) => c.id === classId)
    if (cls) {
      setTotalStudents(cls.strength)
      setAbsentRolls([])
      setAbsentCountInput(0)

      // Filter subjects for this specific class
      const matchingSubjects = DEFAULT_SUBJECTS.filter((s) => s.grade === cls.name)
      if (matchingSubjects.length > 0) {
        const firstSub = matchingSubjects[0]
        setSelectedSubjectCode(firstSub.code)
        if (firstSub.teacherId) setSelectedTeacherId(firstSub.teacherId)
        if (firstSub.labId) setSelectedLabId(firstSub.labId)
        if (firstSub.defaultTopic) setPracticalTitle(firstSub.defaultTopic)
      }
    }
  }

  // Reactive subject change: Auto-selects corresponding subject teacher and laboratory
  const handleSubjectChange = (code: string) => {
    setSelectedSubjectCode(code)
    const sub = DEFAULT_SUBJECTS.find((s) => s.code === code)
    if (sub) {
      if (sub.teacherId) setSelectedTeacherId(sub.teacherId)
      if (sub.labId) setSelectedLabId(sub.labId)
      if (sub.defaultTopic) setPracticalTitle(sub.defaultTopic)
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

    const chosenSubject = DEFAULT_SUBJECTS.find((s) => s.code === selectedSubjectCode)
    const finalSubjectName = chosenSubject ? chosenSubject.fullName : selectedSubjectCode

    const formData = new FormData()
    formData.set('lab_id', selectedLabId)
    formData.set('teacher_id', selectedTeacherId)
    formData.set('date', sessionDate)
    formData.set('period_label', periodInfo.label)
    formData.set('batch_group', activeClassObj.fullName)
    formData.set('subject_name', finalSubjectName)
    formData.set('practical_title', practicalTitle)
    formData.set('total_students', totalStudents.toString())
    formData.set('present_students', presentStudents.toString())
    formData.set('absent_students', effectiveAbsentCount.toString())
    formData.set('remarks', remarks)

    try {
      const result = await createPracticalLog(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/logs')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred during submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs border border-rose-200 dark:border-rose-900/60 font-mono flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Responsive 2-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Session Context, Periods & Experiment (7 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Session Environment & Class */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4.5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <h3 className="text-xs font-mono font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                  Session Environment & Curriculum
                </h3>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                Active Lab Setup
              </Badge>
            </div>

            {/* Facility & In-Charge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Laboratory Facility *
                </label>
                <Select
                  required
                  value={selectedLabId}
                  onChange={(e) => setSelectedLabId(e.target.value)}
                  className="h-8.5 text-xs"
                >
                  {labs.map((lab) => (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1 font-mono">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Faculty In-Charge *
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    Auto-selected for Subject
                  </span>
                </div>
                <Select
                  required
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="h-8.5 text-xs"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Date & Class / Batch Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  Session Date *
                </label>
                <Input
                  required
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1 font-mono">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-500" />
                  Class / Batch Section *
                </label>
                <Select
                  required
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="h-8.5 text-xs"
                >
                  {DEFAULT_CLASSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.stream} ({c.strength} Students)
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Subject Selector strictly filtered by selected class */}
            <div className="space-y-1 font-mono">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-cyan-500" />
                  Practical Curriculum Subject ({activeClassObj.name}) *
                </label>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                  {classSubjects.length} {classSubjects.length === 1 ? 'Subject' : 'Subjects'} for {activeClassObj.name}
                </span>
              </div>
              <Select
                required
                value={selectedSubjectCode}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="h-8.5 text-xs font-sans"
              >
                {classSubjects.length > 0 ? (
                  classSubjects.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.title} ({s.lab})
                    </option>
                  ))
                ) : (
                  DEFAULT_SUBJECTS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} — {s.title} ({s.lab})
                    </option>
                  ))
                )}
              </Select>
            </div>
          </div>

          {/* Card 2: Ultra-Compact Horizontal Timeline Periods Strip */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-2.5 font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Academic Period Slot(s)
                </span>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-bold">
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
                    className={`py-1.5 px-1 rounded-xl text-xs font-mono font-bold transition-all border flex flex-col items-center justify-center text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs scale-[1.03]'
                        : 'bg-zinc-50 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                    title={`${slot.name} (${slot.label})`}
                  >
                    <span className="text-[11px]">{shortName}</span>
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

            <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-0.5">
              <span>Click chips to merge multiple consecutive periods.</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {selectedPeriods.length} {selectedPeriods.length > 1 ? 'Periods Block' : 'Period'}
              </span>
            </div>
          </div>

          {/* Card 3: Experiment Topic & Faculty Observations */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-3 font-mono">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Practical Experiment / Topic *
              </label>
              <Input
                required
                type="text"
                value={practicalTitle}
                onChange={(e) => setPracticalTitle(e.target.value)}
                placeholder="e.g. Verification of Binary Search Tree Operations"
                className="h-8.5 text-xs font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Faculty Remarks & Observations (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Workstation stability, student progress, hardware condition..."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs font-sans text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Attendance Hub (Roll Grid + Counter) (5 Cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4.5 shadow-xs space-y-4 font-mono">
            {/* Header with Attendance Mode Switcher */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                  Attendance Register
                </h3>
              </div>

              {/* Mode Switcher: Roll Grid (DEFAULT) vs Quick Count */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] border border-zinc-200/80 dark:border-zinc-700/80">
                <button
                  type="button"
                  onClick={() => setAttendanceMode('grid')}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-bold ${
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
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 font-bold ${
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
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-center">
                <span className="text-[10px] text-zinc-400 block uppercase">Enrolled</span>
                <span className="text-base font-extrabold text-zinc-950 dark:text-white">
                  {totalStudents}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase font-bold">
                  Present
                </span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {presentStudents}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-center">
                <span className="text-[10px] text-rose-600 dark:text-rose-400 block uppercase font-bold">
                  Absent
                </span>
                <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {effectiveAbsentCount}
                </span>
              </div>
            </div>

            {/* Turnout Progress Bar (Clamped strictly to 100%) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-zinc-500">Verified Turnout Rate</span>
                <span
                  className={
                    attendancePercentage >= 80
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : attendancePercentage >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {attendancePercentage}% Turnout
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
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[10.5px] text-zinc-500">
                  <span>Click numbers to toggle Absent / Present:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAbsentRolls([])
                      setAbsentCountInput(0)
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>All Present</span>
                  </button>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-[220px] overflow-y-auto p-2 bg-zinc-50/70 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  {Array.from({ length: totalStudents }, (_, i) => i + 1).map((roll) => {
                    const isAbsent = absentRolls.includes(roll)
                    return (
                      <button
                        key={roll}
                        type="button"
                        onClick={() => toggleRollNumber(roll)}
                        className={`h-8 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center border ${
                          isAbsent
                            ? 'bg-rose-500 text-white border-rose-600 shadow-2xs scale-95'
                            : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                        title={isAbsent ? `Roll ${roll}: Absent` : `Roll ${roll}: Present`}
                      >
                        {roll}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[10px] text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" /> Red = Marked Absent
                  </span>
                  <span>{effectiveAbsentCount} marked absent</span>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* VIEW B: QUICK COUNT ENTRY (DIRECT NUMERIC OVERRIDE)     */}
            {/* ======================================================== */}
            {attendanceMode === 'counter' && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span>Total Enrolled Headcount</span>
                      <span className="text-zinc-400 text-[10px]">Synced with {activeClassObj.name}</span>
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
                      className="h-8.5 text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        Absent Students
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max={totalStudents}
                        value={absentCountInput}
                        onChange={(e) => handleAbsentCountChange(parseInt(e.target.value) || 0)}
                        className="h-8.5 text-xs font-mono border-rose-300 dark:border-rose-900 font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Present Count
                      </label>
                      <div className="h-8.5 rounded-lg border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/40 px-3 text-xs font-mono font-bold flex items-center text-emerald-700 dark:text-emerald-300">
                        {presentStudents} Students
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Endorsement Submission Footer Card */}
          <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs flex items-center justify-between gap-3 font-mono">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push('/logs')}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 px-5 shadow-xs text-xs"
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Endorse & Save Log'}</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
