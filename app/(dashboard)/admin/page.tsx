'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Shield,
  Building2,
  BookOpen,
  Users,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Sparkles,
  Palmtree,
  Settings,
  Clock,
  RotateCcw,
  Lock,
  Unlock,
  Download,
  Upload,
  AlertTriangle,
  HardDriveDownload,
  HardDriveUpload,
  Database,
  UserCheck,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Fingerprint,
  FileCheck,
  Check,
  X,
  FileText,
  Sliders,
  Layers,
  Wrench,
  Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import {
  useInfrastructureState,
  PeriodSlotItem,
  LabFacilityItem,
  ClassEnrollmentItem,
  FacultyMemberItem,
  SubjectCurriculumItem,
  IncidentCategoryItem,
} from '@/hooks/use-infrastructure-state'
import { IncidentCategoriesManager } from '@/components/admin/incident-categories-manager'
import { updateLabFacility, createLabFacility } from '@/app/actions/labs'
import { recordClientAuditEvent } from '@/app/actions/audit'
import dynamic from 'next/dynamic'
import { HolidayItem } from '@/lib/master-data'
import { useIncidentState, LabIncidentRecord } from '@/hooks/use-incident-state'
import { matchesGrade } from '@/lib/context/institutional-relationships'

const DualCalendarPicker = dynamic(() => import('@/components/admin/dual-calendar-picker'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Calendar Picker...</div>,
})

const RoutineManager = dynamic(() => import('@/components/admin/routine-manager'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Master Routine Console...</div>,
})

const MaintenanceRoutinesManager = dynamic(() => import('@/components/admin/maintenance-routines-manager'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Maintenance Routine Console...</div>,
})

const UserAccessManager = dynamic(() => import('@/components/admin/user-access-manager'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Access Management Console...</div>,
})

const IncidentDrawer = dynamic(() => import('@/components/dashboard/incident-drawer'), {
  ssr: false,
})

const EmailNotificationManager = dynamic(() => import('@/components/admin/email-notification-manager'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Email Notifications Station...</div>,
})

const InstitutionalAuditManager = dynamic(() => import('@/components/admin/institutional-audit-manager'), {
  ssr: false,
  loading: () => <div className="h-32 flex items-center justify-center text-xs text-zinc-500 font-medium">Loading Institutional Audit Ledger...</div>,
})

async function computeSha256(text: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return 'sha256-precomputed-hash'
  }
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface DangerModalState {
  isOpen: boolean
  title: string
  description: string
  impactMessage: string
  itemType: 'lab' | 'class' | 'period' | 'subject' | 'faculty' | 'holiday' | 'reset' | 'category' | 'restore' | 'policy'
  itemId?: string
  confirmLabel?: string
  variant?: 'destructive' | 'indigo' | 'amber'
  requiresTypedConfirmation?: boolean
  typedConfirmationWord?: string
  onConfirm: () => void
}

type ExecutiveCategory = 'identity' | 'curriculum' | 'facilities' | 'operations'

