'use client'

import React, { useState } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useCalendarSettings } from '@/hooks/use-calendar-settings'
import {
  useInfrastructureState,
  PeriodSlotItem,
  LabFacilityItem,
  ClassEnrollmentItem,
  FacultyMemberItem,
  SubjectCurriculumItem
} from '@/hooks/use-infrastructure-state'
import DualCalendarPicker from '@/components/admin/dual-calendar-picker'
import { HolidayItem } from '@/lib/master-data'
import { useIncidentState, LabIncidentRecord } from '@/hooks/use-incident-state'
import IncidentDrawer from '@/components/dashboard/incident-drawer'

interface DangerModalState {
  isOpen: boolean
  title: string
  description: string
  impactMessage: string
  itemType: 'lab' | 'class' | 'period' | 'subject' | 'faculty' | 'holiday' | 'reset' | 'category'
  itemId?: string
  requiresTypedConfirmation?: boolean
  typedConfirmationWord?: string
  onConfirm: () => void
}

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<
    'periods' | 'labs' | 'classes' | 'subjects' | 'faculty' | 'holidays' | 'snapshots' | 'incidents'
  >('subjects')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Incidents state for audit register
  const { incidents } = useIncidentState()
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
    deleteLab,
    addClass,
    deleteClass,
    addFaculty,
    deleteFaculty,
    addSubject,
    deleteSubject,
    assignTeacherToSubject,
    addHoliday,
    deleteHoliday,
    incidentCategories,
    incidentSettings,
    addIncidentCategory,
    deleteIncidentCategory,
    resetIncidentCategories,
    updateIncidentSettings,
  } = useInfrastructureState()

  // Form Inputs State
  const [newPeriodName, setNewPeriodName] = useState('')
  const [newPeriodStart, setNewPeriodStart] = useState('04:50')
  const [newPeriodEnd, setNewPeriodEnd] = useState('05:35')
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [editPeriodName, setEditPeriodName] = useState('')
  const [editPeriodLabel, setEditPeriodLabel] = useState('')

  const [newLabName, setNewLabName] = useState('')
  const [newLabCode, setNewLabCode] = useState('')
  const [newLabCapacity, setNewLabCapacity] = useState(35)
  const [newLabType, setNewLabType] = useState('biology_lab')

  const [newClassName, setNewClassName] = useState('')
  const [newClassSection, setNewClassSection] = useState('')
  const [newClassCapacity, setNewClassCapacity] = useState(36)
  const [newClassStream, setNewClassStream] = useState('Computer Engineering')

  const [newSubCode, setNewSubCode] = useState('')
  const [newSubTitle, setNewSubTitle] = useState('')
  const [newSubGrade, setNewSubGrade] = useState('12C')
  const [newSubQuota, setNewSubQuota] = useState(10)
  const [newSubLab, setNewSubLab] = useState('Computer Engineering Lab 01')
  const [newSubTeacherId, setNewSubTeacherId] = useState('t1')

  const [newFacName, setNewFacName] = useState('')
  const [newFacDept, setNewFacDept] = useState('Computer Science & Engineering')
  const [newFacRole, setNewFacRole] = useState('Faculty Member')
  const [newFacEmail, setNewFacEmail] = useState('')

  // Incident Categories & Emergency Routing Form State
  const [newCatName, setNewCatName] = useState('')
  const [newCatCode, setNewCatCode] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [newCatSeverity, setNewCatSeverity] = useState<'minor' | 'moderate' | 'major_critical'>('minor')
  const [newCatLab, setNewCatLab] = useState<'all' | 'phys' | 'chem' | 'comp'>('all')

  const [contactPhys, setContactPhys] = useState(incidentSettings?.emergencyContacts?.physEmail || 'physics.incharge@rrl.edu.np')
  const [contactChem, setContactChem] = useState(incidentSettings?.emergencyContacts?.chemEmail || 'chemistry.incharge@rrl.edu.np')
  const [contactComp, setContactComp] = useState(incidentSettings?.emergencyContacts?.compEmail || 'computer.incharge@rrl.edu.np')
  const [contactHod, setContactHod] = useState(incidentSettings?.emergencyContacts?.hodEmail || 'hod.science@rrl.edu.np')
  const [autoEscalateHOD, setAutoEscalateHOD] = useState(incidentSettings?.autoEscalateMajorToHOD ?? true)

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Precaution Guard helper: returns false if edit mode is locked
  const requireEditMode = (): boolean => {
    if (!isEditModeUnlocked) {
      triggerToast('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top to modify infrastructure.')
      return false
    }
    return true
  }

  // Prompt Danger Modal
  const requestDangerAction = (config: Omit<DangerModalState, 'isOpen'>) => {
    if (!requireEditMode()) return
    setTypedConfirmInput('')
    setDangerModal({
      ...config,
      isOpen: true,
    })
  }

  // --- Handlers ---
  const handleAddPeriod = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newPeriodName || !newPeriodStart || !newPeriodEnd) return

    const newP: PeriodSlotItem = {
      id: `t${periods.length + 1}`,
      name: newPeriodName,
      label: `${newPeriodStart} - ${newPeriodEnd}`,
    }

    addPeriod(newP)
    setNewPeriodName('')
    triggerToast(`Added timetable period "${newP.name}" (${newP.label})!`)
  }

  const handleDeletePeriod = (id: string, name: string) => {
    if (periods.length <= 4) {
      triggerToast('Cannot delete below minimum 4 academic periods.')
      return
    }

    requestDangerAction({
      title: `Delete Period: ${name}`,
      description: `You are about to remove period ${name} from the master schedule structure.`,
      impactMessage: 'Any practical session scheduled in this slot will be unassigned or shifted.',
      itemType: 'period',
      itemId: id,
      onConfirm: () => {
        deletePeriod(id)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Timetable period "${name}" removed.`)
      },
    })
  }

  const handleSaveEditPeriod = (id: string) => {
    if (!requireEditMode()) return
    updatePeriod(id, { name: editPeriodName, label: editPeriodLabel })
    setEditingPeriodId(null)
    triggerToast('Period slot details updated.')
  }

  const handleAddLab = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newLabName || !newLabCode) return

    const newLab: LabFacilityItem = {
      id: newLabCode.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: newLabName,
      code: newLabCode.toUpperCase(),
      capacity: newLabCapacity,
      type: newLabType,
      status: 'Operational',
    }

    addLab(newLab)
    setNewLabName('')
    setNewLabCode('')
    triggerToast(`Added laboratory "${newLab.name}" (${newLab.code})!`)
  }

  const handleDeleteLab = (lab: LabFacilityItem) => {
    requestDangerAction({
      title: `Decommission Laboratory: ${lab.name}`,
      description: `Are you sure you want to delete ${lab.name} (${lab.code})?`,
      impactMessage: 'All workstation telemetry and real-time room occupancy monitors for this facility will be removed.',
      itemType: 'lab',
      itemId: lab.id,
      onConfirm: () => {
        deleteLab(lab.id)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Laboratory ${lab.name} removed.`)
      },
    })
  }

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newClassName) return

    const cleanCode = newClassName.toUpperCase().replace(/\s+/g, '')
    const newCls: ClassEnrollmentItem = {
      id: `c-${cleanCode.toLowerCase()}`,
      name: cleanCode,
      section: newClassSection || `${cleanCode} Batch`,
      capacity: newClassCapacity,
      stream: newClassStream,
    }

    addClass(newCls)
    setNewClassName('')
    setNewClassSection('')
    triggerToast(`Added class "${newCls.name}" with capacity of ${newCls.capacity}!`)
  }

  const handleDeleteClass = (cls: ClassEnrollmentItem) => {
    requestDangerAction({
      title: `Remove Class Batch: ${cls.name}`,
      description: `You are removing batch ${cls.name} (${cls.section}) with ${cls.capacity} students.`,
      impactMessage: 'Student headcounts for this batch will no longer auto-populate in practical attendance modals.',
      itemType: 'class',
      itemId: cls.id,
      onConfirm: () => {
        deleteClass(cls.id)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Removed batch ${cls.name}.`)
      },
    })
  }

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newSubCode || !newSubTitle) return

    const targetTeacher = faculty.find((f) => f.id === newSubTeacherId)
    const targetLab = labs.find((l) => l.name === newSubLab) || labs[0]

    const newSub: SubjectCurriculumItem = {
      code: newSubCode.toUpperCase().trim(),
      title: newSubTitle.trim(),
      grade: newSubGrade,
      quota: newSubQuota,
      lab: targetLab.name,
      labId: targetLab.id,
      teacherId: newSubTeacherId,
      teacherName: targetTeacher ? targetTeacher.name : 'Assigned Faculty',
    }

    addSubject(newSub)
    // Also bind to teacher in-charge
    assignTeacherToSubject(newSub.code, newSubTeacherId)

    setNewSubCode('')
    setNewSubTitle('')
    triggerToast(`Added curriculum subject "${newSub.code}" assigned to ${newSub.teacherName}!`)
  }

  const handleDeleteSubject = (sub: SubjectCurriculumItem) => {
    requestDangerAction({
      title: `Delete Subject: ${sub.code}`,
      description: `Removing ${sub.code} — ${sub.title}.`,
      impactMessage: 'Syllabus progress bars and timetable bookings for this subject will be cleared.',
      itemType: 'subject',
      onConfirm: () => {
        deleteSubject(sub.code)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Subject ${sub.code} deleted.`)
      },
    })
  }

  const handleAddFaculty = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newFacName) return

    const newFac: FacultyMemberItem = {
      id: `t${faculty.length + 1}-${Date.now().toString().slice(-4)}`,
      name: newFacName.trim(),
      dept: newFacDept,
      role: newFacRole,
      email: newFacEmail || `${newFacName.toLowerCase().replace(/[^a-z]/g, '')}@rrl.edu.np`,
      assignedSubjectCodes: [],
    }

    addFaculty(newFac)
    setNewFacName('')
    setNewFacEmail('')
    triggerToast(`Registered faculty "${newFac.name}" (${newFac.role})!`)
  }

  const handleDeleteFaculty = (fac: FacultyMemberItem) => {
    requestDangerAction({
      title: `Remove Faculty Member: ${fac.name}`,
      description: `Removing ${fac.name} from ${fac.dept}.`,
      impactMessage: 'Any subjects assigned to this instructor will require reassignment to a new faculty in-charge.',
      itemType: 'faculty',
      onConfirm: () => {
        deleteFaculty(fac.id)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Faculty member ${fac.name} removed.`)
      },
    })
  }

  // --- Disaster Recovery: Export Snapshot JSON ---
  const handleExportBackup = () => {
    const backupData = {
      system: 'LMR Academic Laboratory Management System',
      version: '2.5.0',
      academicYear: '2083 B.S. / 2026 A.D.',
      exportedAt: new Date().toISOString(),
      periods,
      labs,
      classes,
      subjects,
      faculty,
      holidays,
      calendarSettings: { startDay, sundayWeekend, saturdayWeekend },
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `lmr_institutional_backup_2083_${new Date().toISOString().split('T')[0]}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    triggerToast('Institutional system snapshot exported and downloaded safely.')
  }

  // --- Disaster Recovery: Import Snapshot JSON ---
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireEditMode()) return
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        if (parsed && parsed.periods && parsed.labs) {
          requestDangerAction({
            title: 'Restore Complete System Backup',
            description: `You are about to overwrite all current admin infrastructure with the backup exported on ${parsed.exportedAt || 'previous session'}.`,
            impactMessage: 'All lab rooms, period definitions, classes, faculty, and subjects will be synchronized to the snapshot.',
            itemType: 'reset',
            requiresTypedConfirmation: true,
            typedConfirmationWord: 'RESTORE',
            onConfirm: () => {
              if (parsed.periods) {
                localStorage.setItem('lmr_admin_periods_v2', JSON.stringify(parsed.periods))
              }
              if (parsed.labs) {
                localStorage.setItem('lmr_admin_labs_v2', JSON.stringify(parsed.labs))
              }
              if (parsed.classes) {
                localStorage.setItem('lmr_admin_classes_v2', JSON.stringify(parsed.classes))
              }
              if (parsed.subjects) {
                localStorage.setItem('lmr_admin_subjects_v2', JSON.stringify(parsed.subjects))
              }
              if (parsed.faculty) {
                localStorage.setItem('lmr_admin_faculty_v2', JSON.stringify(parsed.faculty))
              }
              if (parsed.holidays) {
                localStorage.setItem('lmr_admin_holidays_v2', JSON.stringify(parsed.holidays))
              }
              if (parsed.calendarSettings) updateSettings(parsed.calendarSettings)
              window.dispatchEvent(new Event('infrastructure-updated'))
              setDangerModal((prev) => ({ ...prev, isOpen: false }))
              triggerToast('Backup restored successfully! All systems synchronized.')
            },
          })
        } else {
          triggerToast('Invalid backup file structure.')
        }
      } catch (err) {
        triggerToast('Failed to parse backup JSON file.')
      }
    }
    reader.readAsText(file)
  }

  // --- Reset to Factory Defaults with Nuclear Confirmation ---
  const handleFactoryReset = () => {
    requestDangerAction({
      title: 'Reset Infrastructure to Factory Defaults',
      description: 'You are about to reset all periods, labs, classes, and subjects back to standard institutional defaults.',
      impactMessage: 'Any custom added classrooms, period timings, or lab facilities will be permanently removed.',
      itemType: 'reset',
      requiresTypedConfirmation: true,
      typedConfirmationWord: 'RESET',
      onConfirm: () => {
        resetPeriods()
        updateSettings({ sundayWeekend: false, startDay: 'sun' })
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast('Factory defaults restored. Standard 2083 institutional baseline loaded.')
      },
    })
  }

  // --- Incident Categories & Governance Handlers ---
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!requireEditMode()) return
    if (!newCatName.trim() || !newCatCode.trim()) return

    const sanitizedCode = newCatCode.trim().toLowerCase().replace(/\s+/g, '_')
    addIncidentCategory({
      id: `cat-${Date.now()}`,
      code: sanitizedCode,
      name: newCatName.trim(),
      description: newCatDesc.trim() || 'Laboratory apparatus damage or operational incident',
      severity: newCatSeverity,
      targetLab: newCatLab,
    })
    setNewCatName('')
    setNewCatCode('')
    setNewCatDesc('')
    triggerToast(`Incident category "${newCatName.trim()}" registered.`)
  }

  const handleDeleteCategory = (cat: any) => {
    requestDangerAction({
      title: `Delete Category: ${cat.name}`,
      description: `You are about to remove the incident category "${cat.name}" (#${cat.code}).`,
      impactMessage: 'Faculty will no longer be able to select this category when reporting damages.',
      itemType: 'category',
      itemId: cat.id,
      onConfirm: () => {
        deleteIncidentCategory(cat.id)
        setDangerModal((prev) => ({ ...prev, isOpen: false }))
        triggerToast(`Category "${cat.name}" deleted.`)
      },
    })
  }

  const handleSaveIncidentSettings = () => {
    if (!requireEditMode()) return
    updateIncidentSettings({
      autoEscalateMajorToHOD: autoEscalateHOD,
      emergencyContacts: {
        physEmail: contactPhys,
        chemEmail: contactChem,
        compEmail: contactComp,
        hodEmail: contactHod,
      },
    })
    triggerToast('Incident governance policy & emergency routing saved.')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 select-none pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-mono font-medium animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 border border-zinc-700 dark:border-zinc-300">
          <Sparkles className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🚨 EXECUTIVE COMMAND HEADER & PRECAUTION STATUS BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/95 dark:bg-zinc-900/95 p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white font-mono">
                Super-Admin Command Center
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Tier-1 Root Admin
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-sans">
              Centralized institutional governance for teachers, curriculum subjects, calendar recesses, and disaster recovery.
            </p>
          </div>
        </div>

        {/* 🔐 PRECAUTION SAFETY LOCK TOGGLE */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border transition-all ${
              isEditModeUnlocked
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 animate-pulse'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
            }`}>
              {isEditModeUnlocked ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-amber-600" />
                  <span>Admin Edit Mode Active</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Safety Guard: Protected</span>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant={isEditModeUnlocked ? 'destructive' : 'outline'}
              className={`text-xs font-mono font-bold gap-1.5 h-8 ${
                !isEditModeUnlocked ? 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''
              }`}
              onClick={() => {
                const next = !isEditModeUnlocked
                setIsEditModeUnlocked(next)
                triggerToast(next ? '⚠️ Precaution Lifted: Admin Edit Mode UNLOCKED.' : '🛡️ Safety Guard ENGAGED: Modifications protected.')
              }}
            >
              {isEditModeUnlocked ? (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Lock Editing</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-amber-500" />
                  <span>Unlock to Edit</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Warning Notice when Edit Mode is active */}
      {isEditModeUnlocked && (
        <div className="p-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-mono flex items-center justify-between animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>
              <strong>Precaution Notice:</strong> Administrative Edit Mode is currently active. Any modifications directly propagate to live timetable routines, room telemetry, and faculty registers.
            </span>
          </div>
          <button
            onClick={() => setIsEditModeUnlocked(false)}
            className="text-[11px] underline font-bold hover:text-amber-950 dark:hover:text-white"
          >
            Re-engage Lock
          </button>
        </div>
      )}

      {/* 🧭 NAVIGATION TABS */}
      <div className="flex items-center gap-1.5 p-1.5 bg-zinc-100/90 dark:bg-zinc-900/90 rounded-xl border border-zinc-200/90 dark:border-zinc-800 text-xs font-mono overflow-x-auto shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('subjects')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'subjects'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-cyan-500" />
          <span>Subjects & Teacher Allocation ({subjects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('faculty')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'faculty'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-violet-500" />
          <span>Faculty Directory ({faculty.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'holidays'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-rose-500" />
          <span>Nepali-Eng Calendar & Recesses ({holidays.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('periods')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'periods'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
          <span>Period Slots ({periods.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('labs')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'labs'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Building2 className="h-3.5 w-3.5 text-amber-500" />
          <span>Laboratories ({labs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('classes')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'classes'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-emerald-500" />
          <span>Classes & Headcounts ({classes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('snapshots')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'snapshots'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Database className="h-3.5 w-3.5 text-blue-500" />
          <span>Disaster Recovery & Snapshots</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'incidents'
              ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-bold shadow-xs'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          <span>Incident and Damage</span>
        </button>
      </div>

      {/* 1. SUBJECTS & TEACHER ALLOCATION TAB */}
      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-cyan-500" />
                  Practical Curriculum Subjects & Assigned Faculty In-Charge
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Every practical curriculum item is assigned to a certified faculty member. When booked in the routine, the assigned instructor is auto-selected.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {subjects.map((s) => {
                  const currentTeacher = faculty.find((f) => f.id === s.teacherId)
                  return (
                    <div
                      key={s.code}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-zinc-950 dark:text-white px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            {s.code}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-sans">
                            {s.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">
                          Batch: <strong>{s.grade}</strong> • Facility: {s.lab} • Term Quota: <strong>{s.quota} Practicals</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Inline Teacher In-Charge Selector */}
                        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/60 p-1 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <UserCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <Select
                            value={s.teacherId}
                            disabled={!isEditModeUnlocked}
                            onChange={(e) => {
                              assignTeacherToSubject(s.code, e.target.value)
                              const t = faculty.find((f) => f.id === e.target.value)
                              triggerToast(`Assigned ${s.code} to ${t?.name || 'Faculty'}!`)
                            }}
                            className="h-7 text-xs font-mono border-none bg-transparent shadow-none p-0 focus:ring-0 cursor-pointer w-44"
                          >
                            {faculty.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name} ({f.dept.split(' ')[0]})
                              </option>
                            ))}
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isEditModeUnlocked}
                          className="h-7 text-xs text-rose-500 hover:text-rose-700"
                          onClick={() => handleDeleteSubject(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-cyan-500" />
                  Register Subject & Assign Teacher
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddSubject} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Sub-Class Code *</label>
                    <Input
                      type="text"
                      required
                      value={newSubCode}
                      onChange={(e) => setNewSubCode(e.target.value)}
                      placeholder="e.g. PHY-11C or COM-6A"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Syllabus Title *</label>
                    <Input
                      type="text"
                      required
                      value={newSubTitle}
                      onChange={(e) => setNewSubTitle(e.target.value)}
                      placeholder="e.g. Optics & Wave Mechanics"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Assigned Faculty In-Charge *</label>
                    <Select
                      value={newSubTeacherId}
                      onChange={(e) => setNewSubTeacherId(e.target.value)}
                    >
                      {faculty.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} — {f.dept}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">Assigned Batch</label>
                      <Select
                        value={newSubGrade}
                        onChange={(e) => setNewSubGrade(e.target.value)}
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">Term Quota</label>
                      <Input
                        type="number"
                        min="1"
                        value={newSubQuota}
                        onChange={(e) => setNewSubQuota(parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Designated Facility</label>
                    <Select
                      value={newSubLab}
                      onChange={(e) => setNewSubLab(e.target.value)}
                    >
                      {labs.map((l) => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))}
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isEditModeUnlocked}
                    className="w-full mt-2 font-bold gap-1 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Subject & Teacher</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. FACULTY DIRECTORY & ASSIGNED WORKLOAD TAB */}
      {activeTab === 'faculty' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Institutional Faculty Roster & Allocated Teaching Workload
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Instructors manage scheduled sessions, sign off on daily print sheets, and oversee laboratory safety compliance.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {faculty.map((f) => {
                  const assignedSubs = subjects.filter((s) => s.teacherId === f.id)
                  const totalQuota = assignedSubs.reduce((acc, curr) => acc + curr.quota, 0)

                  return (
                    <div
                      key={f.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-950 dark:text-white">
                            {f.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-bold">
                            {f.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1">
                          Dept: {f.dept} • Email: {f.email}
                        </div>

                        {/* Assigned Subjects Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-zinc-500 font-bold">Assigned Practicals:</span>
                          {assignedSubs.length === 0 ? (
                            <span className="text-[10px] text-zinc-400 italic">None assigned</span>
                          ) : (
                            assignedSubs.map((sub) => (
                              <Badge key={sub.code} variant="outline" className="text-[10px] font-mono font-extrabold bg-zinc-50 dark:bg-zinc-800">
                                {sub.code} ({sub.quota}P)
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right font-mono text-[11px]">
                          <span className="text-zinc-500">Term Load:</span>
                          <div className="font-extrabold text-indigo-600 dark:text-indigo-400">
                            {assignedSubs.length} Subjects • {totalQuota} Practicals
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!isEditModeUnlocked}
                          className="h-7 text-xs text-rose-500 hover:text-rose-700 ml-2"
                          onClick={() => handleDeleteFaculty(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-violet-500" />
                  Enroll Faculty Member
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddFaculty} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Full Name *</label>
                    <Input
                      type="text"
                      required
                      value={newFacName}
                      onChange={(e) => setNewFacName(e.target.value)}
                      placeholder="e.g. Er. Subash Adhikari"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Department</label>
                    <Select
                      value={newFacDept}
                      onChange={(e) => setNewFacDept(e.target.value)}
                    >
                      <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                      <option value="Physics Department">Physics Department</option>
                      <option value="Chemistry Department">Chemistry Department</option>
                      <option value="Biology & Life Sciences">Biology & Life Sciences</option>
                      <option value="Electronics & Hardware">Electronics & Hardware</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Designation / Role</label>
                    <Select
                      value={newFacRole}
                      onChange={(e) => setNewFacRole(e.target.value)}
                    >
                      <option value="Lab In-Charge">Lab In-Charge</option>
                      <option value="Senior Faculty">Senior Faculty</option>
                      <option value="Faculty Member">Faculty Member</option>
                      <option value="Lab Assistant">Lab Assistant</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
                    <Input
                      type="email"
                      value={newFacEmail}
                      onChange={(e) => setNewFacEmail(e.target.value)}
                      placeholder="e.g. s.adhikari@rrl.edu.np"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isEditModeUnlocked}
                    className="w-full mt-2 font-bold gap-1 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Faculty</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. DUAL NEPALI + ENGLISH CALENDAR & RECESSES TAB */}
      {activeTab === 'holidays' && (
        <div className="space-y-6">
          {/* Policy Toggle Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sunday Recess Policy Control */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-950 dark:text-white font-mono text-sm">Sunday (आइतवार) Recess Policy</span>
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                    sundayWeekend
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  }`}>
                    {sundayWeekend ? 'Holiday (Starts Monday)' : 'Active Working Day (Starts Sunday)'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-sans">
                  {sundayWeekend
                    ? 'Sunday is marked as a weekend holiday. Weekly routine automatically starts from Monday.'
                    : 'Sunday is an active school day. Weekly routine automatically starts from Sunday (National standard in Nepal).'}
                </p>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={!isEditModeUnlocked}
                  variant={sundayWeekend ? 'default' : 'outline'}
                  className={sundayWeekend ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : 'font-bold text-emerald-600 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}
                  onClick={() => {
                    const next = !sundayWeekend
                    updateSettings({ sundayWeekend: next, startDay: next ? 'mon' : 'sun' })
                    triggerToast(
                      next
                        ? 'Sunday marked as Weekend Holiday. Schedule now starts on Monday.'
                        : 'Sunday marked as Active Working Day. Schedule now starts on Sunday.'
                    )
                  }}
                >
                  {sundayWeekend ? 'Mark Active Day' : 'Mark as Holiday'}
                </Button>
              </div>
            </div>

            {/* Saturday Mandatory Off */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-950 dark:text-white font-mono text-sm">Saturday (शनिबार) Mandatory Off</span>
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                    National Weekend Recess
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-sans">
                  Saturday is recognized as the national statutory weekend recess across all educational institutions in Nepal.
                </p>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={!isEditModeUnlocked}
                  variant={saturdayWeekend ? 'default' : 'outline'}
                  className={saturdayWeekend ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold' : 'font-bold text-emerald-600 border-emerald-500/40'}
                  onClick={() => {
                    const next = !saturdayWeekend
                    updateSettings({ saturdayWeekend: next })
                    triggerToast('Saturday weekend policy updated.')
                  }}
                >
                  {saturdayWeekend ? 'Weekend Off' : 'Active Day'}
                </Button>
              </div>
            </div>
          </div>

          {/* DUAL NEPALI + ENGLISH CALENDAR PICKER & VACATION RANGE MARKER */}
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-rose-500" />
                    Interactive Dual Nepali (B.S. 2083) & English (A.D. 2026) Calendar
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Click any single date or select a <strong>Start Date ➔ End Date range</strong> directly on the calendar grid to mark institutional vacations and festivals.
                  </CardDescription>
                </div>

                <Badge variant="outline" className="font-mono text-[10px] w-fit">
                  {holidays.length} Scheduled Recesses
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <DualCalendarPicker
                holidays={holidays}
                onAddHoliday={(h) => {
                  addHoliday(h)
                  triggerToast(`Marked calendar recess: "${h.title}"!`)
                }}
                onDeleteHoliday={(id) => {
                  deleteHoliday(id)
                  triggerToast('Calendar recess removed.')
                }}
                sundayWeekend={sundayWeekend}
                isEditModeUnlocked={isEditModeUnlocked}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. PERIOD SLOTS TAB */}
      {activeTab === 'periods' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-500" />
                    Master Timetable Period Slots
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Bell timings configured here control the 10-track multi-column grid across the entire timetable.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-mono gap-1"
                  disabled={!isEditModeUnlocked}
                  onClick={() => {
                    requestDangerAction({
                      title: 'Reset Timetable Periods to Default',
                      description: 'Reset periods back to the standard institutional bell slots.',
                      impactMessage: 'Any custom period duration overrides will be reverted.',
                      itemType: 'period',
                      onConfirm: () => {
                        resetPeriods()
                        setDangerModal((prev) => ({ ...prev, isOpen: false }))
                        triggerToast('Reset to standard institutional period slots.')
                      },
                    })
                  }}
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Default</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {periods.map((slot) => {
                  const isEditing = editingPeriodId === slot.id
                  return (
                    <div
                      key={slot.id}
                      className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex-1 mr-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editPeriodName}
                              onChange={(e) => setEditPeriodName(e.target.value)}
                              className="h-7 text-xs w-36"
                              placeholder="Period Name"
                            />
                            <Input
                              value={editPeriodLabel}
                              onChange={(e) => setEditPeriodLabel(e.target.value)}
                              className="h-7 text-xs w-48"
                              placeholder="10:10 - 11:00"
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleSaveEditPeriod(slot.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setEditingPeriodId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-950 dark:text-white">
                              {slot.name}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-bold">
                              {slot.label}
                            </span>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isEditModeUnlocked}
                            className="h-7 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            onClick={() => {
                              setEditingPeriodId(slot.id)
                              setEditPeriodName(slot.name)
                              setEditPeriodLabel(slot.label)
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!isEditModeUnlocked}
                            className="h-7 text-xs text-rose-500 hover:text-rose-700"
                            onClick={() => handleDeletePeriod(slot.id, slot.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-indigo-500" />
                  Add Custom Period Slot
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddPeriod} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Period Title *</label>
                    <Input
                      type="text"
                      required
                      value={newPeriodName}
                      onChange={(e) => setNewPeriodName(e.target.value)}
                      placeholder="e.g. Evening Practical Block"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">Start Time</label>
                      <Input
                        type="time"
                        required
                        value={newPeriodStart}
                        onChange={(e) => setNewPeriodStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-700 dark:text-zinc-300">End Time</label>
                      <Input
                        type="time"
                        required
                        value={newPeriodEnd}
                        onChange={(e) => setNewPeriodEnd(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isEditModeUnlocked}
                    className="w-full mt-2 font-bold gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Append Period Slot</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 5. LABORATORIES MANAGEMENT TAB */}
      {activeTab === 'labs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Registered Laboratory Facilities & Telemetry
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Facilities configured here dynamically sync to the Live Lab Telemetry Pods on the main dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {labs.map((lab) => (
                  <div
                    key={lab.id}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-950 dark:text-white">
                          {lab.name}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {lab.code}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Workstations: <strong>{lab.capacity} Seats</strong> • Status: <span className="text-emerald-600 font-bold">{lab.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isEditModeUnlocked}
                        className="h-7 text-xs text-rose-500 hover:text-rose-700"
                        onClick={() => handleDeleteLab(lab)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-amber-500" />
                  Commission New Lab Facility
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddLab} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Facility Name *</label>
                    <Input
                      type="text"
                      required
                      value={newLabName}
                      onChange={(e) => setNewLabName(e.target.value)}
                      placeholder="e.g. Artificial Intelligence & Robotics Lab"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Room Code *</label>
                    <Input
                      type="text"
                      required
                      value={newLabCode}
                      onChange={(e) => setNewLabCode(e.target.value)}
                      placeholder="e.g. LAB-AIR-01"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Lab Category</label>
                    <Select
                      value={newLabType}
                      onChange={(e) => setNewLabType(e.target.value)}
                    >
                      <option value="computer_lab">Computer Lab</option>
                      <option value="physics_lab">Physics Lab</option>
                      <option value="chemistry_lab">Chemistry Lab</option>
                      <option value="biology_lab">Biology & Life Sciences Lab</option>
                      <option value="electronics_lab">Electronics & Hardware Lab</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Seat Capacity</label>
                    <Input
                      type="number"
                      min="1"
                      value={newLabCapacity}
                      onChange={(e) => setNewLabCapacity(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isEditModeUnlocked}
                    className="w-full mt-2 font-bold gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Facility</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 6. CLASSES & BATCHES TAB */}
      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Registered Classes & Student Batches
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  Classes use concise sub-class nomenclature (e.g. 12C, 12 Sc, 11C, 10A) and automatically supply roll call counts.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                {classes.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 flex items-center justify-between font-mono hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-zinc-950 dark:text-white px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          {c.name}
                        </span>
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">
                          {c.section}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1">
                        Stream: {c.stream} • Enrolled Students: <strong>{c.capacity}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {c.capacity} Students
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isEditModeUnlocked}
                        className="h-7 text-xs text-rose-500 hover:text-rose-700"
                        onClick={() => handleDeleteClass(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800/80">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-emerald-500" />
                  Add Academic Class / Batch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <form onSubmit={handleAddClass} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Class Code / Tag *</label>
                    <Input
                      type="text"
                      required
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="e.g. 12C / 12SC / 10A"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Section Description</label>
                    <Input
                      type="text"
                      value={newClassSection}
                      onChange={(e) => setNewClassSection(e.target.value)}
                      placeholder="e.g. Tech Stream Sec A"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Stream / Faculty</label>
                    <Input
                      type="text"
                      value={newClassStream}
                      onChange={(e) => setNewClassStream(e.target.value)}
                      placeholder="e.g. Computer Engineering"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">Student Strength</label>
                    <Input
                      type="number"
                      min="1"
                      value={newClassCapacity}
                      onChange={(e) => setNewClassCapacity(parseInt(e.target.value) || 0)}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isEditModeUnlocked}
                    className="w-full mt-2 font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Batch</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 7. DISASTER RECOVERY & SNAPSHOTS TAB */}
      {activeTab === 'snapshots' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {/* Export Snapshot Card */}
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                    <HardDriveDownload className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-mono font-bold text-zinc-950 dark:text-white">
                      Export Certified Institutional Snapshot (.json)
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Creates a complete cryptographic JSON archive of all laboratory rooms, period definitions, classes, quotas, and calendar policies.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-2">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100">Snapshot Inclusions:</div>
                  <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-400 space-y-0.5">
                    <li>{periods.length} Timetable Period definitions & bell ranges</li>
                    <li>{labs.length} Active laboratory rooms & capacity allocations</li>
                    <li>{classes.length} Academic classes & enrollment headcounts</li>
                    <li>{subjects.length} Prescribed practical subjects & assigned teachers</li>
                    <li>{faculty.length} Certified faculty & lab in-charge accounts</li>
                    <li>{holidays.length} Cultural & state academic recesses</li>
                  </ul>
                </div>

                <Button
                  onClick={handleExportBackup}
                  className="w-full sm:w-auto font-mono font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="h-4 w-4" />
                  <span>Download System Snapshot File</span>
                </Button>
              </CardContent>
            </Card>

            {/* Import Snapshot Card */}
            <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <CardHeader className="p-5 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-800">
                    <HardDriveUpload className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-mono font-bold text-zinc-950 dark:text-white">
                      Restore Institutional Snapshot (.json)
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Upload a previously exported institutional snapshot to restore system configuration.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans">
                  Requires <strong>Admin Edit Mode UNLOCKED</strong>. Before applying, you will be prompted to verify the snapshot contents.
                </p>

                <div className="flex items-center gap-3">
                  <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                    isEditModeUnlocked
                      ? 'bg-violet-600 hover:bg-violet-700 text-white cursor-pointer shadow-xs'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  }`}>
                    <Upload className="h-4 w-4" />
                    <span>Select Backup File (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      disabled={!isEditModeUnlocked}
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-4">
            {/* Factory Reset Danger Zone */}
            <Card className="border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10 shadow-2xs">
              <CardHeader className="p-4 border-b border-rose-100 dark:border-rose-900/40">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  Danger Zone: Factory Reset
                </CardTitle>
                <CardDescription className="text-[11px] text-zinc-500">
                  High-precaution nuclear reset to factory institutional baseline.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 font-mono text-xs">
                <p className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                  Restores standard 2083 periods and sets Sunday back to standard working day. Requires typing typed confirmation.
                </p>

                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!isEditModeUnlocked}
                  onClick={handleFactoryReset}
                  className="w-full font-bold gap-1.5 bg-rose-600 hover:bg-rose-700"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Factory Reset System</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 8. APPARATUS BREAKAGE & INCIDENTS AUDIT TAB */}
      {/* 6. INCIDENT AND DAMAGE GOVERNANCE TAB */}
      {/* 6. INCIDENT AND DAMAGE GOVERNANCE & SETTINGS TAB */}
      {activeTab === 'incidents' && (
        <div className="space-y-6 animate-in fade-in duration-150 font-mono">
          {/* Header Bar with Metrics & Single Clean CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 px-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/90 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                  Incident and Damage Core Settings & Governance
                </h2>
                <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                  Configure apparatus damage classifications, auto-escalation thresholds, and emergency routing contacts.
                </p>
              </div>
            </div>

            {/* Single Clean Link to Live Register */}
            <Link href="/incidents">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs font-mono font-bold text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900/60 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5 shadow-2xs shrink-0"
              >
                <span>Live Register Feed ({incidents.length})</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* 3 Metric Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 px-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 uppercase font-bold">Configured Categories</span>
              <div className="text-xl font-black text-zinc-950 dark:text-white mt-0.5">
                {incidentCategories.length} Active
              </div>
              <span className="text-[10px] text-zinc-500 font-sans">Used in all reporting dropdowns</span>
            </div>

            <div className="p-3.5 px-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 uppercase font-bold">Total Incident History</span>
              <div className="text-xl font-black text-zinc-950 dark:text-white mt-0.5">
                {incidents.length} Logged
              </div>
              <span className="text-[10px] text-zinc-500 font-sans">Physics, Chemistry & Computer Labs</span>
            </div>

            <div className="p-3.5 px-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[10px] text-zinc-400 uppercase font-bold">HOD Auto-Escalation</span>
              <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {autoEscalateHOD ? 'Enforced' : 'Manual'}
              </div>
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-sans font-medium">
                {autoEscalateHOD ? 'Major/Critical routed to Head' : 'Manual routing only'}
              </span>
            </div>
          </div>

          {/* Two-Column Management Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): Categories List + Emergency Routing */}
            <div className="lg:col-span-8 space-y-6">
              {/* 1. Incident Categories Management Card */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
                <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Settings className="h-4 w-4 text-indigo-500" />
                      Apparatus Damage & Incident Classifications
                    </CardTitle>
                    <CardDescription className="text-[11px] text-zinc-500">
                      Standardized failure categories shown to faculty and assistants when reporting lab damage.
                    </CardDescription>
                  </div>

                  <Badge variant="outline" className="font-mono text-[10px]">
                    {incidentCategories.length} Categories
                  </Badge>
                </CardHeader>

                <CardContent className="p-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {incidentCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-zinc-950 dark:text-white">
                            {cat.name}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-mono font-semibold">
                            #{cat.code}
                          </span>
                          <Badge
                            className={`text-[9px] uppercase font-mono ${
                              cat.severity === 'major_critical'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                                : cat.severity === 'moderate'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                            }`}
                          >
                            {cat.severity.replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-zinc-400 uppercase font-mono">
                            {cat.targetLab === 'all'
                              ? 'All Labs'
                              : `${cat.targetLab?.toUpperCase()} Lab`}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-sans leading-relaxed">
                          {cat.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                          className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Reset Defaults Action in Footer */}
                  <div className="p-3 px-4 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between text-xs">
                    <span className="text-zinc-500 text-[11px]">
                      Need standard categories?
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!requireEditMode()) return
                        resetIncidentCategories()
                        triggerToast('Restored default 6 institutional incident categories.')
                      }}
                      className="h-7 text-[11px] font-mono gap-1 text-zinc-600 dark:text-zinc-400"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset Standard Baseline</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Emergency Contacts & Governance Policy Card */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardHeader className="p-4 px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-500" />
                    Emergency Alert Routing & Designated Lab In-Charges
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Contacts designated to receive automated incident notices upon apparatus breakage or safety hazards.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Auto Escalation Toggle */}
                  <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase">
                        Automatic HOD Escalation for Major Hazards
                      </span>
                      <p className="text-[11px] text-zinc-500 font-sans">
                        Immediately route high-severity chemical hazards or major equipment failures to Head of Department.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoEscalateHOD}
                      onChange={(e) => setAutoEscalateHOD(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  {/* 4 Designated In-Charge Emails */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Physics Lab Designated In-Charge Email
                      </label>
                      <Input
                        type="email"
                        value={contactPhys}
                        onChange={(e) => setContactPhys(e.target.value)}
                        placeholder="physics.incharge@rrl.edu.np"
                        className="text-xs font-mono bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Chemistry Lab Designated In-Charge Email
                      </label>
                      <Input
                        type="email"
                        value={contactChem}
                        onChange={(e) => setContactChem(e.target.value)}
                        placeholder="chemistry.incharge@rrl.edu.np"
                        className="text-xs font-mono bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Computer Lab Designated In-Charge Email
                      </label>
                      <Input
                        type="email"
                        value={contactComp}
                        onChange={(e) => setContactComp(e.target.value)}
                        placeholder="computer.incharge@rrl.edu.np"
                        className="text-xs font-mono bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Head of Department (HOD) Escalation Email
                      </label>
                      <Input
                        type="email"
                        value={contactHod}
                        onChange={(e) => setContactHod(e.target.value)}
                        placeholder="hod.science@rrl.edu.np"
                        className="text-xs font-mono bg-white dark:bg-zinc-950"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveIncidentSettings}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold shadow-xs"
                    >
                      Save Governance & Routing Contacts
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column (4 cols): Add Category Form + RBAC Summary */}
            <div className="lg:col-span-4 space-y-6">
              {/* Add New Category Card */}
              <Card className="border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                <CardHeader className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                  <CardTitle className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-rose-500" />
                    Register New Category
                  </CardTitle>
                  <CardDescription className="text-[11px] text-zinc-500">
                    Define institutional category code & severity default.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4">
                  <form onSubmit={handleAddCategory} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Category Name *
                      </label>
                      <Input
                        type="text"
                        required
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="e.g. Optics Scratch"
                        className="text-xs bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        System Code *
                      </label>
                      <Input
                        type="text"
                        required
                        value={newCatCode}
                        onChange={(e) => setNewCatCode(e.target.value)}
                        placeholder="e.g. optics_scratch"
                        className="text-xs bg-white dark:bg-zinc-950"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Default Severity *
                      </label>
                      <Select
                        value={newCatSeverity}
                        onChange={(e) => setNewCatSeverity(e.target.value as any)}
                        className="text-xs bg-white dark:bg-zinc-950"
                      >
                        <option value="minor">Minor (Low impact)</option>
                        <option value="moderate">Moderate (Store replace)</option>
                        <option value="major_critical">Major / Critical (HOD Attention)</option>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Target Laboratory *
                      </label>
                      <Select
                        value={newCatLab}
                        onChange={(e) => setNewCatLab(e.target.value as any)}
                        className="text-xs bg-white dark:bg-zinc-950"
                      >
                        <option value="all">All Labs (Phys, Chem, Comp)</option>
                        <option value="phys">Physics Laboratory Only</option>
                        <option value="chem">Chemistry Laboratory Only</option>
                        <option value="comp">Computer Laboratory Only</option>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Scope Description
                      </label>
                      <textarea
                        rows={2}
                        value={newCatDesc}
                        onChange={(e) => setNewCatDesc(e.target.value)}
                        placeholder="Describe what apparatus faults or incidents belong in this category..."
                        className="flex w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 font-sans"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold shadow-xs gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Register Category</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* RBAC Reference Guide */}
              <Card className="border border-zinc-200 dark:border-zinc-800 p-4 shadow-2xs space-y-2.5 bg-zinc-50/50 dark:bg-zinc-900/30">
                <span className="text-[11px] font-bold text-zinc-950 dark:text-white uppercase flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Access Governance Reference
                </span>
                <p className="text-[11px] font-sans text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  In next phase, authenticated staff profiles will enforce role permissions automatically:
                </p>
                <div className="space-y-1.5 text-[10px] font-sans text-zinc-700 dark:text-zinc-300">
                  <div>
                    <strong>Super Admin & Lab In-Charge:</strong> Manage resolution statuses (*Under Repair*, *Replaced*, *Resolved*) and forward to HOD.
                  </div>
                  <div>
                    <strong>Head of Department (HOD):</strong> Review escalated cases and issue final institutional directives.
                  </div>
                  <div>
                    <strong>Faculty & Assistants:</strong> Standard reporting access only.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 EXECUTIVE DANGER CONFIRMATION MODAL */}
      {dangerModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 font-mono select-none animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  {dangerModal.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans">
                  {dangerModal.description}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                <span>Impact Warning:</span>
              </div>
              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-sans">
                {dangerModal.impactMessage}
              </p>
            </div>

            {dangerModal.requiresTypedConfirmation && (
              <div className="space-y-2 text-xs">
                <label className="text-zinc-700 dark:text-zinc-300">
                  Type <strong>{dangerModal.typedConfirmationWord}</strong> to authorize:
                </label>
                <Input
                  type="text"
                  value={typedConfirmInput}
                  onChange={(e) => setTypedConfirmInput(e.target.value)}
                  placeholder={`Type ${dangerModal.typedConfirmationWord}`}
                  className="font-mono font-bold text-center tracking-widest uppercase border-rose-400"
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDangerModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  dangerModal.requiresTypedConfirmation &&
                  typedConfirmInput.trim().toUpperCase() !== dangerModal.typedConfirmationWord
                }
                onClick={dangerModal.onConfirm}
                className="text-xs font-mono font-bold gap-1 bg-rose-600 hover:bg-rose-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Confirm Action</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
