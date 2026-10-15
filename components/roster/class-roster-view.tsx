'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Users,
  Search,
  Upload,
  Download,
  UserPlus,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ArrowRightLeft,
  Archive,
  Edit2,
  Trash2,
  Monitor,
  MoreVertical,
  Check,
  ShieldAlert,
  RotateCcw,
  ArrowDownAZ,
  GraduationCap,
  Camera,
} from 'lucide-react'
import {
  getStudentsByClass,
  createStudentWithEnrollment,
  updateEnrollment,
  transferStudentEnrollment,
  updateStudentDetailsAction,
  deleteStudentEnrollmentAction,
  bulkArchiveStudentsAction,
  bulkDeleteStudentsAction,
  restoreStudentEnrollmentAction,
  resequenceClassRollsAlphabeticallyAction,
  updateStudentPhotoAction,
} from '@/app/actions/students'
import { DEFAULT_CLASSES } from '@/lib/master-data'
import { getAcademicYears } from '@/app/actions/academic-years'
import { exportCohortRosterAction } from '@/app/actions/roster-ingestion'
import { getClassesAction } from '@/app/actions/classes'
import type { ClassRecord } from '@/lib/types/classes'
import { RosterImportModal } from './roster-import-modal'
import { BatchPhotoImportModal } from './batch-photo-import-modal'
import { compressStudentAvatar } from '@/lib/student-photos/compressor'
import type { StudentWithEnrollment } from '@/lib/types/students'
import type { AcademicYear } from '@/lib/types/academic-years'

const FALLBACK_CLASSES: ClassRecord[] = DEFAULT_CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  grade: parseInt(c.name.replace(/\D/g, '') || '0', 10) || 11,
  section: c.fullName.split(' - ')[1] || c.stream,
  capacity: c.strength,
  is_active: true,
}))

interface ClassRosterViewProps {
  isPrivileged: boolean
  onOpenPromotion?: () => void
  initialClasses?: ClassRecord[]
  onDataUpdated?: () => void
}

