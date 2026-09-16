'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar,
  Clock,
  Building2,
  Users,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RotateCcw,
  Ban,
  Split,
  Layers,
  Sparkles,
  Terminal,
  Atom,
  FlaskRound,
  GraduationCap,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListFilter,
  CalendarDays,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import {
  DAYS,
  MASTER_TIME_SLOTS,
  LAB_ROOMS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  MasterRoutineItem,
  DayKey,
  DayName,
  computeCombinedTimeRange,
  formatGradeBadge,
} from '@/lib/master-data'
import { matchesGrade } from '@/lib/context/institutional-relationships'
import { useRoutineState } from '@/hooks/use-routine-state'
import {
  useInfrastructureState,
  LabFacilityItem,
  ClassEnrollmentItem,
  FacultyMemberItem,
  SubjectCurriculumItem,
} from '@/hooks/use-infrastructure-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RoutineManagerProps {
  isEditModeUnlocked: boolean
}

type ViewMode = 'by_day' | 'by_lab' | 'flat'

/**
 * Dynamically computes elapsed duration from a session's timeSlot string.
 * Example: "10:10 - 11:00" -> 50m; "11:45 - 12:30" -> 45m; "02:30 - 04:05" -> 1h 35m
 * Handles non-uniform school timetable periods dynamically.
 */