export default function SuperAdminPage() {
  // 4 Categorized Executive Tabs (No horizontal scrolling)
  const [activeCategory, setActiveCategory] = useState<ExecutiveCategory>('identity')

  // Collapsible cohort class groups state
  const [collapsedGrades, setCollapsedGrades] = useState<Record<string, boolean>>({})
  const toggleGradeCollapse = (grade: string) => {
    setCollapsedGrades((prev) => ({ ...prev, [grade]: !prev[grade] }))
  }

  // Sub-tabs for Curriculum, Facilities, Operations
  const [curriculumSubTab, setCurriculumSubTab] = useState<'subjects' | 'periods' | 'classes' | 'routine'>('subjects')
  const [facilitiesSubTab, setFacilitiesSubTab] = useState<'labs' | 'maintenance' | 'categories' | 'incidents'>('labs')
  const [operationsSubTab, setOperationsSubTab] = useState<'calendar' | 'notifications' | 'audit' | 'recovery'>('calendar')

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Incidents state for audit register
  const { incidents, isLoading: isIncidentsLoading } = useIncidentState()
  const [selectedIncident, setSelectedIncident] = useState<LabIncidentRecord | null>(null)
  const [isIncidentDrawerOpen, setIsIncidentDrawerOpen] = useState(false)
  const [incidentLabFilter, setIncidentLabFilter] = useState('all')
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('all')

  // 🛡️ Precaution Safety Mode (Locked by default to prevent accidental edits/deletions)
  const [isEditModeUnlocked, setIsEditModeUnlocked] = useState(false)

  // 🚨 Danger Modal State
  const [dangerModal, setDangerModal] = useState<DangerModalState>({
    isOpen: false,
    title: '',
    description: '',
    impactMessage: '',
    itemType: 'period',
    onConfirm: () => {},
  })
  const [typedConfirmInput, setTypedConfirmInput] = useState('')

  // Calendar Settings Hook
  const { startDay, sundayWeekend, saturdayWeekend, updateSettings } = useCalendarSettings()

  // 🌐 Unified Infrastructure State Hook
  const {
    periods,
    labs,
    classes,
    faculty,
    subjects,
    holidays,
    addPeriod,
    updatePeriod,
    deletePeriod,
    resetPeriods,
    addLab,
    updateLab,
    deleteLab,
    addClass,
    updateClass,
    deleteClass,
    addFaculty,
    updateFaculty,
    deleteFaculty,
    addSubject,
    updateSubject,
    deleteSubject,
    assignTeacherToSubject,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    resetHolidaysToOfficialGazette,
    incidentCategories,
    incidentSettings,
    addIncidentCategory,
    updateIncidentCategory,
    deleteIncidentCategory,
    deactivateIncidentCategory,
    resetIncidentCategories,
    updateIncidentSettings,
  } = useInfrastructureState()

  // --- Add / Edit Modals States ---
  const [isAddLabOpen, setIsAddLabOpen] = useState(false)
  const [editingLab, setEditingLab] = useState<LabFacilityItem | null>(null)
  const [labFormName, setLabFormName] = useState('')
  const [labFormCode, setLabFormCode] = useState('')
  const [labFormCapacity, setLabFormCapacity] = useState(40)
  const [labFormType, setLabFormType] = useState('computer_lab')
  const [labFormStatus, setLabFormStatus] = useState('Operational')

  const [isAddClassOpen, setIsAddClassOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassEnrollmentItem | null>(null)
  const [classFormName, setClassFormName] = useState('')
  const [classFormSection, setClassFormSection] = useState('')
  const [classFormCapacity, setClassFormCapacity] = useState(42)
  const [classFormStream, setClassFormStream] = useState('Science Stream')

  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<SubjectCurriculumItem | null>(null)
  const [subFormTitle, setSubFormTitle] = useState('')
  const [subFormCode, setSubFormCode] = useState('')
  const [subFormGrade, setSubFormGrade] = useState('Class 12')
  const [subFormQuota, setSubFormQuota] = useState(25)
  const [subFormLabId, setSubFormLabId] = useState('comp')
  const [subFormTeacherId, setSubFormTeacherId] = useState('t1')

  // Subjects Filter & Grouping State
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('')
  const [subjectTeacherFilter, setSubjectTeacherFilter] = useState('all')
  const [subjectClassFilter, setSubjectClassFilter] = useState('all')
  const [subjectLabFilter, setSubjectLabFilter] = useState('all')
  const [subjectGroupByClass, setSubjectGroupByClass] = useState(true)

  // Filtered subjects computation
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      // Search filter
      if (subjectSearchQuery.trim()) {
        const q = subjectSearchQuery.toLowerCase()
        const matches =
          s.title.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.teacherName && s.teacherName.toLowerCase().includes(q))
        if (!matches) return false
      }

      // Teacher filter
      if (subjectTeacherFilter !== 'all') {
        const matchesTeacher =
          s.teacherId === subjectTeacherFilter ||
          (s.teacherName && s.teacherName === subjectTeacherFilter) ||
          (faculty.find((f) => f.id === subjectTeacherFilter)?.name === s.teacherName)
        if (!matchesTeacher) return false
      }

      // Class grade filter
      if (subjectClassFilter !== 'all') {
        if (s.grade !== subjectClassFilter && !matchesGrade(s.grade, subjectClassFilter)) return false
      }

      // Lab facility filter
      if (subjectLabFilter !== 'all') {
        if (s.labId !== subjectLabFilter && s.lab !== subjectLabFilter) return false
      }

      return true
    })
  }, [subjects, subjectSearchQuery, subjectTeacherFilter, subjectClassFilter, subjectLabFilter, faculty])

  // Grouped by Class computation
  const groupedSubjects = useMemo(() => {
    const map = new Map<string, SubjectCurriculumItem[]>()
    filteredSubjects.forEach((s) => {
      const key = s.grade || 'Unassigned Class'
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(s)
    })
    // Sort class grades naturally: 11 first, then 12, etc.
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    )
  }, [filteredSubjects])

  // Unique teachers list for filter dropdown
  const teacherFilterOptions = useMemo(() => {
    const list: { id: string; name: string }[] = []
    const seen = new Set<string>()

    faculty.forEach((f) => {
      if (f.name && !seen.has(f.name)) {
        seen.add(f.name)
        list.push({ id: f.id, name: f.name })
      }
    })

    subjects.forEach((s) => {
      if (s.teacherName && !seen.has(s.teacherName)) {
        seen.add(s.teacherName)
        list.push({ id: s.teacherId || s.teacherName, name: s.teacherName })
      }
    })

    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [faculty, subjects])

  // Class batches for filter dropdown (strictly based on Enrolled Class Batches)
  const classFilterOptions = useMemo(() => {
    if (classes && classes.length > 0) {
      return classes.map((c) => c.name)
    }
    const set = new Set<string>()
    subjects.forEach((s) => {
      if (s.grade) set.add(s.grade)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [classes, subjects])

  const [isAddPeriodOpen, setIsAddPeriodOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<PeriodSlotItem | null>(null)
  const [periodFormName, setPeriodFormName] = useState('')
  const [periodFormStart, setPeriodFormStart] = useState('10:10')
  const [periodFormEnd, setPeriodFormEnd] = useState('11:00')

  // Disaster recovery snapshot state
  const [snapshotIntegrityHash, setSnapshotIntegrityHash] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify infrastructure.')
      return false
    }
    return true
  }

  const requestDangerAction = (config: Omit<DangerModalState, 'isOpen'>) => {
    if (config.itemType !== 'policy' && !requireEditMode()) return
    setTypedConfirmInput('')
    setDangerModal({
      ...config,
      isOpen: true,
    })
  }

  // --- Handlers: Periods ---
  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingPeriod && !requireEditMode()) return

    if (editingPeriod) {
      updatePeriod(editingPeriod.id, {
        name: periodFormName,
        label: `${periodFormStart} - ${periodFormEnd}`,
      })
      triggerToast(`Period ${editingPeriod.name} updated.`)
      setEditingPeriod(null)
    } else {
      const newP: PeriodSlotItem = {
        id: `t${periods.length + 1}`,
        name: periodFormName,
        label: `${periodFormStart} - ${periodFormEnd}`,
      }
      addPeriod(newP)
      triggerToast(`Added period ${newP.name} (${newP.label})`)
      setIsAddPeriodOpen(false)
    }
    setPeriodFormName('')
  }

  // --- Handlers: Labs ---
  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingLab && !requireEditMode()) return

    if (editingLab) {
      const labId = editingLab.id
      updateLab(labId, {
        name: labFormName,
        code: labFormCode.toUpperCase(),
        capacity: labFormCapacity,
        type: labFormType,
        status: labFormStatus,
      })
      triggerToast(`Laboratory "${labFormName}" updated (${labFormCapacity} Stations).`)
      setIsAddLabOpen(false)
      setEditingLab(null)
    } else {
      const newLab: LabFacilityItem = {
        id: labFormCode.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: labFormName,
        code: labFormCode.toUpperCase(),
        capacity: labFormCapacity,
        type: labFormType,
        status: labFormStatus,
      }
      addLab(newLab)
      triggerToast(`Laboratory facility "${labFormName}" registered.`)
      setIsAddLabOpen(false)
    }
    setLabFormName('')
    setLabFormCode('')
  }

  // --- Handlers: Classes ---
  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingClass && !requireEditMode()) return

    if (editingClass) {
      updateClass(editingClass.id, {
        name: classFormName,
        section: classFormSection,
        capacity: classFormCapacity,
        stream: classFormStream,
      })
      triggerToast(`Class "${classFormName}" updated.`)
      setEditingClass(null)
    } else {
      const newCls: ClassEnrollmentItem = {
        id: `${classFormName.toLowerCase().replace(/\s+/g, '')}-${classFormSection.toLowerCase().replace(/\s+/g, '')}`,
        name: classFormName,
        section: classFormSection,
        capacity: classFormCapacity,
        stream: classFormStream,
      }
      addClass(newCls)
      triggerToast(`Enrolled class batch "${classFormName} - ${classFormSection}".`)
      setIsAddClassOpen(false)
    }
    setClassFormName('')
    setClassFormSection('')
  }

  // --- Handlers: Subjects ---
  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingSubject && !requireEditMode()) return

    const labObj = labs.find((l) => l.id === subFormLabId)
    const teacherObj = faculty.find((f) => f.id === subFormTeacherId)

    if (editingSubject) {
      updateSubject(editingSubject.code, {
        title: subFormTitle,
        grade: subFormGrade,
        quota: subFormQuota,
        lab: labObj?.name || 'Laboratory',
        labId: subFormLabId,
        teacherId: subFormTeacherId,
        teacherName: teacherObj?.name || 'Assigned Faculty',
      })
      triggerToast(`Subject curriculum "${subFormTitle}" updated.`)
      setEditingSubject(null)
    } else {
      const newSub: SubjectCurriculumItem = {
        code: subFormCode.toUpperCase(),
        title: subFormTitle,
        grade: subFormGrade,
        quota: subFormQuota,
        lab: labObj?.name || 'Laboratory',
        labId: subFormLabId,
        teacherId: subFormTeacherId,
        teacherName: teacherObj?.name || 'Assigned Faculty',
      }
      addSubject(newSub)
      triggerToast(`Registered curriculum subject "${subFormTitle}".`)
      setIsAddSubjectOpen(false)
    }
    setSubFormTitle('')
    setSubFormCode('')
  }

  // --- Disaster Recovery: Cryptographic Snapshot Export ---
  const handleExportSnapshot = async () => {
    setIsExporting(true)
    try {
      const payload = {
        institution: 'Ratna Rajya Laxmi Campus / School of Science',
        system: 'LMR LabSync Institutional LIMS',
        version: '2.4-enterprise',
        export_timestamp: new Date().toISOString(),
        periods,
        labs,
        classes,
        faculty,
        subjects,
        holidays,
        incidentCategories,
        incidentSettings,
        calendarSettings: {
          startDay,
          sundayWeekend,
          saturdayWeekend,
        },
      }

      const jsonStr = JSON.stringify(payload, null, 2)
      const hash = await computeSha256(jsonStr)
      setSnapshotIntegrityHash(hash)

      const finalPayload = {
        ...payload,
        sha256_checksum: hash,
      }

      const blob = new Blob([JSON.stringify(finalPayload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `lmr-system-snapshot-${dateStr}-${hash.slice(0, 8)}.json`
      a.click()
      URL.revokeObjectURL(url)

      triggerToast('🔒 Cryptographic System Snapshot Exported with SHA-256 checksum!')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireEditMode()) return
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)

        if (!parsed.system || !parsed.periods || !parsed.labs) {
          triggerToast('❌ Invalid snapshot schema. Aborting restore.')
          return
        }

        requestDangerAction({
          title: 'Confirm Disaster Recovery Restore',
          description: `You are about to overwrite all institutional infrastructure from snapshot "${file.name}".`,
          impactMessage: 'All current periods, labs, classes, subjects, and holiday rules will be updated immediately.',
          itemType: 'restore',
          requiresTypedConfirmation: true,
          typedConfirmationWord: 'RESTORE',
          onConfirm: () => {
            if (parsed.periods) localStorage.setItem('lmr_admin_periods_v2', JSON.stringify(parsed.periods))
            if (parsed.labs) localStorage.setItem('lmr_admin_labs_v2', JSON.stringify(parsed.labs))
            if (parsed.classes) localStorage.setItem('lmr_admin_classes_v2', JSON.stringify(parsed.classes))
            if (parsed.faculty) localStorage.setItem('lmr_admin_faculty_v2', JSON.stringify(parsed.faculty))
            if (parsed.subjects) localStorage.setItem('lmr_admin_subjects_v2', JSON.stringify(parsed.subjects))
            if (parsed.holidays) localStorage.setItem('lmr_admin_holidays_v2', JSON.stringify(parsed.holidays))
            if (parsed.incidentCategories) localStorage.setItem('lmr_admin_incident_categories_v2', JSON.stringify(parsed.incidentCategories))
            if (parsed.incidentSettings) localStorage.setItem('lmr_admin_incident_settings_v2', JSON.stringify(parsed.incidentSettings))
            if (parsed.calendarSettings) localStorage.setItem('lmr_calendar_settings', JSON.stringify(parsed.calendarSettings))

            window.dispatchEvent(new Event('infrastructure-updated'))
            window.dispatchEvent(new Event('lmr_settings_updated'))
            setDangerModal((prev) => ({ ...prev, isOpen: false }))
            triggerToast('✅ Full institutional state restored successfully!')
            setTimeout(() => window.location.reload(), 800)
          },
        })
      } catch (err) {
        triggerToast('❌ Failed to parse snapshot JSON file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6 w-full select-none animate-in fade-in duration-300 font-sans">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-amber-400 dark:text-amber-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner with Safety Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900/80 p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white tracking-tight">
                Super Admin Command Center
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                Tier-1 Root
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Institutional governance: access credentials, curriculum, facilities & recovery
            </p>
          </div>
        </div>

        {/* Edit Mode Unlock Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              const prev = isEditModeUnlocked
              const next = !isEditModeUnlocked
              setIsEditModeUnlocked(next)
              recordClientAuditEvent({
                action: 'UPDATE',
                entityType: 'policy',
                entityId: 'precaution_safety_mode',
                entityLabel: 'Precaution Active Safety Lock',
                before: { edit_mode_unlocked: prev, precaution_active: !prev },
                after: { edit_mode_unlocked: next, precaution_active: !next },
                metadata: { toggle: 'precaution_active_mode' },
              }).catch(() => {})
              triggerToast(
                next
                  ? '🔓 Admin Edit Mode Unlocked: Modifications are now active.'
                  : '🔒 Admin Edit Mode Locked: Infrastructure protected.'
              )
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs border ${
              isEditModeUnlocked
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-amber-500/20'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {isEditModeUnlocked ? (
              <>
                <Unlock className="h-3.5 w-3.5" />
                <span>Edit Mode: Active</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-zinc-500" />
                <span>Precaution Active</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation Segmented Control */}
      <div className="p-1 rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCategory('identity')}
          className={`flex-1 min-w-fit px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeCategory === 'identity'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
          }`}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline text-xs font-mono font-bold opacity-60 mr-0.5">01</span>
          <span>Identity & Access</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('curriculum')}
          className={`flex-1 min-w-fit px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeCategory === 'curriculum'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
          }`}
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline text-xs font-mono font-bold opacity-60 mr-0.5">02</span>
          <span>Academic Curriculum</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('facilities')}
          className={`flex-1 min-w-fit px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeCategory === 'facilities'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
          }`}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline text-xs font-mono font-bold opacity-60 mr-0.5">03</span>
          <span>Facilities & Safety</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('operations')}
          className={`flex-1 min-w-fit px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeCategory === 'operations'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
          }`}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="hidden lg:inline text-xs font-mono font-bold opacity-60 mr-0.5">04</span>
          <span>Operations & Backup</span>
        </button>
      </div>

      {/* --- SECTION 1: IDENTITY & ACCESS MANAGEMENT --- */}
      {activeCategory === 'identity' && (
        <UserAccessManager
          isEditModeUnlocked={isEditModeUnlocked}
          triggerToast={triggerToast}
        />
      )}

      {/* --- SECTION 2: ACADEMIC CURRICULUM & ROUTINE STRUCTURE --- */}
      {activeCategory === 'curriculum' && (
        <div className="space-y-5">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 w-fit">
            <button
              type="button"
              onClick={() => setCurriculumSubTab('subjects')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                curriculumSubTab === 'subjects'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Curriculum Subjects ({subjects.length})
            </button>
            <button
              type="button"
              onClick={() => setCurriculumSubTab('periods')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                curriculumSubTab === 'periods'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Timetable Periods ({periods.length})
            </button>
            <button
              type="button"
              onClick={() => setCurriculumSubTab('classes')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                curriculumSubTab === 'classes'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Class Batches ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => setCurriculumSubTab('routine')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                curriculumSubTab === 'routine'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Master Routine & Slots
            </button>
          </div>

          {/* Subjects Table */}
          {curriculumSubTab === 'subjects' && (
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Practical Curriculum Catalog</span>
                    <Badge variant="outline" className="text-[11px] font-mono ml-1 font-bold">
                      {filteredSubjects.length} of {subjects.length} Units
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500 mt-0.5">
                    Manage course units, quota expectations, and assigned faculty instructors
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={subjectGroupByClass ? 'secondary' : 'outline'}
                    onClick={() => setSubjectGroupByClass(!subjectGroupByClass)}
                    className="h-8 text-xs font-semibold gap-1.5 cursor-pointer"
                    title="Toggle Grouping by Class Grade"
                  >
                    <Layers className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>{subjectGroupByClass ? 'Grouped by Class' : 'Flat View'}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingSubject(null)
                      setSubFormTitle('')
                      setSubFormCode('')
                      setSubFormGrade(classes[0]?.name || '12 Eng')
                      setSubFormQuota(25)
                      setSubFormLabId(labs[0]?.id || 'comp')
                      setSubFormTeacherId(faculty[0]?.id || 't1')
                      setIsAddSubjectOpen(true)
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Register Subject</span>
                  </Button>
                </div>
              </CardHeader>

              {/* Filter Toolbar */}
              <div className="p-3.5 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/40 flex flex-wrap items-center gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Search subject title or code (e.g. COMP-12)..."
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    className="pl-8.5 h-8.5 text-xs bg-white dark:bg-zinc-900 font-sans"
                  />
                  {subjectSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSubjectSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter by Teacher */}
                <div className="w-full sm:w-auto min-w-[170px]">
                  <Select
                    value={subjectTeacherFilter}
                    onChange={(e) => setSubjectTeacherFilter(e.target.value)}
                    className="h-8.5 text-xs bg-white dark:bg-zinc-900 font-medium"
                  >
                    <option value="all">All Lead Teachers</option>
                    {teacherFilterOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Filter by Class Grade */}
                <div className="w-full sm:w-auto min-w-[140px]">
                  <Select
                    value={subjectClassFilter}
                    onChange={(e) => setSubjectClassFilter(e.target.value)}
                    className="h-8.5 text-xs bg-white dark:bg-zinc-900 font-medium"
                  >
                    <option value="all">All Classes</option>
                    {classFilterOptions.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Filter by Facility / Lab */}
                <div className="w-full sm:w-auto min-w-[170px]">
                  <Select
                    value={subjectLabFilter}
                    onChange={(e) => setSubjectLabFilter(e.target.value)}
                    className="h-8.5 text-xs bg-white dark:bg-zinc-900 font-medium"
                  >
                    <option value="all">All Facilities</option>
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Reset Filters button */}
                {(subjectSearchQuery ||
                  subjectTeacherFilter !== 'all' ||
                  subjectClassFilter !== 'all' ||
                  subjectLabFilter !== 'all') && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSubjectSearchQuery('')
                      setSubjectTeacherFilter('all')
                      setSubjectClassFilter('all')
                      setSubjectLabFilter('all')
                    }}
                    className="h-8.5 px-2.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>

              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                      <th className="py-3 px-4">Subject Title & Code</th>
                      <th className="py-3 px-4">Class Grade</th>
                      <th className="py-3 px-4">Designated Facility</th>
                      <th className="py-3 px-4">Lead Teacher</th>
                      <th className="py-3 px-4">Syllabus Quota</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-zinc-400 text-xs font-sans">
                          No practical curriculum subjects match the selected filters.
                        </td>
                      </tr>
                    ) : subjectGroupByClass ? (
                      groupedSubjects.map(([grade, items]) => {
                        const isCollapsed = !!collapsedGrades[grade]
                        return (
                          <React.Fragment key={grade}>
                            {/* Class Group Header */}
                            <tr
                              onClick={() => toggleGradeCollapse(grade)}
                              className="bg-zinc-100/80 dark:bg-zinc-800/70 border-y border-zinc-200/80 dark:border-zinc-700/60 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <td colSpan={6} className="py-2.5 px-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${
                                        isCollapsed ? '-rotate-90' : ''
                                      }`}
                                    />
                                    <span className="h-5.5 px-2.5 rounded-md bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 text-[11px] font-extrabold uppercase tracking-wide border border-zinc-300/80 dark:border-zinc-600 flex items-center gap-1.5 shadow-2xs">
                                      <Layers className="h-3 w-3 text-zinc-500" />
                                      <span>Class: {grade}</span>
                                    </span>
                                    <span className="text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-300">
                                      {items.length} practical course unit{items.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 text-[10.5px] font-mono font-bold">
                                    {items.length} Practical Course{items.length === 1 ? '' : 's'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {/* Subjects in this Class */}
                            {!isCollapsed &&
                              items.map((s) => (
                                <tr key={s.code} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-zinc-950 dark:text-white text-xs">{s.title}</div>
                                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-bold">{s.code}</span>
                                  </td>
                                  <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[11px]">
                                      {s.grade}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                    {s.lab || labs.find((l) => l.id === s.labId)?.name || 'Designated Lab'}
                                  </td>
                                  <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                    <span className="flex items-center gap-1.5">
                                      <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                                      <span>{s.teacherName || faculty.find((f) => f.id === s.teacherId)?.name || 'Unassigned'}</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{s.quota} Practicals</td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!isEditModeUnlocked}
                                        onClick={() => {
                                          setEditingSubject(s)
                                          setSubFormTitle(s.title)
                                          setSubFormCode(s.code)
                                          setSubFormGrade(s.grade)
                                          setSubFormQuota(s.quota)
                                          setSubFormLabId(s.labId)
                                          setSubFormTeacherId(s.teacherId)
                                          setIsAddSubjectOpen(true)
                                        }}
                                        className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                                      >
                                        <Edit3 className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <span title={!isEditModeUnlocked ? 'Unlock edit mode to delete subject' : undefined}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={!isEditModeUnlocked}
                                          onClick={() => {
                                            requestDangerAction({
                                              title: `Remove Subject: ${s.title}`,
                                              description: `Are you sure you want to delete ${s.code} - ${s.title}?`,
                                              impactMessage: 'Historical logs referencing this code remain untouched.',
                                              itemType: 'subject',
                                              itemId: s.code,
                                              onConfirm: () => {
                                                deleteSubject(s.code)
                                                setDangerModal((prev) => ({ ...prev, isOpen: false }))
                                                triggerToast(`Subject ${s.code} removed.`)
                                              },
                                            })
                                          }}
                                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        )
                      })
                    ) : (
                      filteredSubjects.map((s) => (
                        <tr key={s.code} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-950 dark:text-white text-xs">{s.title}</div>
                            <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-bold">{s.code}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[11px]">
                              {s.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                            {s.lab || labs.find((l) => l.id === s.labId)?.name || 'Designated Lab'}
                          </td>
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span>{s.teacherName || faculty.find((f) => f.id === s.teacherId)?.name || 'Unassigned'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{s.quota} Practicals</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isEditModeUnlocked}
                                onClick={() => {
                                  setEditingSubject(s)
                                  setSubFormTitle(s.title)
                                  setSubFormCode(s.code)
                                  setSubFormGrade(s.grade)
                                  setSubFormQuota(s.quota)
                                  setSubFormLabId(s.labId)
                                  setSubFormTeacherId(s.teacherId)
                                  setIsAddSubjectOpen(true)
                                }}
                                className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <span title={!isEditModeUnlocked ? 'Unlock edit mode to delete subject' : undefined}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!isEditModeUnlocked}
                                  onClick={() => {
                                    requestDangerAction({
                                      title: `Remove Subject: ${s.title}`,
                                      description: `Are you sure you want to delete ${s.code} - ${s.title}?`,
                                      impactMessage: 'Historical logs referencing this code remain untouched.',
                                      itemType: 'subject',
                                      itemId: s.code,
                                      onConfirm: () => {
                                        deleteSubject(s.code)
                                        setDangerModal((prev) => ({ ...prev, isOpen: false }))
                                        triggerToast(`Subject ${s.code} removed.`)
                                      },
                                    })
                                  }}
                                  className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Periods Table */}
          {curriculumSubTab === 'periods' && (
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    Timetable Period Slots
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Defines daily class bell timings and session slots
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span title={!isEditModeUnlocked ? 'Unlock edit mode to reset periods' : undefined}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isEditModeUnlocked}
                      onClick={() => {
                        requestDangerAction({
                          title: 'Reset Periods to Default Timetable',
                          description: 'This will restore the standard 10 period slots (09:15 to 16:50).',
                          impactMessage: 'Any custom slot timing changes will be replaced.',
                          itemType: 'reset',
                          onConfirm: () => {
                            resetPeriods()
                            setDangerModal((prev) => ({ ...prev, isOpen: false }))
                            triggerToast('Periods reset to default schedule.')
                          },
                        })
                      }}
                      className="text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Reset Defaults
                    </Button>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingPeriod(null)
                      setPeriodFormName(`Period ${periods.length + 1}`)
                      setPeriodFormStart('10:10')
                      setPeriodFormEnd('11:00')
                      setIsAddPeriodOpen(true)
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Period</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                      <th className="py-3 px-4">Period Name & Slot Index</th>
                      <th className="py-3 px-4">Daily Timing Range</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {periods.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-zinc-950 dark:text-white font-mono">{p.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-zinc-600 dark:text-zinc-300">{p.label}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isEditModeUnlocked}
                              onClick={() => {
                                setEditingPeriod(p)
                                setPeriodFormName(p.name)
                                const parts = p.label.split('-')
                                setPeriodFormStart(parts[0]?.trim() || '10:10')
                                setPeriodFormEnd(parts[1]?.trim() || '11:00')
                                setIsAddPeriodOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <span
                              title={
                                !isEditModeUnlocked
                                  ? 'Unlock edit mode to delete period'
                                  : periods.length <= 4
                                  ? 'Minimum 4 periods required'
                                  : undefined
                              }
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isEditModeUnlocked || periods.length <= 4}
                                onClick={() => {
                                  requestDangerAction({
                                    title: `Delete Period: ${p.name}`,
                                    description: `Are you sure you want to remove ${p.name} (${p.label})?`,
                                    impactMessage: 'Schedule slots mapped to this period might need realignment.',
                                    itemType: 'period',
                                    itemId: p.id,
                                    onConfirm: () => {
                                      deletePeriod(p.id)
                                      setDangerModal((prev) => ({ ...prev, isOpen: false }))
                                      triggerToast(`Period ${p.name} deleted.`)
                                    },
                                  })
                                }}
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Classes Table */}
          {curriculumSubTab === 'classes' && (
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Enrolled Class Batches & Headcounts
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Track class strengths, streams, and roll roster quotas
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingClass(null)
                    setClassFormName('Class 11')
                    setClassFormSection('Section A')
                    setClassFormCapacity(42)
                    setClassFormStream('Science Stream')
                    setIsAddClassOpen(true)
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Class Batch</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                      <th className="py-3 px-4">Class & Section</th>
                      <th className="py-3 px-4">Academic Stream</th>
                      <th className="py-3 px-4">Student Headcount</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {classes.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-950 dark:text-white text-xs">{c.name}</div>
                          <span className="text-[11px] text-zinc-500">{c.section}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">{c.stream}</td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{c.capacity} Students</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isEditModeUnlocked}
                              onClick={() => {
                                setEditingClass(c)
                                setClassFormName(c.name)
                                setClassFormSection(c.section)
                                setClassFormCapacity(c.capacity)
                                setClassFormStream(c.stream)
                                setIsAddClassOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <span title={!isEditModeUnlocked ? 'Unlock edit mode to unenroll class batch' : undefined}>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isEditModeUnlocked}
                                onClick={() => {
                                  requestDangerAction({
                                    title: `Remove Class: ${c.name} - ${c.section}`,
                                    description: `Are you sure you want to unenroll this batch?`,
                                    impactMessage: 'Associated student attendance history remains archived.',
                                    itemType: 'class',
                                    itemId: c.id,
                                    onConfirm: () => {
                                      deleteClass(c.id)
                                      setDangerModal((prev) => ({ ...prev, isOpen: false }))
                                      triggerToast(`Class ${c.name} removed.`)
                                    },
                                  })
                                }}
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Master Routine & Schedule Management Console */}
          {curriculumSubTab === 'routine' && (
            <RoutineManager isEditModeUnlocked={isEditModeUnlocked} />
          )}
        </div>
      )}

      {/* --- SECTION 3: FACILITIES & SAFETY GOVERNANCE --- */}
      {activeCategory === 'facilities' && (
        <div className="space-y-5">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 w-fit">
            <button
              type="button"
              onClick={() => setFacilitiesSubTab('labs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                facilitiesSubTab === 'labs'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Laboratories ({labs.length})
            </button>
            <button
              type="button"
              onClick={() => setFacilitiesSubTab('maintenance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                facilitiesSubTab === 'maintenance'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Maintenance Routines
            </button>
            <button
              type="button"
              onClick={() => setFacilitiesSubTab('categories')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                facilitiesSubTab === 'categories'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Incident Categories ({incidentCategories.length})
            </button>
            <button
              type="button"
              onClick={() => setFacilitiesSubTab('incidents')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                facilitiesSubTab === 'incidents'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Incident Register ({incidents.length})
            </button>
          </div>

          {/* Laboratories Table */}
          {facilitiesSubTab === 'labs' && (
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    Laboratory Facility Directory
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Physical rooms, station capacities, and facility operating statuses
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingLab(null)
                    setLabFormName('')
                    setLabFormCode('')
                    setLabFormCapacity(40)
                    setLabFormType('computer_lab')
                    setLabFormStatus('Operational')
                    setIsAddLabOpen(true)
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Laboratory</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                      <th className="py-3 px-4">Facility Name & Code</th>
                      <th className="py-3 px-4">Facility Classification</th>
                      <th className="py-3 px-4">Max Workstation Capacity</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {labs.map((l) => (
                      <tr key={l.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-950 dark:text-white text-xs">{l.name}</div>
                          <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">{l.code}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300 capitalize">{l.type.replace('_', ' ')}</td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">{l.capacity} Stations</td>
                        <td className="py-3 px-4">
                          {l.status === 'Operational' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Operational
                            </span>
                          )}
                          {l.status === 'Under Maintenance' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                              <Wrench className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              Under Maintenance
                            </span>
                          )}
                          {l.status !== 'Operational' && l.status !== 'Under Maintenance' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400"></span>
                              {l.status || 'Inactive'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isEditModeUnlocked}
                              onClick={() => {
                                setEditingLab(l)
                                setLabFormName(l.name)
                                setLabFormCode(l.code)
                                setLabFormCapacity(l.capacity)
                                setLabFormType(l.type)
                                setLabFormStatus(l.status)
                                setIsAddLabOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <span
                              title={
                                !isEditModeUnlocked
                                  ? 'Unlock edit mode to decommission facility'
                                  : labs.length <= 1
                                  ? 'Minimum 1 facility required'
                                  : undefined
                              }
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isEditModeUnlocked || labs.length <= 1}
                                onClick={() => {
                                  requestDangerAction({
                                    title: `Remove Facility: ${l.name}`,
                                    description: `Are you sure you want to decommission ${l.name}?`,
                                    impactMessage: 'Any scheduled routine for this lab will be suspended.',
                                    itemType: 'lab',
                                    itemId: l.id,
                                    onConfirm: () => {
                                      deleteLab(l.id)
                                      setDangerModal((prev) => ({ ...prev, isOpen: false }))
                                      triggerToast(`Facility ${l.name} removed.`)
                                    },
                                  })
                                }}
                                className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Maintenance & Routine Plans Console */}
          {facilitiesSubTab === 'maintenance' && (
            <MaintenanceRoutinesManager
              isEditModeUnlocked={isEditModeUnlocked}
              triggerToast={triggerToast}
            />
          )}

          {/* Incident Categories Full Governance Manager */}
          {facilitiesSubTab === 'categories' && (
            <IncidentCategoriesManager
              categories={incidentCategories}
              isEditModeUnlocked={isEditModeUnlocked}
              onAddCategory={addIncidentCategory}
              onUpdateCategory={updateIncidentCategory}
              onDeleteCategory={deleteIncidentCategory}
              onDeactivateCategory={deactivateIncidentCategory}
              onResetCategories={resetIncidentCategories}
              labs={labs}
              historicalIncidents={incidents}
              triggerToast={triggerToast}
            />
          )}

          {/* Incident Register */}
          {facilitiesSubTab === 'incidents' && (
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
              <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-rose-600" />
                    Real-time Incident & Damage Register
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Live audit trail of reported damages, repairs, and HOD escalations
                  </CardDescription>
                </div>
                <Link
                  href="/incidents"
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  Full Hub →
                </Link>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 font-bold uppercase text-[10.5px]">
                      <th className="py-3 px-4">Incident Case</th>
                      <th className="py-3 px-4">Lab & Batch</th>
                      <th className="py-3 px-4">Reported By</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {isIncidentsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono text-xs">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="h-5 w-5 rounded-full border-2 border-rose-500/30 border-t-rose-600 animate-spin" />
                            <span>Loading incident records...</span>
                          </div>
                        </td>
                      </tr>
                    ) : incidents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-500 font-mono text-xs">
                          No records found
                        </td>
                      </tr>
                    ) : (
                      incidents.map((i) => (
                        <tr key={i.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-950 dark:text-white text-xs">{i.title}</div>
                            <span className="text-[11px] font-mono text-zinc-400">Case #{i.id}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 uppercase font-mono">{i.lab_id} Lab</span>
                            <span className="text-[11px] text-zinc-400 block">{i.batch_name}</span>
                          </td>
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">{i.subject_teacher_name}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                i.severity === 'major_critical'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                  : i.severity === 'moderate'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                              }`}
                            >
                              {i.severity.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono uppercase font-bold text-xs">
                            {i.status.replace('_', ' ')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedIncident(i)
                                setIsIncidentDrawerOpen(true)
                              }}
                              className="h-7 px-2.5 text-xs font-semibold"
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* --- SECTION 4: OPERATIONS, CALENDAR & DISASTER RECOVERY --- */}
      {activeCategory === 'operations' && (
        <div className="space-y-5">
          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 w-fit">
            <button
              type="button"
              onClick={() => setOperationsSubTab('calendar')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                operationsSubTab === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Academic Calendar & Holidays
            </button>
            <button
              type="button"
              onClick={() => setOperationsSubTab('notifications')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                operationsSubTab === 'notifications'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Email Notification Engine
            </button>
            <button
              type="button"
              onClick={() => setOperationsSubTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                operationsSubTab === 'audit'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Institutional Audit Trail
            </button>
            <button
              type="button"
              onClick={() => setOperationsSubTab('recovery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                operationsSubTab === 'recovery'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Disaster Recovery & Snapshots
            </button>
          </div>

          {/* Academic Calendar & Dual Date Picker */}
          {operationsSubTab === 'calendar' && (
            <div className="space-y-5">
              {/* Weekly Recess Governance & Weekend Policy Controls */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
                <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <Palmtree className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                          <span>Institutional Recess & Weekly Off Policy</span>
                          <Badge variant="outline" className="font-mono text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30">
                            Governance
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-500 font-mono">
                          Configure weekly off days, Sunday recess status, and statutory Saturday holiday enforcement.
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Toggle 1: Sunday as Institutional Recess */}
                  <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col justify-between gap-3 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                          Sunday Recess Policy
                        </span>
                        <Badge
                          className={`font-mono text-[10px] font-bold ${
                            sundayWeekend
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {sundayWeekend ? 'Recess Active (Weekend)' : 'Active Practical Day'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                        In Nepal, Sunday is standard working day. Toggle this <strong className="text-zinc-800 dark:text-zinc-200">ON</strong> to declare Sunday as an institutional recess (suspending practical routines and classes on Sundays).
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {sundayWeekend ? 'Recess Active' : 'Active Practical Day'}
                      </span>
                      <Switch
                        checked={sundayWeekend}
                        onCheckedChange={(checked) => {
                          requestDangerAction({
                            title: checked
                              ? 'Declare Sunday as Institutional Recess?'
                              : 'Reactivate Sunday Practical Sessions?',
                            description: checked
                              ? 'This marks Sunday as a weekly off and automatically suspends practical sessions across all laboratories.'
                              : 'This marks Sunday as an active academic day and resumes timetable scheduling across all laboratories.',
                            impactMessage: checked
                              ? 'Scheduled timetable slots for Sunday will be suppressed from the daily practical schedule.'
                              : 'Sunday practical sessions will reappear in the weekly schedule and daily rosters.',
                            itemType: 'policy',
                            confirmLabel: checked ? 'Declare Sunday Recess' : 'Reactivate Sunday Sessions',
                            variant: checked ? 'amber' : 'indigo',
                            onConfirm: () => {
                              const prev = sundayWeekend
                              updateSettings({ sundayWeekend: checked })
                              recordClientAuditEvent({
                                action: 'UPDATE',
                                entityType: 'policy',
                                entityLabel: 'Sunday Recess Governance Policy',
                                before: { sunday_recess: prev },
                                after: { sunday_recess: checked },
                                metadata: { policy_type: 'sunday_weekend_recess' },
                              }).catch(() => {})
                              setToastMessage(
                                checked
                                  ? 'Sunday configured as Institutional Recess'
                                  : 'Sunday configured as Active Practical Day'
                              )
                              setDangerModal((prev) => ({ ...prev, isOpen: false }))
                            },
                          })
                        }}
                        aria-label="Toggle Sunday Institutional Recess"
                      />
                    </div>
                  </div>

                  {/* Toggle 2: Saturday as Weekly Holiday */}
                  <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col justify-between gap-3 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono uppercase tracking-wide">
                          Saturday Weekly Holiday
                        </span>
                        <Badge
                          className={`font-mono text-[10px] font-bold ${
                            saturdayWeekend
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {saturdayWeekend ? 'Official Weekly Off' : 'Working Day'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                        Official statutory weekly holiday in Nepal. When active, all laboratories are officially marked as Recess and routine sessions are automatically suspended on Saturdays.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {saturdayWeekend ? 'Official Weekly Off' : 'Working Day'}
                      </span>
                      <Switch
                        checked={saturdayWeekend}
                        onCheckedChange={(checked) => {
                          requestDangerAction({
                            title: checked
                              ? 'Enforce Saturday Statutory Holiday?'
                              : 'Enable Saturday Laboratory Operations?',
                            description: checked
                              ? 'This marks Saturday as an official holiday and suspends laboratory operations.'
                              : 'This permits practical sessions and bookings to take place on Saturdays.',
                            impactMessage: checked
                              ? 'All laboratories will be marked as Recess and routine bookings suspended on Saturdays.'
                              : 'Saturday timetable slots and operational lab sessions will be permitted.',
                            itemType: 'policy',
                            confirmLabel: checked ? 'Enforce Saturday Holiday' : 'Enable Saturday Operations',
                            variant: checked ? 'amber' : 'indigo',
                            onConfirm: () => {
                              const prev = saturdayWeekend
                              updateSettings({ saturdayWeekend: checked })
                              recordClientAuditEvent({
                                action: 'UPDATE',
                                entityType: 'policy',
                                entityLabel: 'Saturday Statutory Holiday Policy',
                                before: { saturday_statutory_holiday: prev },
                                after: { saturday_statutory_holiday: checked },
                                metadata: { policy_type: 'saturday_statutory_holiday' },
                              }).catch(() => {})
                              setToastMessage(
                                checked
                                  ? 'Saturday configured as Official Weekly Off'
                                  : 'Saturday configured as Working Day'
                              )
                              setDangerModal((prev) => ({ ...prev, isOpen: false }))
                            },
                          })
                        }}
                        aria-label="Toggle Saturday Weekly Holiday"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DualCalendarPicker
                holidays={holidays}
                onAddHoliday={addHoliday}
                onDeleteHoliday={deleteHoliday}
                onResetHolidays={resetHolidaysToOfficialGazette}
                sundayWeekend={sundayWeekend}
                saturdayWeekend={saturdayWeekend}
                isEditModeUnlocked={isEditModeUnlocked}
              />
            </div>
          )}

          {/* Email Notification Engine */}
          {operationsSubTab === 'notifications' && (
            <EmailNotificationManager />
          )}

          {/* Institutional Audit Trail */}
          {operationsSubTab === 'audit' && (
            <InstitutionalAuditManager />
          )}

          {/* Disaster Recovery Suite */}
          {operationsSubTab === 'recovery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: 1-Click Snapshot Export */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                      <HardDriveDownload className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white">
                        Cryptographic Snapshot Export
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        1-click export of complete system state with SHA-256 integrity hash
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-xs">
                  <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    Generates an air-gapped, encrypted JSON snapshot containing all active timetable periods, laboratory rooms, class enrollments, subject mappings, institutional holidays, and governance settings.
                  </p>

                  {snapshotIntegrityHash && (
                    <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px] space-y-1">
                      <span className="text-zinc-500 font-bold block">Latest SHA-256 Checksum:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 break-all font-semibold">
                        {snapshotIntegrityHash}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={handleExportSnapshot}
                    disabled={isExporting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 py-2.5 shadow-sm cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>{isExporting ? 'Generating...' : 'Export Complete Snapshot'}</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Safe Snapshot Restoration */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <HardDriveUpload className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-zinc-950 dark:text-white">
                        Disaster Recovery Restoration
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-500">
                        Restore system infrastructure from an authenticated snapshot
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Restoring a snapshot will overwrite active periods, rooms, classes, and calendar rules. Requires typing <strong>RESTORE</strong> to confirm.
                    </p>
                  </div>

                  <label
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed transition-all font-bold text-xs ${
                      isEditModeUnlocked
                        ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50 cursor-pointer'
                        : 'border-zinc-300 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Choose Snapshot JSON to Restore</span>
                    <input
                      type="file"
                      accept=".json"
                      disabled={!isEditModeUnlocked}
                      onChange={handleImportSnapshot}
                      className="hidden"
                    />
                  </label>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Add / Edit Laboratory Modal */}
      {(isAddLabOpen || editingLab) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                <span>{editingLab ? `Edit Laboratory: ${editingLab.name}` : 'Register New Laboratory'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddLabOpen(false)
                  setEditingLab(null)
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLab} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Facility Name *</label>
                <Input
                  required
                  placeholder="e.g. Advanced Physics Laboratory"
                  value={labFormName}
                  onChange={(e) => setLabFormName(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Room Code *</label>
                  <Input
                    required
                    placeholder="e.g. PHYS-201"
                    value={labFormCode}
                    onChange={(e) => setLabFormCode(e.target.value)}
                    className="h-8.5 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Station Capacity</label>
                  <Input
                    type="number"
                    min="1"
                    max="150"
                    value={labFormCapacity}
                    onChange={(e) => setLabFormCapacity(parseInt(e.target.value) || 40)}
                    className="h-8.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Facility Type</label>
                  <Select
                    value={labFormType}
                    onChange={(e) => setLabFormType(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    <option value="computer_lab">Computer Lab</option>
                    <option value="physics_lab">Physics Lab</option>
                    <option value="chemistry_lab">Chemistry Lab</option>
                    <option value="biology_lab">Biology Lab</option>
                    <option value="electronics_lab">Electronics Lab</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Status</label>
                  <Select
                    value={labFormStatus}
                    onChange={(e) => setLabFormStatus(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddLabOpen(false)
                    setEditingLab(null)
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  {editingLab ? 'Save Modifications' : 'Register Facility'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Class Modal */}
      {(isAddClassOpen || editingClass) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>{editingClass ? `Edit Class: ${editingClass.name}` : 'Enroll Class Batch'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddClassOpen(false)
                  setEditingClass(null)
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Grade Level *</label>
                  <Input
                    required
                    placeholder="e.g. Class 12"
                    value={classFormName}
                    onChange={(e) => setClassFormName(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Section *</label>
                  <Input
                    required
                    placeholder="e.g. Section C"
                    value={classFormSection}
                    onChange={(e) => setClassFormSection(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Student Count</label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={classFormCapacity}
                    onChange={(e) => setClassFormCapacity(parseInt(e.target.value) || 40)}
                    className="h-8.5 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Stream</label>
                  <Input
                    placeholder="e.g. Science Stream"
                    value={classFormStream}
                    onChange={(e) => setClassFormStream(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddClassOpen(false)
                    setEditingClass(null)
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  {editingClass ? 'Save Modifications' : 'Enroll Batch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Subject Modal */}
      {(isAddSubjectOpen || editingSubject) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-500" />
                <span>{editingSubject ? `Edit Subject: ${editingSubject.code}` : 'Register Curriculum Subject'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddSubjectOpen(false)
                  setEditingSubject(null)
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Subject Title *</label>
                <Input
                  required
                  placeholder="e.g. Organic Chemistry Practical"
                  value={subFormTitle}
                  onChange={(e) => setSubFormTitle(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Course Code *</label>
                  <Input
                    required
                    placeholder="e.g. CHEM-12SC"
                    value={subFormCode}
                    onChange={(e) => setSubFormCode(e.target.value)}
                    className="h-8.5 text-xs font-mono font-bold uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Grade Level / Class *</label>
                  <Select
                    value={subFormGrade}
                    onChange={(e) => setSubFormGrade(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    {classes.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name} {c.stream ? `— ${c.stream}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Designated Facility</label>
                  <Select
                    value={subFormLabId}
                    onChange={(e) => setSubFormLabId(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Lead Faculty Teacher</label>
                  <Select
                    value={subFormTeacherId}
                    onChange={(e) => setSubFormTeacherId(e.target.value)}
                    className="h-8.5 text-xs font-sans"
                  >
                    {faculty.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Syllabus Quota (Total Experiments)</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={subFormQuota}
                  onChange={(e) => setSubFormQuota(parseInt(e.target.value) || 25)}
                  className="h-8.5 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddSubjectOpen(false)
                    setEditingSubject(null)
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  {editingSubject ? 'Save Modifications' : 'Register Subject'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Period Slot Modal */}
      {(isAddPeriodOpen || editingPeriod) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span>{editingPeriod ? `Edit Period: ${editingPeriod.name}` : 'Add Timetable Period Slot'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddPeriodOpen(false)
                  setEditingPeriod(null)
                }}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePeriod} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">Period Slot Name *</label>
                <Input
                  required
                  placeholder="e.g. Period 2 or Recess / Lunch"
                  value={periodFormName}
                  onChange={(e) => setPeriodFormName(e.target.value)}
                  className="h-8.5 text-xs font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">Start Time</label>
                  <Input
                    type="time"
                    value={periodFormStart}
                    onChange={(e) => setPeriodFormStart(e.target.value)}
                    className="h-8.5 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">End Time</label>
                  <Input
                    type="time"
                    value={periodFormEnd}
                    onChange={(e) => setPeriodFormEnd(e.target.value)}
                    className="h-8.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAddPeriodOpen(false)
                    setEditingPeriod(null)
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  {editingPeriod ? 'Save Modifications' : 'Create Period'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Review Drawer */}
      {selectedIncident && (
        <IncidentDrawer
          incident={selectedIncident}
          isOpen={isIncidentDrawerOpen}
          onClose={() => {
            setIsIncidentDrawerOpen(false)
            setSelectedIncident(null)
          }}
          userRole="super_admin"
        />
      )}

      {/* Danger & Policy Confirmation Modal */}
      {dangerModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  dangerModal.variant === 'indigo'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : dangerModal.variant === 'amber'
                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-600 border-rose-200'
                }`}
              >
                {dangerModal.variant === 'indigo' ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  {dangerModal.title}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  {dangerModal.description}
                </p>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                dangerModal.variant === 'indigo'
                  ? 'bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200'
                  : dangerModal.variant === 'amber'
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
              }`}
            >
              <strong>Impact:</strong> {dangerModal.impactMessage}
            </div>

            {dangerModal.requiresTypedConfirmation && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  Type <strong className="font-mono text-zinc-900 dark:text-zinc-100">{dangerModal.typedConfirmationWord}</strong> to proceed:
                </label>
                <Input
                  value={typedConfirmInput}
                  onChange={(e) => setTypedConfirmInput(e.target.value)}
                  placeholder={`Type "${dangerModal.typedConfirmationWord}"`}
                  className="h-8.5 font-mono text-xs font-bold uppercase"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDangerModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  dangerModal.requiresTypedConfirmation &&
                  typedConfirmInput.trim().toUpperCase() !== dangerModal.typedConfirmationWord?.toUpperCase()
                }
                onClick={dangerModal.onConfirm}
                className={`font-bold text-xs cursor-pointer ${
                  dangerModal.variant === 'indigo'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : dangerModal.variant === 'amber'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {dangerModal.confirmLabel || (dangerModal.itemType === 'policy' ? 'Confirm Setting' : 'Confirm Action')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