export function ClassRosterView({ isPrivileged, onOpenPromotion, initialClasses, onDataUpdated }: ClassRosterViewProps) {
  const [selectedClassId, setSelectedClassId] = useState('12eng')
  const [selectedYearId, setSelectedYearId] = useState('2083')
  const [classes, setClasses] = useState<ClassRecord[]>(() =>
    initialClasses && initialClasses.length > 0 ? initialClasses : FALLBACK_CLASSES
  )
  const [isClassesLoading, setIsClassesLoading] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [students, setStudents] = useState<StudentWithEnrollment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active')

  // Roll Resequence state
  const [isResequencing, setIsResequencing] = useState(false)
  const [isResequenceConfirmOpen, setIsResequenceConfirmOpen] = useState(false)

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isBatchPhotoModalOpen, setIsBatchPhotoModalOpen] = useState(false)
  const [singlePhotoStudent, setSinglePhotoStudent] = useState<StudentWithEnrollment | null>(null)
  const [isUploadingSinglePhoto, setIsUploadingSinglePhoto] = useState(false)
  const singlePhotoInputRef = useRef<HTMLInputElement>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferTargetStudent, setTransferTargetStudent] = useState<StudentWithEnrollment | null>(null)

  // Add student form state
  const [addRoll, setAddRoll] = useState('')
  const [addName, setAddName] = useState('')
  const [addAdm, setAddAdm] = useState('')
  const [addReg, setAddReg] = useState('')
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Transfer form state
  const [transferToClass, setTransferToClass] = useState('')
  const [transferNewRoll, setTransferNewRoll] = useState('')
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Multi-select state
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set())

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editTargetStudent, setEditTargetStudent] = useState<StudentWithEnrollment | null>(null)
  const [editName, setEditName] = useState('')
  const [editRoll, setEditRoll] = useState('')
  const [editAdm, setEditAdm] = useState('')
  const [editReg, setEditReg] = useState('')
  const [editGender, setEditGender] = useState<'male' | 'female' | 'other'>('male')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete modal state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteTargetStudent, setDeleteTargetStudent] = useState<StudentWithEnrollment | null>(null)
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)

  // Bulk actions state
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
  const [bulkActionNotice, setBulkActionNotice] = useState<string | null>(null)

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0] || { id: selectedClassId, name: selectedClassId },
    [classes, selectedClassId]
  )

  // Fetch academic years and classes dynamically from database on mount
  useEffect(() => {
    async function loadInitialMetadata() {
      try {
        const [yearRes, classRes] = await Promise.allSettled([
          getAcademicYears(),
          getClassesAction(),
        ])
        if (yearRes.status === 'fulfilled' && yearRes.value.success && yearRes.value.data && yearRes.value.data.length > 0) {
          setAcademicYears(yearRes.value.data)
          const current = yearRes.value.data.find((y) => y.is_current)
          if (current) setSelectedYearId(current.id)
        }
        if (classRes.status === 'fulfilled' && classRes.value.success && classRes.value.data) {
          setClasses(classRes.value.data)
          if (classRes.value.data.length > 0) {
            setSelectedClassId((prev) => {
              if (classRes.value.data.some((c) => c.id === prev)) return prev
              return classRes.value.data[0].id
            })
            setTransferToClass(classRes.value.data[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load classes and academic years:', err)
      } finally {
        setIsClassesLoading(false)
      }
    }
    loadInitialMetadata()
  }, [])

  // Fetch class roster
  const fetchRoster = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getStudentsByClass({
        classId: selectedClassId,
        academicYearId: selectedYearId,
        statusFilter: 'all',
      })
      if (res.success && res.data) {
        setStudents(res.data)
      } else {
        setStudents([])
      }
    } catch (err) {
      console.error('Failed to load roster:', err)
      setStudents([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedClassId, selectedYearId])

  useEffect(() => {
    fetchRoster()
  }, [fetchRoster])

  const triggerDataSync = useCallback(() => {
    fetchRoster()
    onDataUpdated?.()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('student-roster-updated'))
      window.dispatchEvent(new Event('infrastructure-updated'))
    }
  }, [fetchRoster, onDataUpdated])

  useEffect(() => {
    if (initialClasses && initialClasses.length > 0) {
      setClasses(initialClasses)
    }
  }, [initialClasses])

  useEffect(() => {
    const handleRemoteUpdate = () => {
      fetchRoster()
    }
    window.addEventListener('student-roster-updated', handleRemoteUpdate)
    window.addEventListener('infrastructure-updated', handleRemoteUpdate)
    return () => {
      window.removeEventListener('student-roster-updated', handleRemoteUpdate)
      window.removeEventListener('infrastructure-updated', handleRemoteUpdate)
    }
  }, [fetchRoster])

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Status filter
      if (statusFilter === 'active' && s.enrollment_status !== 'active') return false
      if (statusFilter === 'archived' && s.enrollment_status === 'active') return false

      // Search filter
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      const matchRoll = s.roll_number.toString().includes(q)
      const matchName = s.full_name.toLowerCase().includes(q)
      const matchAdm = s.admission_no?.toLowerCase().includes(q) || false
      const matchReg = s.registration_no?.toLowerCase().includes(q) || false

      return matchRoll || matchName || matchAdm || matchReg
    })
  }, [students, searchQuery, statusFilter])

  // Counts
  const counts = useMemo(() => {
    const total = students.length
    const active = students.filter((s) => s.enrollment_status === 'active').length
    const archived = total - active
    return { total, active, archived }
  }, [students])

  // Handle Add Student Submit
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)

    const rollNum = parseInt(addRoll.trim(), 10)
    if (!rollNum || rollNum <= 0 || rollNum > 200) {
      setAddError('Roll number must be between 1 and 200.')
      return
    }
    if (!addName.trim()) {
      setAddError('Student full name is required.')
      return
    }

    setIsSubmittingAdd(true)
    try {
      const res = await createStudentWithEnrollment({
        student: {
          full_name: addName.trim(),
          admission_no: addAdm.trim() || undefined,
          registration_no: addReg.trim() || undefined,
        },
        enrollment: {
          academic_year_id: selectedYearId,
          class_id: selectedClassId,
          roll_number: rollNum,
        },
      })

      if (res.success) {
        setIsAddModalOpen(false)
        setAddRoll('')
        setAddName('')
        setAddAdm('')
        setAddReg('')
        triggerDataSync()
      } else {
        setAddError(res.error || 'Failed to add student.')
      }
    } catch (err: any) {
      setAddError(err?.message || 'Error creating student.')
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  // Handle Transfer Student Submit
  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferTargetStudent) return
    setTransferError(null)

    const rollNum = parseInt(transferNewRoll.trim(), 10)
    if (!rollNum || rollNum <= 0 || rollNum > 200) {
      setTransferError('Roll number must be between 1 and 200.')
      return
    }

    setIsSubmittingTransfer(true)
    try {
      const res = await transferStudentEnrollment({
        studentId: transferTargetStudent.student_id,
        fromClassId: selectedClassId,
        toClassId: transferToClass,
        academicYearId: selectedYearId,
        newRollNumber: rollNum,
      })

      if (res.success) {
        setIsTransferModalOpen(false)
        setTransferTargetStudent(null)
        setTransferNewRoll('')
        triggerDataSync()
      } else {
        setTransferError(res.error || 'Failed to transfer student.')
      }
    } catch (err: any) {
      setTransferError(err?.message || 'Error transferring student.')
    } finally {
      setIsSubmittingTransfer(false)
    }
  }

  // Handle Export
  const handleExportRoster = async () => {
    setIsExporting(true)
    try {
      const res = await exportCohortRosterAction({
        academicYearId: selectedYearId,
        classId: selectedClassId,
      })
      if (res.success && res.dataBase64) {
        const link = document.createElement('a')
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.dataBase64}`
        link.download = res.fileName || 'Class_Roster.xlsx'
        link.click()
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle Multi-Select
  const handleToggleSelectAll = () => {
    if (selectedEnrollmentIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedEnrollmentIds(new Set())
    } else {
      setSelectedEnrollmentIds(new Set(filteredStudents.map((s) => s.enrollment_id)))
    }
  }

  const handleToggleSelectStudent = (enrollmentId: string) => {
    const next = new Set(selectedEnrollmentIds)
    if (next.has(enrollmentId)) {
      next.delete(enrollmentId)
    } else {
      next.add(enrollmentId)
    }
    setSelectedEnrollmentIds(next)
  }

  // Handle Edit Student
  const handleOpenEditModal = (student: StudentWithEnrollment) => {
    setEditTargetStudent(student)
    setEditName(student.full_name)
    setEditRoll(student.roll_number.toString())
    setEditAdm(student.admission_no || '')
    setEditReg(student.registration_no || '')
    setEditGender(student.gender || 'male')
    setEditError(null)
    setIsEditModalOpen(true)
  }

  const handleEditStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTargetStudent) return

    const rollNum = parseInt(editRoll, 10)
    if (isNaN(rollNum) || rollNum < 1 || rollNum > 200) {
      setEditError('Roll number must be between 1 and 200.')
      return
    }

    setIsSubmittingEdit(true)
    setEditError(null)
    try {
      const res = await updateStudentDetailsAction({
        studentId: editTargetStudent.student_id,
        enrollmentId: editTargetStudent.enrollment_id,
        fullName: editName.trim(),
        rollNumber: rollNum,
        admissionNo: editAdm.trim() || null,
        registrationNo: editReg.trim() || null,
        gender: editGender,
      })

      if (res.success) {
        setIsEditModalOpen(false)
        setEditTargetStudent(null)
        triggerDataSync()
      } else {
        setEditError(res.error || 'Failed to update student.')
      }
    } catch (err: any) {
      setEditError(err?.message || 'Error updating student.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Handle Single Delete Student
  const handleOpenDeleteModal = (student: StudentWithEnrollment) => {
    setDeleteTargetStudent(student)
    setDeleteNotice(null)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetStudent) return
    setIsSubmittingDelete(true)
    setDeleteNotice(null)
    try {
      const res = await deleteStudentEnrollmentAction({
        enrollmentId: deleteTargetStudent.enrollment_id,
        studentId: deleteTargetStudent.student_id,
      })

      if (res.success) {
        setIsDeleteDialogOpen(false)
        setDeleteTargetStudent(null)
        setSelectedEnrollmentIds((prev) => {
          const next = new Set(prev)
          next.delete(deleteTargetStudent.enrollment_id)
          return next
        })
        triggerDataSync()
      } else {
        setDeleteNotice(res.error || 'Failed to delete student.')
      }
    } catch (err: any) {
      setDeleteNotice(err?.message || 'Error deleting student.')
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  // Handle Bulk Archive
  const handleBulkArchive = async () => {
    if (selectedEnrollmentIds.size === 0) return
    setIsBulkActionLoading(true)
    setBulkActionNotice(null)
    try {
      const res = await bulkArchiveStudentsAction(Array.from(selectedEnrollmentIds))
      if (res.success) {
        setSelectedEnrollmentIds(new Set())
        setBulkActionNotice(`Successfully archived ${res.count || 0} student enrollment(s).`)
        triggerDataSync()
      } else {
        setBulkActionNotice(res.error || 'Failed to archive selected students.')
      }
    } catch (err: any) {
      setBulkActionNotice(err?.message || 'Error executing bulk archive.')
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Handle Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedEnrollmentIds.size === 0) return
    setIsBulkActionLoading(true)
    setBulkActionNotice(null)
    try {
      const itemsToDelete = filteredStudents
        .filter((s) => selectedEnrollmentIds.has(s.enrollment_id))
        .map((s) => ({
          enrollmentId: s.enrollment_id,
          studentId: s.student_id,
        }))

      const res = await bulkDeleteStudentsAction(itemsToDelete)
      if (res.success) {
        setSelectedEnrollmentIds(new Set())
        const parts = []
        if (res.deletedCount && res.deletedCount > 0) {
          parts.push(`${res.deletedCount} cleanly deleted`)
        }
        if (res.archivedCount && res.archivedCount > 0) {
          parts.push(`${res.archivedCount} safely archived (had attendance logs)`)
        }
        setBulkActionNotice(`Processed ${parts.join(', ')}.`)
        triggerDataSync()
      } else {
        setBulkActionNotice(res.error || 'Failed to delete selected students.')
      }
    } catch (err: any) {
      setBulkActionNotice(err?.message || 'Error executing bulk delete.')
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Handle single student restore
  const handleRestoreStudent = async (student: StudentWithEnrollment) => {
    setIsBulkActionLoading(true)
    try {
      const res = await restoreStudentEnrollmentAction(student.enrollment_id)
      if (res.success) {
        setBulkActionNotice(
          `Restored ${res.restoredStudentName || student.full_name} to Active!${
            res.newRollNumber ? ` Reassigned to Roll ${res.newRollNumber} to prevent collision.` : ''
          }`
        )
        triggerDataSync()
      } else {
        setBulkActionNotice(res.error || 'Failed to restore student.')
      }
    } catch (err: unknown) {
      setBulkActionNotice(err instanceof Error ? err.message : 'Unknown restore error')
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  // Handle alphabetical A-Z resequencing
  const handleResequenceRolls = async () => {
    setIsResequencing(true)
    try {
      const res = await resequenceClassRollsAlphabeticallyAction({
        classId: selectedClassId,
        academicYearId: selectedYearId,
      })
      if (res.success) {
        setBulkActionNotice(`Successfully resequenced ${res.count} active students alphabetically (A–Z)!`)
        setIsResequenceConfirmOpen(false)
        triggerDataSync()
      } else {
        setBulkActionNotice(res.error || 'Failed to resequence rolls.')
      }
    } catch (err: unknown) {
      setBulkActionNotice(err instanceof Error ? err.message : 'Resequencing error')
    } finally {
      setIsResequencing(false)
    }
  }

  // Get student initials for avatar fallback (e.g. "Kaustuv Thapa" -> "KT")
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 0 || !parts[0]) return 'ST'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Trigger individual student photo selection
  const handleAvatarClick = (student: StudentWithEnrollment) => {
    if (!isPrivileged) return
    setSinglePhotoStudent(student)
    singlePhotoInputRef.current?.click()
  }

  // Process individual student photo selection
  const handleSinglePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !singlePhotoStudent) return

    setIsUploadingSinglePhoto(true)
    try {
      const compressed = await compressStudentAvatar(file, 256, 0.75)
      const res = await updateStudentPhotoAction({
        studentId: singlePhotoStudent.student_id,
        photoUrl: compressed.dataUrl,
      })

      if (res.success) {
        setBulkActionNotice(`Successfully updated photo for ${singlePhotoStudent.full_name}!`)
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === singlePhotoStudent.student_id ? { ...s, photo_url: compressed.dataUrl } : s
          )
        )
        triggerDataSync()
      } else {
        setBulkActionNotice(res.error || 'Failed to update photo.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo optimization error'
      setBulkActionNotice(msg)
    } finally {
      setIsUploadingSinglePhoto(false)
      setSinglePhotoStudent(null)
      if (singlePhotoInputRef.current) singlePhotoInputRef.current.value = ''
    }
  }

  if (!isClassesLoading && classes.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center space-y-4 font-sans text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold font-heading text-white">System Unconfigured</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No active classes found in the database. Please add classes in the Admin Dashboard under Curriculum to activate the student roster.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 font-sans text-slate-100">
      
      {/* Top Filter and Actions Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-4 rounded-2xl border border-white/[0.08] bg-[#101726] shadow-sm">
        
        {/* Left: Academic Year + Class Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#151E32] px-3 py-1.5 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Year:</span>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {academicYears.length > 0 ? (
                academicYears.map((y) => (
                  <option key={y.id} value={y.id} className="bg-[#151E32] text-white">
                    {y.name} {y.is_current ? '(Current)' : ''}
                  </option>
                ))
              ) : (
                <option value="2083" className="bg-[#151E32] text-white">2083 B.S. (Current)</option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#151E32] px-3 py-1.5 rounded-xl border border-white/[0.08]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#151E32] text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Segmented Status Filter Tabs: Active | Archived | All */}
          <div className="flex items-center p-1 rounded-xl bg-[#151E32] border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Active</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                statusFilter === 'active' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
              }`}>
                {counts.active}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'archived'
                  ? 'bg-amber-600/90 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Archived</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                statusFilter === 'archived' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
              }`}>
                {counts.archived}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
              }`}>
                {counts.total}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Search + Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, roll, admission no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-white/[0.08] bg-[#151E32] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExportRoster}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-300 transition disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Privileged Management Buttons */}
          {isPrivileged && (
            <>
              {/* Sort Rolls A-Z Button */}
              <button
                type="button"
                onClick={() => setIsResequenceConfirmOpen(true)}
                disabled={counts.active === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-300 transition cursor-pointer disabled:opacity-50"
                title="Alphabetically sort rolls (A–Z) for active students"
              >
                <ArrowDownAZ className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden md:inline">Sort Rolls (A–Z)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-300 transition"
              >
                <UserPlus className="h-3.5 w-3.5 text-indigo-400" />
                <span>Add Student</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBatchPhotoModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-300 transition cursor-pointer"
                title="Batch upload and auto-match student photos by roll number"
              >
                <Camera className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Batch Photos</span>
              </button>

              {onOpenPromotion && (
                <button
                  type="button"
                  onClick={onOpenPromotion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition cursor-pointer"
                  title="Launch Cohort Promotion Wizard"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Cohort Promotion</span>
                </button>
              )}
            </>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchRoster}
            disabled={isLoading}
            className="p-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

      </div>

      {/* Bulk Selection Bar */}
      {isPrivileged && selectedEnrollmentIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 text-xs shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white text-[11px] font-bold">
              {selectedEnrollmentIds.size}
            </span>
            <span className="font-semibold text-white">
              {selectedEnrollmentIds.size} student{selectedEnrollmentIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedEnrollmentIds(new Set())}
              className="text-[11px] text-slate-400 hover:text-white underline ml-2 cursor-pointer"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkArchive}
              disabled={isBulkActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 border border-white/[0.1] transition disabled:opacity-50 cursor-pointer"
            >
              {isBulkActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5 text-amber-400" />}
              <span>Bulk Archive</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isBulkActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>Bulk Delete</span>
            </button>
          </div>
        </div>
      )}

      {bulkActionNotice && (
        <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs flex items-center justify-between">
          <span>{bulkActionNotice}</span>
          <button
            type="button"
            onClick={() => setBulkActionNotice(null)}
            className="text-indigo-400 hover:text-white ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Roster Container */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#101726] shadow-sm overflow-hidden">
        
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-xs text-slate-400">Loading {selectedClass.name} roster...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500 border border-white/[0.08]">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No Students Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'No students match your search criteria in this class.'
                  : `Class ${selectedClass.name} currently has no enrolled students for academic year ${selectedYearId}.`}
              </p>
            </div>
            {isPrivileged && !searchQuery && (
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition mt-2"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import Spreadsheet Roster</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#151E32] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.08]">
                  <tr>
                    {isPrivileged && (
                      <th className="px-4 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredStudents.length > 0 &&
                            selectedEnrollmentIds.size === filteredStudents.length
                          }
                          onChange={handleToggleSelectAll}
                          className="h-4 w-4 rounded border-slate-700 bg-[#101726] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          title="Select all students"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 w-16 text-center">Roll</th>
                    <th className="px-4 py-3">Student Full Name</th>
                    <th className="px-4 py-3">Admission No</th>
                    <th className="px-4 py-3">Registration No</th>
                    <th className="px-4 py-3">Workstation</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    {isPrivileged && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredStudents.map((s) => {
                    const isSelected = selectedEnrollmentIds.has(s.enrollment_id)
                    return (
                      <tr
                        key={s.enrollment_id}
                        className={`hover:bg-white/[0.02] transition ${isSelected ? 'bg-indigo-500/[0.06]' : ''}`}
                      >
                        {isPrivileged && (
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectStudent(s.enrollment_id)}
                              className="h-4 w-4 rounded border-slate-700 bg-[#101726] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-center font-bold text-white tabular-nums">
                          {s.roll_number}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleAvatarClick(s)}
                              disabled={!isPrivileged || isUploadingSinglePhoto}
                              className={`relative group h-8 w-8 rounded-full overflow-hidden border border-white/10 bg-[#151E32] flex items-center justify-center shrink-0 ${
                                isPrivileged ? 'cursor-pointer hover:border-indigo-400' : 'cursor-default'
                              }`}
                              title={isPrivileged ? `Click to upload/change photo for ${s.full_name}` : s.full_name}
                            >
                              {s.photo_url ? (
                                <img src={s.photo_url} alt={s.full_name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-indigo-300 font-heading">
                                  {getInitials(s.full_name)}
                                </span>
                              )}
                              {isPrivileged && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Camera className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </button>
                            <span>{s.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {s.admission_no || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {s.registration_no || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {s.assigned_workstation_label ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              <Monitor className="h-3 w-3 text-indigo-400" />
                              <span>{s.assigned_workstation_label}</span>
                            </span>
                          ) : s.enrollment_status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Active (Unseated)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {s.enrollment_status === 'active' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              {s.enrollment_status?.toUpperCase() || 'ARCHIVED'}
                            </span>
                          )}
                        </td>
                        {isPrivileged && (
                          <td className="px-4 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              {s.enrollment_status === 'archived' ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreStudent(s)}
                                  disabled={isBulkActionLoading}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition cursor-pointer"
                                  title="Restore student to active cohort"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>Restore</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(s)}
                                    className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition cursor-pointer"
                                    title="Edit student details & roll number"
                                  >
                                    <Edit2 className="h-3 w-3 text-indigo-400" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTransferTargetStudent(s)
                                      setTransferNewRoll(s.roll_number.toString())
                                      setIsTransferModalOpen(true)
                                    }}
                                    className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition cursor-pointer"
                                    title="Transfer to another class"
                                  >
                                    <ArrowRightLeft className="h-3 w-3 text-amber-400" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteModal(s)}
                                    className="p-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                    title="Delete or archive student enrollment"
                                  >
                                    <Trash2 className="h-3 w-3 text-rose-400" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {filteredStudents.map((s) => {
                const isSelected = selectedEnrollmentIds.has(s.enrollment_id)
                return (
                  <div
                    key={s.enrollment_id}
                    className={`p-3.5 space-y-2.5 transition ${isSelected ? 'bg-indigo-500/[0.06]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {isPrivileged && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(s.enrollment_id)}
                            className="h-4 w-4 rounded border-slate-700 bg-[#101726] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold tabular-nums">
                          {s.roll_number}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAvatarClick(s)}
                          disabled={!isPrivileged || isUploadingSinglePhoto}
                          className="h-7 w-7 rounded-full overflow-hidden border border-white/10 bg-[#151E32] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {s.photo_url ? (
                            <img src={s.photo_url} alt={s.full_name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-indigo-300 font-heading">
                              {getInitials(s.full_name)}
                            </span>
                          )}
                        </button>
                        <span className="text-xs font-bold text-white">{s.full_name}</span>
                      </div>
                      {s.enrollment_status === 'active' ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">
                          {s.enrollment_status}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Adm: {s.admission_no || '—'}</span>
                      <span>Reg: {s.registration_no || '—'}</span>
                      {isPrivileged && (
                        <div className="flex items-center gap-2">
                          {s.enrollment_status === 'archived' ? (
                            <button
                              type="button"
                              onClick={() => handleRestoreStudent(s)}
                              disabled={isBulkActionLoading}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 underline font-sans cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(s)}
                                className="text-xs font-bold text-indigo-400 underline font-sans cursor-pointer"
                              >
                                Edit
                              </button>
                              <span className="text-slate-600">·</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferTargetStudent(s)
                                  setTransferNewRoll(s.roll_number.toString())
                                  setIsTransferModalOpen(true)
                                }}
                                className="text-xs font-bold text-amber-400 underline font-sans cursor-pointer"
                              >
                                Transfer
                              </button>
                              <span className="text-slate-600">·</span>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(s)}
                                className="text-xs font-bold text-rose-400 underline font-sans cursor-pointer"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* Roster Excel Import Modal */}
      <RosterImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        academicYearId={selectedYearId}
        academicYearName={`${selectedYearId} B.S.`}
        classId={selectedClassId}
        className={selectedClass.name}
        onSuccess={triggerDataSync}
      />

      {/* Single Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Add Student to {selectedClass.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Roll Number *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  placeholder="e.g. 1"
                  value={addRoll}
                  onChange={(e) => setAddRoll(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Admission Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ADM-2083-001"
                  value={addAdm}
                  onChange={(e) => setAddAdm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Registration Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. REG-83-1001"
                  value={addReg}
                  onChange={(e) => setAddReg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingAdd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  <span>Save Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Student Modal */}
      {isTransferModalOpen && transferTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Transfer Student
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Transferring <span className="text-white font-bold">{transferTargetStudent.full_name}</span> from {selectedClass.name} to another class. Historical records in {selectedClass.name} will be preserved.
            </p>

            {transferError && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Destination Class *
                </label>
                <select
                  value={transferToClass}
                  onChange={(e) => setTransferToClass(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {classes.filter((c) => c.id !== selectedClassId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  New Roll Number in Destination Class *
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  placeholder="e.g. 5"
                  value={transferNewRoll}
                  onChange={(e) => setTransferNewRoll(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingTransfer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                  <span>Transfer Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && editTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Edit2 className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Edit Student Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditStudentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aarav Sharma"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    required
                    placeholder="e.g. 1"
                    value={editRoll}
                    onChange={(e) => setEditRoll(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Gender
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Admission Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. ADM-2083-001"
                  value={editAdm}
                  onChange={(e) => setEditAdm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. REG-83-1001"
                  value={editReg}
                  onChange={(e) => setEditReg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Dialog */}
      {isDeleteDialogOpen && deleteTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Remove Student from {selectedClass.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Are you sure you want to remove <span className="text-white font-bold">{deleteTargetStudent.full_name}</span> (Roll {deleteTargetStudent.roll_number})?
              </p>
              <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200 text-[11px] leading-relaxed">
                <strong>Institutional Audit Rule:</strong> If this student has active practical attendance logs, their enrollment will be safely <strong>archived</strong> rather than erased, preserving past attendance records. If no practical logs exist, the record will be <strong>cleanly deleted</strong>.
              </div>
            </div>

            {deleteNotice && (
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {deleteNotice}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmittingDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingDelete ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>Confirm Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resequence Rolls A-Z Confirmation Modal */}
      {isResequenceConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151E32] border border-white/[0.1] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownAZ className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Resequence Rolls Alphabetically (A–Z)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResequenceConfirmOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to sort all <span className="text-white font-bold">{counts.active} active students</span> in <span className="text-white font-bold">{selectedClass.name}</span> ({selectedYearId} B.S.) alphabetically by full name and renumber their roll numbers sequentially from <strong>1 to {counts.active}</strong>?
              </p>
              <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-200 text-[11px] leading-relaxed">
                <strong>Safety Governance Lock:</strong> Roll resequencing is only permitted if <strong>zero practical attendance logs</strong> exist for this class. If logs exist, the operation will be safely rejected to maintain historical compliance.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsResequenceConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResequenceRolls}
                disabled={isResequencing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isResequencing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownAZ className="h-3.5 w-3.5" />}
                <span>Sort & Assign 1..N</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Student Photo Import Modal */}
      <BatchPhotoImportModal
        isOpen={isBatchPhotoModalOpen}
        onClose={() => setIsBatchPhotoModalOpen(false)}
        onSuccess={() => {
          setBulkActionNotice('Batch student photos successfully updated!')
          triggerDataSync()
        }}
        classNameLabel={selectedClass.name}
        academicYearLabel={selectedYearId}
        students={students.map((s) => ({
          student_id: s.student_id,
          full_name: s.full_name,
          roll_number: s.roll_number,
          admission_no: s.admission_no,
          registration_no: s.registration_no,
          photo_url: s.photo_url,
        }))}
      />

      {/* Hidden file input for 1-click single photo updates */}
      <input
        ref={singlePhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleSinglePhotoSelect}
        className="hidden"
      />

    </div>
  )
}