function getDynamicDuration(timeSlot: string, span: number = 1): { text: string; minutes: number } {
  if (!timeSlot || !timeSlot.includes('-')) {
    return { text: `${span} Period${span > 1 ? 's' : ''}`, minutes: span * 45 }
  }
  try {
    const [startRaw, endRaw] = timeSlot.split('-').map((s) => s.trim())
    const parseMinutes = (timeStr: string) => {
      const parts = timeStr.split(':')
      let h = parseInt(parts[0], 10)
      const m = parseInt(parts[1], 10) || 0
      // In routine timetable context, afternoon hours 1..5 are PM (13..17)
      if (h >= 1 && h <= 6) h += 12
      return h * 60 + m
    }
    const startMin = parseMinutes(startRaw)
    const endMin = parseMinutes(endRaw)
    const diff = endMin - startMin
    if (diff > 0 && diff < 720) {
      const hours = Math.floor(diff / 60)
      const mins = diff % 60
      const durStr = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`
      return {
        text: span > 1 ? `Double (${durStr})` : `Single (${durStr})`,
        minutes: diff,
      }
    }
  } catch (e) {}
  return { text: `${span} Period${span > 1 ? 's' : ''}`, minutes: span * 45 }
}

export default function RoutineManager({ isEditModeUnlocked }: RoutineManagerProps) {
  const {
    routines,
    isLoaded,
    addSession,
    updateSession,
    deleteSession,
    extendSession,
    unmergeSession,
    skipSession,
    unskipSession,
    resetToMaster,
  } = useRoutineState()

  const { labs, classes, faculty, subjects, periods } = useInfrastructureState()
  const activeSlots = periods && periods.length > 0 ? periods : MASTER_TIME_SLOTS

  // View Mode: 'by_day' (Default - Groups by day to eliminate repetition), 'by_lab', 'matrix', 'flat'
  const [viewMode, setViewMode] = useState<ViewMode>('by_day')

  // Filter States
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [selectedLab, setSelectedLab] = useState<string>('all')
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Collapsed state for Day / Lab accordions
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<MasterRoutineItem | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)

  // Form States for Add / Edit
  const [formDayKey, setFormDayKey] = useState<DayKey>('sun')
  const [formSlotId, setFormSlotId] = useState<string>('t1')
  const [formSpan, setFormSpan] = useState<number>(1)
  const [formLabKey, setFormLabKey] = useState<'comp' | 'phys' | 'chem' | 'bio' | 'elec'>('comp')
  const [formGrade, setFormGrade] = useState<string>('12C')
  const [formSubjectCode, setFormSubjectCode] = useState<string>('')
  const [formSubjectTitle, setFormSubjectTitle] = useState<string>('')
  const [formTeacher, setFormTeacher] = useState<string>('')
  const [formStudents, setFormStudents] = useState<number>(36)
  const [formError, setFormError] = useState<string | null>(null)

  // Curriculum subjects dynamically filtered for currently selected formGrade
  const curriculumSubjectsForGrade = useMemo(() => {
    const raw = subjects && subjects.length > 0 ? subjects : DEFAULT_SUBJECTS
    const direct = raw.filter((s) => s.grade === formGrade)
    if (direct.length > 0) return direct
    const fuzzy = raw.filter((s) => matchesGrade(s.grade, formGrade))
    if (fuzzy.length > 0) return fuzzy
    return raw
  }, [subjects, formGrade])

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg)
    setTimeout(() => setActionSuccessMsg(null), 3000)
  }

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const toggleAllSections = (expand: boolean) => {
    if (expand) {
      setCollapsedSections({})
    } else {
      const all: Record<string, boolean> = {}
      DAYS.forEach((d) => {
        all[d.id] = true
      })
      LAB_ROOMS.forEach((l) => {
        all[l.id] = true
      })
      setCollapsedSections(all)
    }
  }

  // Open Add Modal
  const handleOpenAddModal = (presetDay?: DayKey, presetSlotId?: string, presetLabKey?: any) => {
    setFormDayKey(presetDay || (selectedDay !== 'all' ? (selectedDay as DayKey) : 'sun'))
    setFormSlotId(presetSlotId || 't1')
    setFormSpan(1)
    const initialGrade = classes[0]?.name || '12 Eng'
    setFormGrade(initialGrade)
    const matchingSubs = subjects.filter((s) => s.grade === initialGrade || matchesGrade(s.grade, initialGrade))
    const firstSubj = matchingSubs[0] || subjects[0]
    setFormSubjectCode(firstSubj?.code || 'COMP-12')
    setFormSubjectTitle(firstSubj?.title || 'Data Structures & Algorithms Lab')
    setFormTeacher(firstSubj?.teacherName || faculty[0]?.name || 'Er. Anish Karki')
    setFormStudents(classes[0]?.capacity || 36)
    setFormError(null)
    setIsAddModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (session: MasterRoutineItem) => {
    setEditingSession(session)
    setFormDayKey(session.dayKey)
    setFormSlotId(session.slotId)
    setFormSpan(session.span || 1)
    setFormLabKey(session.labKey)
    setFormGrade(session.grade)
    setFormSubjectCode(session.subjectCode)
    setFormSubjectTitle(session.subjectTitle)
    setFormTeacher(session.teacher)
    setFormStudents(session.defaultStudents || 36)
    setFormError(null)
  }

  // Check Conflict for Form Slot
  const hasConflict = useMemo(() => {
    const checkId = editingSession?.id
    return routines.some((r) => {
      if (checkId && r.id === checkId) return false
      if (r.dayKey !== formDayKey) return false
      if (r.labKey !== formLabKey) return false

      const rStart = MASTER_TIME_SLOTS.findIndex((s) => s.id === r.slotId)
      const rEnd = rStart + (r.span || 1) - 1
      const fStart = MASTER_TIME_SLOTS.findIndex((s) => s.id === formSlotId)
      const fEnd = fStart + formSpan - 1

      if (rStart === -1 || fStart === -1) return false
      return fStart <= rEnd && fEnd >= rStart
    })
  }, [routines, editingSession, formDayKey, formLabKey, formSlotId, formSpan])

  // Save Add or Edit
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formSubjectCode.trim() || !formSubjectTitle.trim()) {
      setFormError('Subject Code and Title are required.')
      return
    }
    if (!formTeacher.trim()) {
      setFormError('Subject Teacher name is required.')
      return
    }

    const dayObj = DAYS.find((d) => d.id === formDayKey)
    const dayName: DayName = dayObj?.label || 'Sunday'
    const computedTimeSlot = computeCombinedTimeRange(formSlotId, formSpan, activeSlots)

    const labObj = LAB_ROOMS.find((l) => l.id === formLabKey)
    const labName = labObj?.name || 'Computer Lab'

    // Determine category and styling colors
    let category: MasterRoutineItem['category'] = 'Computer'
    let dotColor = '#10b981'
    let accentColor = 'border-emerald-500/30'
    let badgeColor = 'bg-emerald-50 text-emerald-700'

    if (formLabKey === 'phys') {
      category = 'Physics'
      dotColor = '#6366f1'
      accentColor = 'border-indigo-500/30'
      badgeColor = 'bg-indigo-50 text-indigo-700'
    } else if (formLabKey === 'chem') {
      category = 'Chemistry'
      dotColor = '#f59e0b'
      accentColor = 'border-amber-500/30'
      badgeColor = 'bg-amber-50 text-amber-700'
    } else if (formLabKey === 'bio') {
      category = 'Biology'
      dotColor = '#06b6d4'
      accentColor = 'border-cyan-500/30'
      badgeColor = 'bg-cyan-50 text-cyan-700'
    } else if (formLabKey === 'elec') {
      category = 'Electronics'
      dotColor = '#8b5cf6'
      accentColor = 'border-purple-500/30'
      badgeColor = 'bg-purple-50 text-purple-700'
    }

    const gradeKey =
      formGrade.includes('12')
        ? 'class-12'
        : formGrade.includes('11')
        ? 'class-11'
        : formGrade.includes('10')
        ? 'class-10'
        : formGrade.includes('9')
        ? 'class-9'
        : formGrade.includes('8')
        ? 'class-8'
        : formGrade.includes('7')
        ? 'class-7'
        : 'class-6'

    if (editingSession) {
      await updateSession(editingSession.id, {
        day: dayName,
        dayKey: formDayKey,
        timeSlot: computedTimeSlot,
        slotId: formSlotId,
        span: formSpan,
        subjectCode: formSubjectCode.trim(),
        subjectTitle: formSubjectTitle.trim(),
        grade: formGrade.trim(),
        gradeKey: gradeKey as any,
        teacher: formTeacher.trim(),
        lab: labName as any,
        labKey: formLabKey,
        defaultStudents: formStudents,
        category,
        dotColor,
        accentColor,
        badgeColor,
      })
      setEditingSession(null)
      showNotification(`Routine slot "${formSubjectCode}" updated successfully.`)
    } else {
      const newSession: MasterRoutineItem = {
        id: `m-${Date.now()}`,
        day: dayName,
        dayKey: formDayKey,
        timeSlot: computedTimeSlot,
        slotId: formSlotId,
        span: formSpan,
        subjectCode: formSubjectCode.trim(),
        subjectTitle: formSubjectTitle.trim(),
        grade: formGrade.trim(),
        gradeKey: gradeKey as any,
        teacher: formTeacher.trim(),
        lab: labName as any,
        labKey: formLabKey,
        defaultStudents: formStudents,
        category,
        dotColor,
        accentColor,
        badgeColor,
        status: 'confirmed',
      }
      await addSession(newSession)
      setIsAddModalOpen(false)
      showNotification(`New routine slot "${formSubjectCode}" created.`)
    }
  }

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deletingSessionId) return
    await deleteSession(deletingSessionId)
    setDeletingSessionId(null)
    showNotification('Routine session removed.')
  }

  // Cancel / Restore Action
  const handleToggleCancel = async (session: MasterRoutineItem) => {
    if (session.isSkipped || session.status === 'skipped') {
      await unskipSession(session.id)
      showNotification(`Routine session "${session.subjectCode}" restored.`)
    } else {
      await skipSession(session.id, 'Administrative cancellation', 'Administrator')
      showNotification(`Routine session "${session.subjectCode}" cancelled.`)
    }
  }

  // Filtered dataset
  const filteredRoutines = useMemo(() => {
    return routines.filter((r) => {
      if (selectedDay !== 'all' && r.dayKey !== selectedDay) return false
      if (selectedLab !== 'all' && r.labKey !== selectedLab) return false
      if (selectedClass !== 'all' && r.grade !== selectedClass) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchCode = r.subjectCode.toLowerCase().includes(q)
        const matchTitle = r.subjectTitle.toLowerCase().includes(q)
        const matchTeacher = r.teacher.toLowerCase().includes(q)
        const matchGrade = r.grade.toLowerCase().includes(q)
        if (!matchCode && !matchTitle && !matchTeacher && !matchGrade) return false
      }

      return true
    })
  }, [routines, selectedDay, selectedLab, selectedClass, searchQuery])

  // Institutional KPI Metrics
  const stats = useMemo(() => {
    const totalSlots = filteredRoutines.length
    let totalMinutes = 0
    const activeLabsSet = new Set<string>()
    const activeTeachersSet = new Set<string>()

    filteredRoutines.forEach((r) => {
      const dur = getDynamicDuration(r.timeSlot, r.span || 1)
      totalMinutes += dur.minutes
      activeLabsSet.add(r.labKey)
      if (r.teacher) activeTeachersSet.add(r.teacher)
    })

    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    const practicalHrsStr = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`

    return {
      totalSlots,
      practicalHrsStr,
      activeLabsCount: activeLabsSet.size,
      activeTeachersCount: activeTeachersSet.size,
    }
  }, [filteredRoutines])

  // Day counts map
  const dayCounts = useMemo(() => {
    const map: Record<string, number> = {}
    routines.forEach((r) => {
      map[r.dayKey] = (map[r.dayKey] || 0) + 1
    })
    return map
  }, [routines])

  // Lab counts map
  const labCounts = useMemo(() => {
    const map: Record<string, number> = {}
    routines.forEach((r) => {
      map[r.labKey] = (map[r.labKey] || 0) + 1
    })
    return map
  }, [routines])

  // Groups by Day
  const groupedByDay = useMemo(() => {
    const map = new Map<DayKey, MasterRoutineItem[]>()
    const activeDays = DAYS.filter((d) => d.id !== 'sat')

    activeDays.forEach((d) => {
      map.set(d.id, [])
    })

    filteredRoutines.forEach((r) => {
      const list = map.get(r.dayKey) || []
      list.push(r)
      map.set(r.dayKey, list)
    })

    // Sort chronologically within each day
    map.forEach((items, dayKey) => {
      items.sort((a, b) => {
        const aIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === a.slotId)
        const bIdx = MASTER_TIME_SLOTS.findIndex((s) => s.id === b.slotId)
        return aIdx - bIdx
      })
    })

    return activeDays.map((d) => ({
      day: d,
      items: map.get(d.id) || [],
    }))
  }, [filteredRoutines])

  // Groups by Facility
  const groupedByLab = useMemo(() => {
    const map = new Map<string, MasterRoutineItem[]>()
    LAB_ROOMS.forEach((l) => {
      map.set(l.id, [])
    })

    filteredRoutines.forEach((r) => {
      const list = map.get(r.labKey) || []
      list.push(r)
      map.set(r.labKey, list)
    })

    return LAB_ROOMS.map((l) => ({
      lab: l,
      items: map.get(l.id) || [],
    }))
  }, [filteredRoutines])

  // Get Lab Icon & Accent (Neutral Institutional Standard)
  const getLabVisuals = (labKey: string) => {
    const baseVisual = {
      color: 'text-zinc-700 dark:text-zinc-300',
      bg: 'bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80',
      borderL: 'border-l-zinc-400 dark:border-l-zinc-600',
    }

    switch (labKey) {
      case 'comp':
        return {
          icon: <Terminal className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />,
          ...baseVisual,
        }
      case 'phys':
        return {
          icon: <Atom className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />,
          ...baseVisual,
        }
      case 'chem':
        return {
          icon: <FlaskRound className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />,
          ...baseVisual,
        }
      case 'bio':
        return {
          icon: <Building2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />,
          ...baseVisual,
        }
      default:
        return {
          icon: <Building2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />,
          ...baseVisual,
        }
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200 font-sans">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-bold animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* 1. Header Toolbar & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white font-mono uppercase tracking-wide">
                Master Practical Routine Console
              </h3>
              <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                {filteredRoutines.length} Slots
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Structured institutional timetable: segmented by day, laboratory, and timetable matrix.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            onClick={() => handleOpenAddModal()}
            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Practical Slot</span>
          </Button>

          <span
            title={
              !isEditModeUnlocked
                ? 'Unlock edit mode to perform modifications'
                : 'Reset to default institutional timetable'
            }
          >
            <Button
              variant="outline"
              size="sm"
              disabled={!isEditModeUnlocked}
              onClick={() => {
                if (!isEditModeUnlocked) return
                setIsResetConfirmOpen(true)
              }}
              className="h-9 px-3 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-mono text-xs gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Reset Routine</span>
            </Button>
          </span>
        </div>
      </div>

      {/* 2. KPI Summary Ribbon - Neutral Institutional Fact Standards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 font-mono uppercase">Master Slots</div>
            <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white">{stats.totalSlots} Scheduled</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 font-mono uppercase">Weekly Hours</div>
            <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white">{stats.practicalHrsStr}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 font-mono uppercase">Active Facilities</div>
            <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white">{stats.activeLabsCount} Laboratories</div>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 font-mono uppercase">Assigned Teachers</div>
            <div className="text-sm font-bold font-mono text-zinc-950 dark:text-white">{stats.activeTeachersCount} Faculty</div>
          </div>
        </div>
      </div>

      {/* 3. View Mode Switcher + Interactive 1-Click Day Filters */}
      <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-3">
        {/* Top Control Line: Search + View Mode Buttons */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject code, title, teacher, grade..."
              className="pl-8 h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            />
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('by_day')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'by_day'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              <span>By Day</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('by_lab')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'by_lab'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-amber-500" />
              <span>By Facility</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'flat'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5 text-zinc-500" />
              <span>Compact List</span>
            </button>
          </div>
        </div>

        {/* 1-Click Segmented Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
          {/* Days Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
            <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Day:</span>
            <button
              type="button"
              onClick={() => setSelectedDay('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs font-bold ${
                selectedDay === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              All Days ({routines.length})
            </button>

            {DAYS.filter((d) => d.id !== 'sat').map((d) => {
              const count = dayCounts[d.id] || 0
              const isSelected = selectedDay === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDay(isSelected ? 'all' : d.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{d.short}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Quick Facility / Lab Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
            <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1">Facility:</span>
            <button
              type="button"
              onClick={() => setSelectedLab('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs font-bold ${
                selectedLab === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              All Labs
            </button>

            {[
              { id: 'comp', label: 'Computer' },
              { id: 'phys', label: 'Physics' },
              { id: 'chem', label: 'Chemistry' },
              { id: 'bio', label: 'Biology' },
            ].map((lab) => {
              const isSelected = selectedLab === lab.id
              const count = labCounts[lab.id] || 0
              return (
                <button
                  key={lab.id}
                  type="button"
                  onClick={() => setSelectedLab(isSelected ? 'all' : lab.id)}
                  className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs flex items-center gap-1 ${
                    isSelected
                      ? 'bg-amber-600 text-white font-bold shadow-2xs'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{lab.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. MAIN CONTENT AREA: Rendered according to View Mode */}

      {/* --- MODE 1: GROUPED BY DAY (DEFAULT & RECOMMENDED) --- */}
      {viewMode === 'by_day' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 px-1">
            <span>Showing timetable slots segmented by operational day (chronological order)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllSections(true)}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Expand All</span>
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => toggleAllSections(false)}
                className="text-zinc-500 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Minimize2 className="h-3 w-3" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>

          {groupedByDay.map(({ day, items }) => {
            if (selectedDay !== 'all' && selectedDay !== day.id) return null
            const isCollapsed = Boolean(collapsedSections[day.id])

            // Facility breakdown counts for this day
            const compSlots = items.filter((i) => i.labKey === 'comp').length
            const physSlots = items.filter((i) => i.labKey === 'phys').length
            const chemSlots = items.filter((i) => i.labKey === 'chem').length
            const bioSlots = items.filter((i) => i.labKey === 'bio').length

            return (
              <div
                key={day.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs"
              >
                {/* Day Header Ribbon */}
                <div
                  onClick={() => toggleSection(day.id)}
                  className="p-3.5 px-4 bg-zinc-50/90 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-indigo-500/20">
                      {day.short}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                          {day.label}
                        </h4>
                        <span className="text-xs text-zinc-400 font-mono">({day.nepaliName})</span>
                        <Badge className="font-mono text-[10px] bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-none">
                          {items.length} Sessions
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Day Mini Facility Badges + Collapse Toggle */}
                  <div className="flex items-center gap-2.5">
                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono">
                      {compSlots > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {compSlots} Comp
                        </span>
                      )}
                      {physSlots > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {physSlots} Phys
                        </span>
                      )}
                      {chemSlots > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {chemSlots} Chem
                        </span>
                      )}
                      {bioSlots > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                          {bioSlots} Bio
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenAddModal(day.id)
                      }}
                      className="h-7 px-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <span>Add Slot</span>
                    </Button>

                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Day Table Body - Notice: NO DAY REPETITION! Clean Time & Period badges only */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {items.length === 0 ? (
                      <div className="p-8 text-center font-mono text-xs text-zinc-400">
                        No practical sessions scheduled for {day.label}.
                      </div>
                    ) : (
                      <Table className="min-w-[950px]">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-[10px] font-mono uppercase text-zinc-400">
                            <TableHead className="w-40 font-bold whitespace-nowrap">Time & Period</TableHead>
                            <TableHead className="w-40 font-bold whitespace-nowrap">Facility</TableHead>
                            <TableHead className="w-24 font-bold whitespace-nowrap">Class</TableHead>
                            <TableHead className="min-w-[180px] font-bold">Subject & Syllabus</TableHead>
                            <TableHead className="w-44 font-bold whitespace-nowrap">Subject Teacher</TableHead>
                            <TableHead className="w-36 font-bold text-center whitespace-nowrap">Duration</TableHead>
                            <TableHead className="w-24 font-bold text-center whitespace-nowrap">Status</TableHead>
                            <TableHead className="w-36 font-bold text-right whitespace-nowrap">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((session) => {
                            const isSkipped = session.isSkipped || session.status === 'skipped'
                            const span = session.span || 1
                            const visuals = getLabVisuals(session.labKey)
                            const dynamicDur = getDynamicDuration(session.timeSlot, span)
                            const slotObj = MASTER_TIME_SLOTS.find((s) => s.id === session.slotId)

                            return (
                              <TableRow
                                key={session.id}
                                className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 border-zinc-100 dark:border-zinc-800/60 font-mono text-xs transition-colors ${
                                  isSkipped ? 'opacity-50 bg-rose-50/10' : ''
                                }`}
                              >
                                {/* 1. Time & Period - Clean, un-repetitive */}
                                <TableCell className="whitespace-nowrap">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                                      <span>{session.timeSlot}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                        {slotObj?.name || session.slotId.toUpperCase()}
                                      </span>
                                      {span > 1 && (
                                        <span className="text-purple-600 dark:text-purple-400 font-bold">
                                          +{span - 1} Period
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* 2. Facility */}
                                <TableCell className="whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    {visuals.icon}
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                      {session.lab}
                                    </span>
                                  </div>
                                </TableCell>

                                {/* 3. Class */}
                                <TableCell className="whitespace-nowrap">
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[10px] font-bold border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900"
                                  >
                                    {session.grade}
                                  </Badge>
                                </TableCell>

                                {/* 4. Subject */}
                                <TableCell>
                                  <div>
                                    <div className="font-bold text-zinc-950 dark:text-white font-sans text-xs flex items-center gap-1.5">
                                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                                        {session.subjectCode}
                                      </span>
                                      <span>{session.subjectTitle}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">
                                      {session.category || 'Practical'} Curriculum
                                    </div>
                                  </div>
                                </TableCell>

                                {/* 5. Teacher */}
                                <TableCell className="whitespace-nowrap">
                                  <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                    {session.teacher}
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    Roll Cap: {session.defaultStudents}
                                  </div>
                                </TableCell>

                                {/* 6. Duration - Dynamic calculation from timeSlot without hardcoding */}
                                <TableCell className="text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center justify-center whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                                      span > 1
                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    {dynamicDur.text}
                                  </span>
                                </TableCell>

                                {/* 7. Status */}
                                <TableCell className="text-center">
                                  <Badge
                                    className={`font-mono text-[10px] font-bold ${
                                      isSkipped
                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    }`}
                                  >
                                    {isSkipped ? 'Cancelled' : 'Active'}
                                  </Badge>
                                </TableCell>

                                {/* 8. Clean Grouped Action Bar */}
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEditModal(session)}
                                      className="h-7 w-7 p-0 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                                      title="Edit routine slot"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>

                                    {/* Extend / Unmerge Toggle */}
                                    {span > 1 ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => unmergeSession(session.id)}
                                        className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                        title={`Unmerge ${span} periods to single period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 1, activeSlots), 1).text})`}
                                      >
                                        <Split className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => extendSession(session.id, 1)}
                                        className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                        title={`Extend session by +1 period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 2, activeSlots), 2).text})`}
                                      >
                                        <Layers className="h-3.5 w-3.5" />
                                      </Button>
                                    )}

                                    {/* Cancel / Restore Toggle */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleCancel(session)}
                                      className={`h-7 w-7 p-0 rounded-lg ${
                                        isSkipped
                                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                                          : 'text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                      }`}
                                      title={isSkipped ? 'Restore session' : 'Cancel session'}
                                    >
                                      {isSkipped ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                                    </Button>

                                    {/* Delete Button */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingSessionId(session.id)}
                                      className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                                      title="Delete session"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* --- MODE 2: GROUPED BY FACILITY --- */}
      {viewMode === 'by_lab' && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-zinc-500 px-1">
            Showing timetable slots organized by laboratory room facility
          </div>

          {groupedByLab.map(({ lab, items }) => {
            if (selectedLab !== 'all' && selectedLab !== lab.id) return null
            const isCollapsed = Boolean(collapsedSections[lab.id])
            const visuals = getLabVisuals(lab.id)

            return (
              <div
                key={lab.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs"
              >
                {/* Lab Header Ribbon */}
                <div
                  onClick={() => toggleSection(lab.id)}
                  className="p-3.5 px-4 bg-zinc-50/90 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-xl ${visuals.bg} flex items-center justify-center border`}>
                      {visuals.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                          {lab.name}
                        </h4>
                        <Badge className="font-mono text-[10px] bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-none">
                          {items.length} Weekly Sessions
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenAddModal(undefined, undefined, lab.id)
                      }}
                      className="h-7 px-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <span>Add Slot</span>
                    </Button>

                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {items.length === 0 ? (
                      <div className="p-8 text-center font-mono text-xs text-zinc-400">
                        No practical sessions assigned to {lab.name}.
                      </div>
                    ) : (
                      <Table className="min-w-[950px]">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-[10px] font-mono uppercase text-zinc-400">
                            <TableHead className="w-28 font-bold whitespace-nowrap">Day</TableHead>
                            <TableHead className="w-40 font-bold whitespace-nowrap">Time & Period</TableHead>
                            <TableHead className="w-24 font-bold whitespace-nowrap">Class</TableHead>
                            <TableHead className="min-w-[180px] font-bold">Subject Code & Title</TableHead>
                            <TableHead className="w-44 font-bold whitespace-nowrap">Teacher</TableHead>
                            <TableHead className="w-36 font-bold text-center whitespace-nowrap">Duration</TableHead>
                            <TableHead className="w-24 font-bold text-center whitespace-nowrap">Status</TableHead>
                            <TableHead className="w-36 font-bold text-right whitespace-nowrap">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((session) => {
                            const isSkipped = session.isSkipped || session.status === 'skipped'
                            const span = session.span || 1
                            const dayObj = DAYS.find((d) => d.id === session.dayKey)
                            const dynamicDur = getDynamicDuration(session.timeSlot, span)

                            return (
                              <TableRow
                                key={session.id}
                                className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 border-zinc-100 dark:border-zinc-800/60 font-mono text-xs transition-colors ${
                                  isSkipped ? 'opacity-50 bg-rose-50/10' : ''
                                }`}
                              >
                                <TableCell className="font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                  {dayObj?.short || session.day}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="font-bold text-zinc-800 dark:text-zinc-200">{session.timeSlot}</div>
                                  <div className="text-[10px] text-zinc-400">{session.slotId.toUpperCase()}</div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <Badge variant="outline" className="font-mono text-[10px]">
                                    {session.grade}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="font-bold text-zinc-950 dark:text-white font-sans text-xs">
                                    <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1.5">{session.subjectCode}</span>
                                    {session.subjectTitle}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  <div className="text-xs text-zinc-800 dark:text-zinc-200">{session.teacher}</div>
                                </TableCell>
                                <TableCell className="text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center justify-center whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                                      span > 1
                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    {dynamicDur.text}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={isSkipped ? 'bg-rose-500/15 text-rose-700' : 'bg-emerald-500/15 text-emerald-700'}>
                                    {isSkipped ? 'Cancelled' : 'Active'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEditModal(session)}
                                      className="h-7 w-7 p-0 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                                      title="Edit routine slot"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </Button>
                                    {span > 1 ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => unmergeSession(session.id)}
                                        className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                        title={`Unmerge ${span} periods to single period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 1, activeSlots), 1).text})`}
                                      >
                                        <Split className="h-3.5 w-3.5" />
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => extendSession(session.id, 1)}
                                        className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                        title={`Extend session by +1 period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 2, activeSlots), 2).text})`}
                                      >
                                        <Layers className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleCancel(session)}
                                      className={`h-7 w-7 p-0 rounded-lg ${
                                        isSkipped
                                          ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                                          : 'text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                      }`}
                                      title={isSkipped ? 'Restore cancelled session' : 'Cancel session'}
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeletingSessionId(session.id)}
                                      className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                                      title="Delete routine slot"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* --- MODE 3: COMPACT FLAT TABLE (ORIGINAL SEARCHABLE CONDENSED VIEW) --- */}
      {viewMode === 'flat' && (
        <Card className="border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[950px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 font-mono text-xs">
                  <TableHead className="w-[180px] whitespace-nowrap">Day & Period</TableHead>
                  <TableHead className="w-[160px] whitespace-nowrap">Facility</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Class</TableHead>
                  <TableHead className="min-w-[180px]">Subject Code & Title</TableHead>
                  <TableHead className="w-[180px] whitespace-nowrap">Subject Teacher</TableHead>
                  <TableHead className="w-[140px] text-center whitespace-nowrap">Duration</TableHead>
                  <TableHead className="w-[100px] text-center whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right w-[140px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-44 text-center text-zinc-500 font-mono text-xs">
                      No routine sessions match the active filter criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoutines.map((session) => {
                    const dayObj = DAYS.find((d) => d.id === session.dayKey)
                    const isSkipped = session.isSkipped || session.status === 'skipped'
                    const span = session.span || 1
                    const visuals = getLabVisuals(session.labKey)
                    const dynamicDur = getDynamicDuration(session.timeSlot, span)

                    return (
                      <TableRow
                        key={session.id}
                        className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800/80 font-mono text-xs transition-colors ${
                          isSkipped ? 'opacity-60 bg-rose-50/10' : ''
                        }`}
                      >
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              {dayObj?.short || session.day}
                            </span>
                            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-mono">
                              {session.timeSlot}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {session.slotId.toUpperCase()}
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {visuals.icon}
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {session.lab}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {session.grade}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="font-bold text-zinc-950 dark:text-white font-sans text-xs">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1.5">
                              {session.subjectCode}
                            </span>
                            {session.subjectTitle}
                          </div>
                        </TableCell>

                        <TableCell className="whitespace-nowrap">
                          <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                            {session.teacher}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Capacity: {session.defaultStudents}
                          </div>
                        </TableCell>

                        <TableCell className="text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center whitespace-nowrap text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                              span > 1
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            {dynamicDur.text}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge className={isSkipped ? 'bg-rose-500/15 text-rose-700' : 'bg-emerald-500/15 text-emerald-700'}>
                            {isSkipped ? 'Cancelled' : 'Active'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(session)}
                              className="h-7 w-7 p-0 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                              title="Edit routine slot"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            {span > 1 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unmergeSession(session.id)}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                title={`Unmerge ${span} periods to single period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 1, activeSlots), 1).text})`}
                              >
                                <Split className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => extendSession(session.id, 1)}
                                className="h-7 w-7 p-0 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg"
                                title={`Extend session by +1 period (${getDynamicDuration(computeCombinedTimeRange(session.slotId, 2, activeSlots), 2).text})`}
                              >
                                <Layers className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleCancel(session)}
                              className={`h-7 w-7 p-0 rounded-lg ${
                                isSkipped
                                  ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                                  : 'text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                              }`}
                              title={isSkipped ? 'Restore cancelled session' : 'Cancel session'}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingSessionId(session.id)}
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                              title="Delete routine slot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 5. Add / Edit Session Modal */}
      {(isAddModalOpen || editingSession) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 font-sans">
            {/* Header */}
            <div className="p-4 px-6 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-950 dark:text-white font-mono uppercase">
                    {editingSession ? 'Edit Routine Practical Slot' : 'Add New Practical Slot'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {editingSession ? `Modifying slot ID: ${editingSession.id}` : 'Schedule curriculum session in master timetable'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false)
                  setEditingSession(null)
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSession} className="p-6 space-y-4 font-mono text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {hasConflict && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Notice: Another practical session is already scheduled in this laboratory at the selected time. Saving will overlap.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Day of Week */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Day of Week
                  </label>
                  <select
                    value={formDayKey}
                    onChange={(e) => setFormDayKey(e.target.value as DayKey)}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {DAYS.filter((d) => d.id !== 'sat').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label} ({d.nepaliName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Laboratory Facility */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Laboratory Facility
                  </label>
                  <select
                    value={formLabKey}
                    onChange={(e) => setFormLabKey(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Time Slot */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Start Period / Time
                  </label>
                  <select
                    value={formSlotId}
                    onChange={(e) => setFormSlotId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {activeSlots.map((s) => {
                      const dur = getDynamicDuration(s.label, 1)
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} • {s.label} ({dur.text})
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Duration Span */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Slot Span / Periods
                    </label>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {getDynamicDuration(computeCombinedTimeRange(formSlotId, formSpan, activeSlots), formSpan).text}
                    </span>
                  </div>
                  <select
                    value={formSpan}
                    onChange={(e) => setFormSpan(parseInt(e.target.value, 10))}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {[1, 2, 3].map((sp) => {
                      const combinedTime = computeCombinedTimeRange(formSlotId, sp, activeSlots)
                      const dur = getDynamicDuration(combinedTime, sp)
                      return (
                        <option key={sp} value={sp}>
                          {sp === 1 ? `1 Period (Single) • ${dur.text}` : `${sp} Periods (${sp === 2 ? 'Double' : 'Triple'}) • ${dur.text}`} — {combinedTime}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class / Batch */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Class / Section
                  </label>
                  <select
                    value={formGrade}
                    onChange={(e) => {
                      const newGrade = e.target.value
                      setFormGrade(newGrade)
                      const targetCls = classes.find((c) => c.name === newGrade)
                      if (targetCls) {
                        setFormStudents(targetCls.capacity)
                      }
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.stream ? `(${c.stream})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Capacity */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Default Student Count
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={formStudents}
                    onChange={(e) => setFormStudents(parseInt(e.target.value, 10) || 36)}
                    className="h-9 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              {/* Subject Selection / Input with Quick Select from Curriculum */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Curriculum Subject Catalog ({formGrade})
                    </label>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                      Select to auto-populate details
                    </span>
                  </div>
                  <select
                    onChange={(e) => {
                      const code = e.target.value
                      if (!code) return
                      const sub = subjects.find((s) => s.code === code) || DEFAULT_SUBJECTS.find((s) => s.code === code)
                      if (sub) {
                        setFormSubjectCode(sub.code)
                        setFormSubjectTitle(sub.title)
                        if (sub.labId) setFormLabKey(sub.labId as any)
                        if ('teacherName' in sub && (sub as any).teacherName) {
                          setFormTeacher((sub as any).teacherName)
                        } else if (sub.teacherId) {
                          const t = faculty.find((f) => f.id === sub.teacherId)
                          if (t) setFormTeacher(t.name)
                        }
                      }
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Choose subject from curriculum to auto-fill...</option>
                    {curriculumSubjectsForGrade.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.title} ({s.lab || 'Laboratory'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Subject Code *
                    </label>
                    <Input
                      value={formSubjectCode}
                      onChange={(e) => setFormSubjectCode(e.target.value)}
                      placeholder="e.g. COMP-12"
                      className="h-9 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Subject / Experiment Title *
                    </label>
                    <Input
                      value={formSubjectTitle}
                      onChange={(e) => setFormSubjectTitle(e.target.value)}
                      placeholder="e.g. Data Structures & Algorithms Lab"
                      className="h-9 text-xs font-sans bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Subject Teacher */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Assigned Subject Teacher
                </label>
                <div className="flex gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) setFormTeacher(e.target.value)
                    }}
                    className="w-1/2 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 text-xs font-mono text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Select Faculty...</option>
                    {faculty.map((f) => (
                      <option key={f.id} value={f.name}>
                        {f.name} ({f.role || 'Faculty'})
                      </option>
                    ))}
                  </select>
                  <Input
                    value={formTeacher}
                    onChange={(e) => setFormTeacher(e.target.value)}
                    placeholder="or type teacher name"
                    className="flex-1 h-9 text-xs font-mono bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    required
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setEditingSession(null)
                  }}
                  className="h-9 px-4 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold shadow-xs cursor-pointer"
                >
                  {editingSession ? 'Save Changes' : 'Create Routine Slot'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white font-mono uppercase">
                  Delete Routine Session?
                </h4>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  This practical slot will be removed from the master timetable.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-sans leading-relaxed">
              Are you sure you want to permanently delete this routine session? Any unlogged sessions scheduled for today will also be cleared.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingSessionId(null)}
                className="h-8 px-3.5 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteConfirm}
                className="h-8 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-mono font-bold shadow-xs cursor-pointer"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Reset Routine Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-950 dark:text-white font-mono uppercase">
                  Reset to Default Routine?
                </h4>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  Restores official institutional timetable (48 standard sessions).
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-sans leading-relaxed">
              This will discard any ad-hoc timetable modifications and restore the canonical Shree Ratna Rajya Laxmi Secondary School master laboratory routine.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsResetConfirmOpen(false)}
                className="h-8 px-3.5 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  resetToMaster()
                  setIsResetConfirmOpen(false)
                  showNotification('Master timetable reset to institutional defaults.')
                }}
                className="h-8 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono font-bold shadow-xs cursor-pointer"
              >
                Reset Timetable
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
