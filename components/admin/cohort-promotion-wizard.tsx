'use client'

import React, { useState, useEffect, useMemo, useRef, useTransition } from 'react'
import {
  GraduationCap,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  ArrowDownAZ,
  Users,
  Search,
  Trash2,
  Loader2,
  ShieldAlert,
  Calendar,
  Layers,
  History,
  Info,
  Check,
  X,
  FileSpreadsheet,
  Download,
  Upload,
} from 'lucide-react'
import {
  getAcademicYears,
  executeCohortPromotionBatchAction,
  getRecentPromotionBatchesAction,
  rollbackCohortPromotionBatchAction,
} from '@/app/actions/academic-years'
import { getStudentsByClass } from '@/app/actions/students'
import { getClassesAction } from '@/app/actions/classes'
import {
  parseNewcomerSpreadsheetAction,
  getBlankRosterTemplateAction,
} from '@/app/actions/roster-ingestion'
import type { ClassRecord } from '@/lib/types/classes'
import type {
  AcademicYear,
  PromotionStudentItem,
  LateralNewcomerItem,
  PromotionBatchHistoryItem,
  PromotionBatchReceipt,
} from '@/lib/types/academic-years'
import { DEFAULT_CLASSES } from '@/lib/master-data'

const FALLBACK_CLASSES: ClassRecord[] = DEFAULT_CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  grade: parseInt(c.name.replace(/\D/g, '') || '0', 10) || 11,
  section: c.fullName.split(' - ')[1] || c.stream,
  capacity: c.strength,
  is_active: true,
}))

/**
 * Smart Class Promotion Suggester:
 * Automatically suggests the next sequential grade of the same stream
 * (e.g. 10 Eng -> 11 Eng, 11 Eng -> 12 Eng, 12 Eng -> Terminal Graduation)
 */
export function suggestTargetClass(
  sourceClassId: string,
  classes: ClassRecord[]
): { targetClassId: string; isTerminal: boolean } {
  if (!sourceClassId || classes.length === 0) {
    return { targetClassId: classes[0]?.id || '', isTerminal: false }
  }

  const source = classes.find((c) => c.id === sourceClassId)
  const sourceName = source ? source.name : sourceClassId
  const sourceIdLower = sourceClassId.toLowerCase()
  const sourceNameLower = sourceName.toLowerCase()

  // 1. Extract grade number (e.g. "10 Eng" -> 10, "11sci" -> 11, "12" -> 12)
  const gradeMatch = sourceNameLower.match(/\b(1[0-2]|[1-9])\b/) || sourceIdLower.match(/(1[0-2]|[1-9])/)
  const currentGrade = gradeMatch ? parseInt(gradeMatch[1], 10) : (source?.grade || 0)

  // Class 12 or higher is always Terminal Graduation
  if (currentGrade >= 12 || sourceIdLower.startsWith('12') || sourceNameLower.includes('12')) {
    return { targetClassId: '', isTerminal: true }
  }

  const nextGrade = currentGrade > 0 ? currentGrade + 1 : null

  // 2. Stream / specialization keyword match (e.g. "eng", "sci", "mgt", "civil", "bio")
  const streamKeywords = ['eng', 'sci', 'mgt', 'civil', 'bio', 'comp']
  const matchedKeyword = streamKeywords.find(
    (kw) => sourceIdLower.includes(kw) || sourceNameLower.includes(kw)
  )

  // 3. Find candidates of next grade
  const nextGradeCandidates = nextGrade
    ? classes.filter((c) => {
        if (c.id === sourceClassId) return false
        const cGradeMatch = c.name.toLowerCase().match(/\b(1[0-2]|[1-9])\b/) || c.id.toLowerCase().match(/(1[0-2]|[1-9])/)
        const cGrade = cGradeMatch ? parseInt(cGradeMatch[1], 10) : (c.grade || 0)
        return cGrade === nextGrade
      })
    : []

  if (nextGradeCandidates.length > 0) {
    if (matchedKeyword) {
      const streamMatch = nextGradeCandidates.find(
        (c) =>
          c.id.toLowerCase().includes(matchedKeyword) ||
          c.name.toLowerCase().includes(matchedKeyword) ||
          (c.section && c.section.toLowerCase().includes(matchedKeyword))
      )
      if (streamMatch) {
        return { targetClassId: streamMatch.id, isTerminal: false }
      }
    }

    if (source?.section) {
      const secNorm = source.section.toLowerCase().trim()
      const secMatch = nextGradeCandidates.find(
        (c) => c.section && c.section.toLowerCase().trim() === secNorm
      )
      if (secMatch) {
        return { targetClassId: secMatch.id, isTerminal: false }
      }
    }

    return { targetClassId: nextGradeCandidates[0].id, isTerminal: false }
  }

  // Fallback to first non-source class
  const fallback = classes.find((c) => c.id !== sourceClassId) || classes[0]
  return { targetClassId: fallback ? fallback.id : '', isTerminal: false }
}

import type { StudentWithEnrollment } from '@/lib/types/students'

interface StagedStudent {
  studentId: string
  enrollmentId: string
  fullName: string
  admissionNo: string
  gender: string
  currentRollNumber: number
  targetRollNumber: number
  action: 'promote' | 'repeat' | 'transferred' | 'graduated'
  section: string
  isLateral?: boolean
  isExistingTarget?: boolean
}

interface CohortPromotionWizardProps {
  isPrivileged: boolean
  isEditModeUnlocked: boolean
  onPrecautionWarning?: () => void
  initialSourceClassId?: string
  initialSourceYearId?: string
  initialClasses?: ClassRecord[]
}

export function CohortPromotionWizard({
  isPrivileged,
  isEditModeUnlocked,
  onPrecautionWarning,
  initialSourceClassId,
  initialSourceYearId,
  initialClasses,
}: CohortPromotionWizardProps) {
  // Navigation & Step State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  // Academic Cycles & Classes (Strictly Dynamic Database with resilient fallback)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>(() =>
    initialClasses && initialClasses.length > 0 ? initialClasses : FALLBACK_CLASSES
  )
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)

  // Step 1: Selection State
  const [sourceYearId, setSourceYearId] = useState<string>('2083')
  const [targetYearId, setTargetYearId] = useState<string>('2084')
  const [sourceClassId, setSourceClassId] = useState<string>('12eng')
  const [targetClassId, setTargetClassId] = useState<string>('12eng')
  const [isTerminalGraduation, setIsTerminalGraduation] = useState<boolean>(false)

  // Step 2: Staging Grid State
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false)
  const [stagedStudents, setStagedStudents] = useState<StagedStudent[]>([])
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [stagedNotes, setStagedNotes] = useState<string>('')

  // Lateral Newcomer Modal (Manual Single)
  const [isNewcomerModalOpen, setIsNewcomerModalOpen] = useState<boolean>(false)
  const [newcomerName, setNewcomerName] = useState<string>('')
  const [newcomerAdmNo, setNewcomerAdmNo] = useState<string>('')
  const [newcomerGender, setNewcomerGender] = useState<'male' | 'female' | 'other'>('male')
  const [newcomerRoll, setNewcomerRoll] = useState<string>('')

  // Bulk Newcomer Excel Modal
  const [isBulkNewcomerModalOpen, setIsBulkNewcomerModalOpen] = useState<boolean>(false)
  const [isUploadingBulkNewcomers, setIsUploadingBulkNewcomers] = useState<boolean>(false)
  const [bulkNewcomerError, setBulkNewcomerError] = useState<string | null>(null)
  const [bulkNewcomerSuccessMsg, setBulkNewcomerSuccessMsg] = useState<string | null>(null)
  const [isDownloadingNewcomerTemplate, setIsDownloadingNewcomerTemplate] = useState<boolean>(false)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  // Execution & Receipt
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [executionReceipt, setExecutionReceipt] = useState<PromotionBatchReceipt | null>(null)
  const [executionError, setExecutionError] = useState<string | null>(null)

  // 24-Hour Rollback Drawer State
  const [recentBatches, setRecentBatches] = useState<PromotionBatchHistoryItem[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false)
  const [rollbackTargetBatch, setRollbackTargetBatch] = useState<PromotionBatchHistoryItem | null>(null)
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false)
  const [rollbackFeedback, setRollbackFeedback] = useState<{ text: string; isError?: boolean } | null>(null)

  // 1. Load Academic Years & Classes from DB on mount
  useEffect(() => {
    async function loadMetadata() {
      setIsLoadingMetadata(true)
      try {
        const [yearRes, classRes] = await Promise.allSettled([
          getAcademicYears(),
          getClassesAction(),
        ])
        if (yearRes.status === 'fulfilled' && yearRes.value.success && yearRes.value.data) {
          setAcademicYears(yearRes.value.data)
          const current = yearRes.value.data.find((y) => y.is_current)
          if (current) {
            setSourceYearId(initialSourceYearId || current.id)
            const nextYear = yearRes.value.data.find((y) => y.id !== current.id)
            if (nextYear) setTargetYearId(nextYear.id)
          }
        }
        if (classRes.status === 'fulfilled' && classRes.value.success && classRes.value.data) {
          setClasses(classRes.value.data)
          if (classRes.value.data.length > 0) {
            const initialClass = initialSourceClassId || classRes.value.data[0].id
            setSourceClassId(initialClass)
            const suggestion = suggestTargetClass(initialClass, classRes.value.data)
            setIsTerminalGraduation(suggestion.isTerminal)
            if (!suggestion.isTerminal && suggestion.targetClassId) {
              setTargetClassId(suggestion.targetClassId)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load metadata in promotion wizard:', err)
      } finally {
        setIsLoadingMetadata(false)
      }
    }
    loadMetadata()
  }, [initialSourceClassId, initialSourceYearId])

  // 2. Load Recent Batches for 24-Hour Rollback
  const loadRecentBatches = async () => {
    setIsLoadingBatches(true)
    try {
      const res = await getRecentPromotionBatchesAction()
      if (res && res.success && res.data) {
        setRecentBatches(res.data)
      } else {
        setRecentBatches([])
      }
    } catch {
      setRecentBatches([])
    } finally {
      setIsLoadingBatches(false)
    }
  }

  useEffect(() => {
    loadRecentBatches()
  }, [])

  // Smart source class selector with target class suggestion
  const handleSourceClassChange = (newSourceId: string) => {
    setSourceClassId(newSourceId)
    const suggestion = suggestTargetClass(newSourceId, classes)
    setIsTerminalGraduation(suggestion.isTerminal)
    if (!suggestion.isTerminal && suggestion.targetClassId) {
      setTargetClassId(suggestion.targetClassId)
    }
  }

  const [existingTargetCohort, setExistingTargetCohort] = useState<StudentWithEnrollment[]>([])

  // 3. Step 1 -> Step 2: Fetch Students from DB with Target Class Pre-Flight Awareness
  const handleProceedToStaging = async () => {
    if (!sourceClassId || !sourceYearId || !targetYearId) return
    if (!isTerminalGraduation && (!targetClassId || (sourceClassId === targetClassId && sourceYearId === targetYearId))) {
      setExecutionError('Source and target classes cannot be identical within the same academic cycle.')
      return
    }

    setExecutionError(null)
    setIsLoadingStudents(true)
    try {
      const [sourceRes, targetRes] = await Promise.all([
        getStudentsByClass({
          classId: sourceClassId,
          academicYearId: sourceYearId,
          statusFilter: 'active',
        }),
        !isTerminalGraduation && targetClassId
          ? getStudentsByClass({
              classId: targetClassId,
              academicYearId: targetYearId,
              statusFilter: 'active',
            })
          : Promise.resolve({ success: true, data: [] as StudentWithEnrollment[] }),
      ])

      const existingInTarget = (targetRes.success && targetRes.data) ? targetRes.data : []
      setExistingTargetCohort(existingInTarget)

      if (sourceRes.success && sourceRes.data && sourceRes.data.length > 0) {
        // 1. Map source cohort (Promoted or Graduated)
        const sourceStaged: StagedStudent[] = sourceRes.data.map((s) => ({
          studentId: s.student_id,
          enrollmentId: s.enrollment_id,
          fullName: s.full_name,
          admissionNo: s.admission_no || '',
          gender: s.gender || 'other',
          currentRollNumber: s.roll_number,
          targetRollNumber: 0,
          action: isTerminalGraduation ? 'graduated' : 'promote',
          section: s.section || 'A',
          isLateral: false,
          isExistingTarget: false,
        }))

        // 2. Automatically include existing students in target cohort (e.g. repeaters like Krishma Nepali)
        const existingStaged: StagedStudent[] = !isTerminalGraduation
          ? existingInTarget.map((s) => ({
              studentId: s.student_id,
              enrollmentId: s.enrollment_id,
              fullName: s.full_name,
              admissionNo: s.admission_no || '',
              gender: s.gender || 'other',
              currentRollNumber: s.roll_number,
              targetRollNumber: 0,
              action: 'promote',
              section: s.section || 'A',
              isLateral: false,
              isExistingTarget: true,
            }))
          : []

        // 3. Deduplicate by studentId
        const studentMap = new Map<string, StagedStudent>()
        for (const s of existingStaged) {
          studentMap.set(s.studentId, s)
        }
        for (const s of sourceStaged) {
          studentMap.set(s.studentId, s)
        }

        const combined = Array.from(studentMap.values())

        // 4. In Draft Mode: auto-sort active students A-Z and assign clean rolls 1..N
        if (!isTerminalGraduation) {
          const active = combined.filter((s) => s.action === 'promote' || s.action === 'repeat')
          const inactive = combined.filter((s) => s.action === 'transferred' || s.action === 'graduated')
          const sortedActive = [...active].sort((a, b) => a.fullName.localeCompare(b.fullName))
          let rollCounter = 1
          for (const s of sortedActive) {
            s.targetRollNumber = rollCounter++
          }
          setStagedStudents([...sortedActive, ...inactive])
        } else {
          setStagedStudents(combined)
        }

        setCurrentStep(2)
      } else if (sourceRes.success && sourceRes.data && sourceRes.data.length === 0) {
        setExecutionError(
          `No active students found in ${sourceClassName} for ${sourceYearName}. Please verify Class Roster or select another cohort.`
        )
      } else {
        setExecutionError(sourceRes.error || 'Failed to fetch students in the selected source class.')
      }
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : 'Unknown network error loading cohort.')
    } finally {
      setIsLoadingStudents(false)
    }
  }

  // 4. Action A2: Unified Alphabetical Sort (A to Z by student full name across Promoted, Repeaters & Newcomers)
  const handleSortAlphabetically = () => {
    const active = stagedStudents.filter((s) => s.action === 'promote' || s.action === 'repeat')
    const inactive = stagedStudents.filter((s) => s.action === 'transferred' || s.action === 'graduated')

    // Sort active students strictly A-Z by full name
    const sortedActive = [...active].sort((a, b) => a.fullName.localeCompare(b.fullName))
    let rollCounter = 1
    const resequencedActive = sortedActive.map((s) => ({
      ...s,
      targetRollNumber: rollCounter++,
    }))

    // Inactive remain 0
    const resequencedInactive = inactive.map((s) => ({ ...s, targetRollNumber: 0 }))

    setStagedStudents([...resequencedActive, ...resequencedInactive])
  }

  // Update Individual Student Action with Dynamic Collision-Free Roll Allocation
  const handleStudentActionChange = (
    studentId: string,
    action: 'promote' | 'repeat' | 'transferred' | 'graduated'
  ) => {
    setStagedStudents((prev) => {
      // Find all target rolls currently occupied by other active/repeating students
      const occupiedRolls = new Set<number>()
      for (const other of prev) {
        if (other.studentId !== studentId && (other.action === 'promote' || other.action === 'repeat')) {
          if (other.targetRollNumber > 0) occupiedRolls.add(other.targetRollNumber)
        }
      }

      return prev.map((s) => {
        if (s.studentId !== studentId) return s

        if (action === 'transferred' || action === 'graduated') {
          return { ...s, action, targetRollNumber: 0 }
        }

        // If promoting or repeating, allocate first available non-colliding positive roll
        let assignedRoll = s.targetRollNumber
        if (!assignedRoll || assignedRoll <= 0 || occupiedRolls.has(assignedRoll)) {
          let candidate = 1
          while (occupiedRolls.has(candidate)) {
            candidate++
          }
          assignedRoll = candidate
        }

        return {
          ...s,
          action,
          targetRollNumber: assignedRoll,
        }
      })
    })
  }

  // Update Individual Student Roll Number
  const handleStudentRollChange = (studentId: string, newRoll: number) => {
    setStagedStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, targetRollNumber: newRoll } : s))
    )
  }

  // Bulk Apply Action to All Filtered Students (Assigns Sequential 1..N Rolls to Active/Repeaters)
  const handleBulkAction = (action: 'promote' | 'repeat' | 'transferred' | 'graduated') => {
    setStagedStudents((prev) => {
      if (action === 'transferred' || action === 'graduated') {
        return prev.map((s) => ({ ...s, action, targetRollNumber: 0 }))
      }
      let rollCounter = 1
      return prev.map((s) => ({
        ...s,
        action,
        targetRollNumber: rollCounter++,
      }))
    })
  }

  // Add Lateral Newcomer with Collision-Free Roll
  const handleAddLateralStudent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newcomerName.trim()) return

    const occupiedRolls = new Set<number>(
      stagedStudents
        .filter((s) => s.action === 'promote' || s.action === 'repeat')
        .map((s) => s.targetRollNumber)
    )

    let assignedRoll = newcomerRoll ? parseInt(newcomerRoll, 10) : 1
    if (!newcomerRoll) {
      while (occupiedRolls.has(assignedRoll)) {
        assignedRoll++
      }
    }

    const newStudent: StagedStudent = {
      studentId: `new_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      enrollmentId: `new_enr_${Date.now()}`,
      fullName: newcomerName.trim(),
      // Preserves raw RFID or custom admission number; if none, clean synthetic without transient year
      admissionNo: newcomerAdmNo.trim() || `ADM-${Math.floor(10000 + Math.random() * 90000)}`,
      gender: newcomerGender,
      currentRollNumber: 0,
      targetRollNumber: assignedRoll,
      action: 'promote',
      section: 'A',
      isLateral: true,
    }

    setStagedStudents((prev) => [...prev, newStudent])
    setNewcomerName('')
    setNewcomerAdmNo('')
    setNewcomerRoll('')
    setIsNewcomerModalOpen(false)
  }

  // Remove Lateral Newcomer
  const handleRemoveLateralStudent = (studentId: string) => {
    setStagedStudents((prev) => prev.filter((s) => s.studentId !== studentId))
  }

  // Download Blank Roster Template for Lateral Newcomers
  const handleDownloadNewcomerTemplate = async () => {
    setIsDownloadingNewcomerTemplate(true)
    try {
      const res = await getBlankRosterTemplateAction({
        academicYearId: targetYearId,
        classId: targetClassId,
      })
      if (res.success && res.dataBase64) {
        const link = document.createElement('a')
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.dataBase64}`
        link.download = `Newcomers_Template_${targetClassName.replace(/\s+/g, '_')}_${targetYearName}.xlsx`
        link.click()
      }
    } catch (err) {
      console.error('Failed to download template', err)
    } finally {
      setIsDownloadingNewcomerTemplate(false)
    }
  }

  // Process Bulk Newcomers Spreadsheet Upload
  const handleBulkNewcomerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBulkNewcomerError(null)
    setBulkNewcomerSuccessMsg(null)
    setIsUploadingBulkNewcomers(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await parseNewcomerSpreadsheetAction(formData)
      if (res.success && res.students && res.students.length > 0) {
        const newStudents: StagedStudent[] = res.students.map((r, idx) => ({
          studentId: `new_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          enrollmentId: `new_enr_${Date.now()}_${idx}`,
          fullName: r.fullName,
          // Preserves full 10-digit RFID or custom admission number; if none, clean synthetic without year
          admissionNo: r.admissionNo || `ADM-${Math.floor(10000 + Math.random() * 90000)}`,
          gender: r.gender || 'other',
          currentRollNumber: 0,
          targetRollNumber: r.suggestedRoll || 0,
          action: 'promote',
          section: 'A',
          isLateral: true,
        }))

        setStagedStudents((prev) => [...prev, ...newStudents])
        setBulkNewcomerSuccessMsg(
          `Successfully staged ${newStudents.length} newcomer(s)! Click "Sort Rolls (A–Z)" to sequence rolls across the entire cohort.`
        )
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''
      } else {
        setBulkNewcomerError(res.error || 'No valid student records found in spreadsheet.')
      }
    } catch (err) {
      setBulkNewcomerError(err instanceof Error ? err.message : 'Failed to parse file.')
    } finally {
      setIsUploadingBulkNewcomers(false)
    }
  }

  // Advance from Step 2 to Step 3 (Guarantees clean sequential rolls 1..N)
  const handleProceedToConfirmation = () => {
    const active = stagedStudents.filter((s) => s.action === 'promote' || s.action === 'repeat')
    const hasInvalidRolls = active.some((s) => !s.targetRollNumber || s.targetRollNumber <= 0)
    if (hasInvalidRolls || rollCollisions.length > 0) {
      handleSortAlphabetically()
    }
    setCurrentStep(3)
  }

  // Real-Time Roll Collisions Detection
  const rollCollisions = useMemo(() => {
    const rollMap = new Map<number, string[]>()
    for (const s of stagedStudents) {
      if (s.action === 'promote' || s.action === 'repeat') {
        const roll = s.targetRollNumber || 0
        const list = rollMap.get(roll) || []
        list.push(s.fullName)
        rollMap.set(roll, list)
      }
    }
    const collisions: Array<{ roll: number; names: string[] }> = []
    rollMap.forEach((names, roll) => {
      if (roll === 0 || names.length > 1) {
        collisions.push({ roll, names })
      }
    })
    return collisions
  }, [stagedStudents])

  // Staging Counts Summary
  const summaryCounts = useMemo(() => {
    let promoted = 0
    let repeaters = 0
    let transferred = 0
    let graduated = 0
    let newcomers = 0

    for (const s of stagedStudents) {
      if (s.isLateral) newcomers++
      if (s.action === 'promote') promoted++
      else if (s.action === 'repeat') repeaters++
      else if (s.action === 'transferred') transferred++
      else if (s.action === 'graduated') graduated++
    }

    return {
      promoted,
      repeaters,
      transferred,
      graduated,
      newcomers,
      total: stagedStudents.length,
    }
  }, [stagedStudents])

  // Filtered Students in Staging Table
  const filteredStagedStudents = useMemo(() => {
    if (!searchFilter.trim()) return stagedStudents
    const q = searchFilter.toLowerCase().trim()
    return stagedStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.currentRollNumber.toString().includes(q) ||
        s.targetRollNumber.toString().includes(q)
    )
  }, [stagedStudents, searchFilter])

  // 5. Final Step 3: Execute Cohort Promotion Batch
  const handleExecutePromotion = async () => {
    if (!isEditModeUnlocked) {
      if (onPrecautionWarning) onPrecautionWarning()
      setExecutionError('🔒 Precaution Active: Unlock "Admin Edit Mode" at the top of the page to execute.')
      return
    }

    // Auto-fix any unassigned or colliding rolls via A-Z sort before submitting
    const active = stagedStudents.filter((s) => s.action === 'promote' || s.action === 'repeat')
    const hasInvalidRolls = active.some((s) => !s.targetRollNumber || s.targetRollNumber <= 0)
    if (hasInvalidRolls || rollCollisions.length > 0) {
      handleSortAlphabetically()
    }

    setIsSubmitting(true)
    setExecutionError(null)

    try {
      const regularStudents: PromotionStudentItem[] = stagedStudents
        .filter((s) => !s.isLateral)
        .map((s) => ({
          studentId: s.studentId,
          enrollmentId: s.enrollmentId,
          action: s.action,
          targetRollNumber: s.targetRollNumber,
          section: s.section,
          isExistingTarget: s.isExistingTarget,
        }))

      const lateralNewcomers: LateralNewcomerItem[] = stagedStudents
        .filter((s) => s.isLateral)
        .map((s) => ({
          fullName: s.fullName,
          admissionNo: s.admissionNo,
          gender: s.gender as 'male' | 'female' | 'other',
          targetRollNumber: s.targetRollNumber,
          section: s.section,
        }))

      const res = await executeCohortPromotionBatchAction({
        fromClassId: sourceClassId,
        toClassId: isTerminalGraduation ? undefined : targetClassId,
        fromAcademicYearId: sourceYearId,
        toAcademicYearId: targetYearId,
        isGraduation: isTerminalGraduation,
        students: regularStudents,
        lateralNewcomers,
        notes: stagedNotes,
      })

      if (res.success && res.data) {
        setExecutionReceipt(res.data)
        loadRecentBatches()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('student-roster-updated'))
          window.dispatchEvent(new Event('infrastructure-updated'))
        }
      } else {
        setExecutionError(res.error || 'Failed to execute cohort promotion batch.')
      }
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : 'Unknown transaction failure.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 6. Rollback Batch Execution
  const handleConfirmRollback = async () => {
    if (!rollbackTargetBatch) return
    if (!isEditModeUnlocked) {
      if (onPrecautionWarning) onPrecautionWarning()
      setRollbackFeedback({
        text: '🔒 Precaution Active: Unlock "Admin Edit Mode" to rollback promotions.',
        isError: true,
      })
      return
    }

    setIsRollingBack(true)
    setRollbackFeedback(null)

    try {
      const res = await rollbackCohortPromotionBatchAction(rollbackTargetBatch.batchId)
      if (res.success) {
        setRollbackFeedback({
          text: `Batch ${rollbackTargetBatch.batchId} successfully rolled back. Historical records restored!`,
          isError: false,
        })
        setRollbackTargetBatch(null)
        loadRecentBatches()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('student-roster-updated'))
          window.dispatchEvent(new Event('infrastructure-updated'))
        }
      } else {
        setRollbackFeedback({ text: res.error || 'Failed to rollback batch.', isError: true })
      }
    } catch (err) {
      setRollbackFeedback({
        text: err instanceof Error ? err.message : 'Unknown rollback failure.',
        isError: true,
      })
    } finally {
      setIsRollingBack(false)
    }
  }

  // Strict Empty State UI Alert (User Decision A3)
  if (!isLoadingMetadata && classes.length === 0) {
    return (
      <div className="p-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center space-y-4 font-sans text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold font-heading text-white">System Unconfigured</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No active classes found in the database. Please configure your classes in the Admin Dashboard under Curriculum to activate cohort promotions.
          </p>
        </div>
      </div>
    )
  }

  const sourceClassName = classes.find((c) => c.id === sourceClassId)?.name || sourceClassId
  const targetClassName = classes.find((c) => c.id === targetClassId)?.name || targetClassId
  const sourceYearName = academicYears.find((y) => y.id === sourceYearId)?.name || sourceYearId
  const targetYearName = academicYears.find((y) => y.id === targetYearId)?.name || targetYearId

  return (
    <div className="space-y-6 font-sans text-slate-100 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/[0.08] bg-[#101726] shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <span>Cohort Promotion & Lifecycle Wizard</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Multi-Grade SIS
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Advance student cohorts across academic years with exception triage, A-Z roll allocation, and 24-hour disaster recovery.
            </p>
          </div>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="flex items-center gap-2 bg-[#151E32] p-1.5 rounded-xl border border-white/[0.08] text-xs">
          <span
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              currentStep === 1
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white cursor-pointer'
            }`}
            onClick={() => {
              if (currentStep > 1 && !executionReceipt) setCurrentStep(1)
            }}
          >
            1. Setup
          </span>
          <span
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              currentStep === 2
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white cursor-pointer'
            }`}
            onClick={() => {
              if (stagedStudents.length > 0 && !executionReceipt) setCurrentStep(2)
            }}
          >
            2. Triage & Rolls
          </span>
          <span
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              currentStep === 3
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white cursor-pointer'
            }`}
            onClick={() => {
              if (stagedStudents.length > 0 && !executionReceipt) setCurrentStep(3)
            }}
          >
            3. Confirmation
          </span>
        </div>
      </div>

      {executionError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{executionError}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 1: COHORT SELECTION & PROMOTION TARGET                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {currentStep === 1 && !executionReceipt && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Source Cohort Card */}
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#101726] space-y-4">
            <div className="flex items-center gap-2.5 text-xs font-bold font-heading text-indigo-400 uppercase tracking-wider">
              <Calendar className="h-4 w-4" />
              <span>Source Cohort (Current)</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Academic Year
                </label>
                <select
                  value={sourceYearId}
                  onChange={(e) => setSourceYearId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_current ? '(Current Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Source Class
                </label>
                <select
                  value={sourceClassId}
                  onChange={(e) => handleSourceClassChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.section ? `(${c.section})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Destination Cohort Card */}
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#101726] space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs font-bold font-heading text-emerald-400 uppercase tracking-wider">
                  <ArrowRight className="h-4 w-4" />
                  <span>Destination Target (Upcoming)</span>
                </div>

                {/* Class 12 Terminal Graduation Toggle */}
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTerminalGraduation}
                    onChange={(e) => setIsTerminalGraduation(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-white/20 bg-[#151E32]"
                  />
                  <span className="font-semibold text-[11px]">Terminal Graduation</span>
                </label>
              </div>

              {isTerminalGraduation ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Terminal Class Graduation Workflow</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                    Students will be transitioned to <span className="font-bold">Graduated</span> status and archived. No destination class is required for terminal cohorts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Target Academic Year
                    </label>
                    <select
                      value={targetYearId}
                      onChange={(e) => setTargetYearId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Target Class
                    </label>
                    <select
                      value={targetClassId}
                      onChange={(e) => setTargetClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                      {classes
                        .filter((c) => c.id !== sourceClassId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.section ? `(${c.section})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/[0.08] flex justify-end">
              <button
                type="button"
                onClick={handleProceedToStaging}
                disabled={isLoadingStudents}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isLoadingStudents ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                <span>Load Cohort Students</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 2: INTERACTIVE STAGING GRID (ROLLS & ACTIONS)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {currentStep === 2 && !executionReceipt && (
        <div className="space-y-4">
          
          {/* Action Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl border border-white/[0.08] bg-[#101726]">
            
            {/* Left: Summary Metrics */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold font-heading text-white px-2 py-1 rounded-lg bg-[#151E32] border border-white/[0.08]">
                {sourceClassName} &rarr; {isTerminalGraduation ? 'Graduation' : targetClassName}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Promoted: {summaryCounts.promoted}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Repeaters: {summaryCounts.repeaters}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20">
                Left: {summaryCounts.transferred}
              </span>
              {summaryCounts.newcomers > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Newcomers: {summaryCounts.newcomers}
                </span>
              )}
            </div>

            {/* Right: Accelerators & Modals */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter student..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* 1-Click Unified A-Z Sort */}
              <button
                type="button"
                onClick={handleSortAlphabetically}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-200 font-semibold cursor-pointer transition"
                title="Sort all students A-Z by full name and resequence rolls 1, 2, 3..."
              >
                <ArrowDownAZ className="h-3.5 w-3.5 text-indigo-400" />
                <span>Sort Rolls (A–Z)</span>
              </button>

              {/* Import Newcomers via Spreadsheet (Bulk) */}
              <button
                type="button"
                onClick={() => setIsBulkNewcomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-200 font-semibold cursor-pointer transition"
                title="Bulk import transfer / newcomer students from Excel (.xlsx) or CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-400" />
                <span>Import Newcomers (Excel)</span>
              </button>

              {/* Add Lateral Student (Newcomer Single) */}
              <button
                type="button"
                onClick={() => setIsNewcomerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] hover:bg-white/[0.06] text-slate-200 font-semibold cursor-pointer transition"
              >
                <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
                <span>Add Lateral Student</span>
              </button>

              {/* Quick Bulk Dropdown */}
              <select
                onChange={(e) => {
                  const val = e.target.value as any
                  if (val) handleBulkAction(val)
                }}
                defaultValue=""
                className="px-3 py-1.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-slate-300 font-semibold cursor-pointer focus:outline-none"
              >
                <option value="" disabled>Bulk Action...</option>
                <option value="promote">Mark All Promote</option>
                <option value="repeat">Mark All Repeat</option>
                <option value="transferred">Mark All Left</option>
                {isTerminalGraduation && <option value="graduated">Mark All Graduated</option>}
              </select>

              <button
                type="button"
                onClick={handleProceedToConfirmation}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md transition cursor-pointer"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Destination Class Cohort Awareness Banner */}
          {existingTargetCohort.length > 0 && (
            <div className="p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Target Class Roster: </span>
                  <span>
                    <strong>{targetClassName} ({targetYearName})</strong> already had <strong>{existingTargetCohort.length} enrolled repeater student(s)</strong>, automatically merged into this staging roster. Click <strong>Sort Rolls (A–Z)</strong> anytime to sequence rolls across all students.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                {existingTargetCohort.length} Repeaters Merged
              </span>
            </div>
          )}

          {/* Roll Collisions Alert Banner */}
          {rollCollisions.length > 0 && (
            <div className="p-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">Roll Collision Warning: </span>
                  <span>
                    {rollCollisions.map((c, i) => (
                      <span key={i}>
                        {c.roll === 0 ? 'Missing Roll Number' : `Roll #${c.roll}`} assigned to {c.names.join(' and ')}
                        {i < rollCollisions.length - 1 ? '; ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSortAlphabetically}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
              >
                <ArrowDownAZ className="h-3.5 w-3.5" />
                <span>Auto-Fix with Sort (A–Z)</span>
              </button>
            </div>
          )}

          {/* Interactive Staging Table */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#101726] overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#151E32] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Current Roll</th>
                    <th className="py-3 px-4">Student Name & Admission / RFID</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Promotion Action</th>
                    <th className="py-3 px-4">Target Roll # (Draft)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredStagedStudents.map((student) => {
                    const isPromote = student.action === 'promote'
                    const isRepeat = student.action === 'repeat'
                    const isLeft = student.action === 'transferred'
                    const isGrad = student.action === 'graduated'

                    return (
                      <tr key={student.studentId} className="hover:bg-white/[0.02] transition">
                        
                        {/* Current Roll */}
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-400">
                          {student.isLateral ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans font-bold">
                              NEW
                            </span>
                          ) : student.isExistingTarget ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                              REP #{student.currentRollNumber}
                            </span>
                          ) : (
                            student.currentRollNumber
                          )}
                        </td>

                        {/* Name & Admission */}
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{student.fullName}</span>
                            {student.isExistingTarget && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans font-bold">
                                Target Repeater
                              </span>
                            )}
                            {student.isLateral && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans font-bold">
                                Newcomer
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {student.admissionNo}
                          </div>
                        </td>

                        {/* Gender */}
                        <td className="py-2.5 px-4 text-slate-400 uppercase text-[10px] font-mono">
                          {student.gender}
                        </td>

                        {/* Action Dropdown */}
                        <td className="py-2.5 px-4">
                          <select
                            value={student.action}
                            onChange={(e) =>
                              handleStudentActionChange(
                                student.studentId,
                                e.target.value as any
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none ${
                              isPromote
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                : isRepeat
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : isLeft
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            <option value="promote" className="bg-[#151E32] text-white">
                              {student.isExistingTarget ? `Retain in ${targetClassName}` : `Promote to ${targetClassName}`}
                            </option>
                            <option value="repeat" className="bg-[#151E32] text-white">
                              Repeat in {sourceClassName}
                            </option>
                            <option value="transferred" className="bg-[#151E32] text-white">
                              Transferred / Left School
                            </option>
                            <option value="graduated" className="bg-[#151E32] text-white">
                              Mark as Graduated
                            </option>
                          </select>
                        </td>

                        {/* Target Roll Number (Interactive input) */}
                        <td className="py-2.5 px-4">
                          {isLeft || isGrad ? (
                            <span className="text-slate-500 font-mono text-xs">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                max="250"
                                value={student.targetRollNumber || ''}
                                onChange={(e) =>
                                  handleStudentRollChange(
                                    student.studentId,
                                    parseInt(e.target.value, 10) || 0
                                  )
                                }
                                className={`w-16 px-2 py-1 rounded-lg font-mono tabular-nums text-xs text-center focus:outline-none transition ${
                                  !student.targetRollNumber ||
                                  student.targetRollNumber <= 0 ||
                                  rollCollisions.some(
                                    (c) =>
                                      c.roll === student.targetRollNumber &&
                                      c.names.length > 1
                                  )
                                    ? 'border border-rose-500 bg-rose-500/20 text-rose-200 focus:ring-1 focus:ring-rose-400'
                                    : 'border border-white/[0.08] bg-[#151E32] text-white focus:border-indigo-500/50'
                                }`}
                              />
                              <span className="text-[10px] text-slate-500 font-mono">Draft</span>
                            </div>
                          )}
                        </td>

                        {/* Delete (Lateral Only) */}
                        <td className="py-2.5 px-4 text-right">
                          {student.isLateral && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLateralStudent(student.studentId)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Remove lateral entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* STEP 3: PRE-FLIGHT AUDIT REVIEW & SAFETY LOCK CONFIRMATION   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {currentStep === 3 && !executionReceipt && (
        <div className="space-y-6">
          
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Promoted</span>
              <div className="text-xl font-extrabold font-heading text-indigo-400 tabular-nums">
                {summaryCounts.promoted}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repeaters</span>
              <div className="text-xl font-extrabold font-heading text-amber-400 tabular-nums">
                {summaryCounts.repeaters}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Left/Transfer</span>
              <div className="text-xl font-extrabold font-heading text-rose-400 tabular-nums">
                {summaryCounts.transferred}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Graduated</span>
              <div className="text-xl font-extrabold font-heading text-emerald-400 tabular-nums">
                {summaryCounts.graduated}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Newcomers</span>
              <div className="text-xl font-extrabold font-heading text-cyan-400 tabular-nums">
                {summaryCounts.newcomers}
              </div>
            </div>
          </div>

          {/* Audit Verification Details */}
          <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#101726] space-y-4 text-xs">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-400" />
              <span>Pre-Flight Confirmation Ledger</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300">
              <div className="p-3.5 rounded-xl bg-[#151E32] border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Source Cohort</span>
                <p className="font-semibold text-white">
                  {sourceClassName} &bull; Academic Year {sourceYearName}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#151E32] border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Target Cohort</span>
                <p className="font-semibold text-white">
                  {isTerminalGraduation ? 'Class 12 Graduation (Terminal)' : `${targetClassName} • Academic Year ${targetYearName}`}
                </p>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Promotion Audit Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. End of Term Board Result Promotion 2083/84..."
                value={stagedNotes}
                onChange={(e) => setStagedNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Repeaters Allocation Preview */}
            {summaryCounts.repeaters > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <div className="font-bold text-amber-300 mb-1.5 flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{summaryCounts.repeaters} Student(s) Repeating in {sourceClassName} ({targetYearName}):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stagedStudents
                    .filter((s) => s.action === 'repeat')
                    .map((s) => (
                      <span key={s.studentId} className="px-2.5 py-1 rounded-lg bg-[#151E32] border border-amber-500/30 font-mono text-[11px] text-amber-300">
                        {s.fullName} &bull; Target Roll #{s.targetRollNumber}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Roll Collisions Blocker */}
            {rollCollisions.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <div className="font-bold">⚠️ Cannot Execute: Roll Number Collision</div>
                  <div className="text-[11px] text-rose-200/80">
                    Duplicate or invalid roll numbers detected ({rollCollisions.map((c) => `Roll #${c.roll} [${c.names.join(', ')}]`).join('; ')}). Please return to Staging to resolve collisions or click 'Sort Rolls (A–Z)'.
                  </div>
                </div>
              </div>
            )}

            {/* Safety Lock Warning */}
            {!isEditModeUnlocked && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <div>
                  <div className="font-bold">🔒 Precaution Mode Active</div>
                  <div className="text-[11px] text-amber-200/80">
                    To execute this promotion batch, you must unlock the "Admin Edit Mode" safety toggle at the top of the Admin dashboard.
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition"
              >
                Back to Staging
              </button>

              <button
                type="button"
                onClick={handleExecutePromotion}
                disabled={isSubmitting || !isEditModeUnlocked || rollCollisions.length > 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span>Execute Cohort Promotion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* EXECUTION SUCCESS RECEIPT                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {executionReceipt && (
        <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold font-heading text-white">Cohort Successfully Promoted!</h3>
            <p className="text-xs text-emerald-200/80 max-w-md mx-auto mt-1">
              Batch <span className="font-mono font-bold text-white">{executionReceipt.batchId}</span> was committed to PostgreSQL. Historical records are preserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold">
              Promoted: {executionReceipt.promotedCount}
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold">
              Repeaters: {executionReceipt.retainedCount}
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold">
              Left: {executionReceipt.transferredCount}
            </span>
            <span className="px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold">
              Graduated: {executionReceipt.graduatedCount}
            </span>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setExecutionReceipt(null)
                setCurrentStep(1)
              }}
              className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold transition"
            >
              Promote Another Cohort
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 24-HOUR DISASTER ROLLBACK CARD                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#101726] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold font-heading text-white">
            <History className="h-4 w-4 text-indigo-400" />
            <span>Recent Promotions & 24-Hour Rollback Drawer</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Allows 1-click reversal of accidental promotions within 48 hours
          </span>
        </div>

        {rollbackFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs ${
              rollbackFeedback.isError
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {rollbackFeedback.text}
          </div>
        )}

        {isLoadingBatches ? (
          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span>Loading recent promotion batches...</span>
          </div>
        ) : recentBatches.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No promotion batches executed in the last 48 hours.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05] text-xs">
            {recentBatches.map((batch) => (
              <div key={batch.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{batch.entityLabel}</span>
                    <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.06]">
                      {batch.batchId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>By {batch.actorName}</span>
                    <span>&bull;</span>
                    <span>{new Date(batch.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[11px] text-slate-300 font-mono tabular-nums">
                    {batch.metadata.promotedCount} promoted, {batch.metadata.retainedCount} retained
                  </div>

                  <button
                    type="button"
                    onClick={() => setRollbackTargetBatch(batch)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold cursor-pointer transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Revert Batch</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD LATERAL NEWCOMER                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isNewcomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-heading text-white">
                  Add Lateral Student (Newcomer)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewcomerModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddLateralStudent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Student Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bipin Adhikari"
                  value={newcomerName}
                  onChange={(e) => setNewcomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Admission Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1641052469 (RFID) or ADM-10042"
                  value={newcomerAdmNo}
                  onChange={(e) => setNewcomerAdmNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Gender
                  </label>
                  <select
                    value={newcomerGender}
                    onChange={(e) => setNewcomerGender(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Target Roll #
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Auto-assigned if blank"
                    value={newcomerRoll}
                    onChange={(e) => setNewcomerRoll(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-[#151E32] text-white font-mono text-center focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsNewcomerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Add to Staging</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: BULK IMPORT NEWCOMERS VIA SPREADSHEET                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isBulkNewcomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#101726] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading text-white">
                    Bulk Import Newcomers (Excel / CSV)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Target Class: <strong className="text-white">{targetClassName}</strong> ({targetYearName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkNewcomerModalOpen(false)
                  setBulkNewcomerError(null)
                  setBulkNewcomerSuccessMsg(null)
                }}
                className="text-slate-400 hover:text-white cursor-pointer p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {bulkNewcomerError && (
              <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{bulkNewcomerError}</span>
              </div>
            )}

            {bulkNewcomerSuccessMsg && (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{bulkNewcomerSuccessMsg}</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#151E32] border border-white/[0.06] space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-white flex items-center justify-between">
                <span>Spreadsheet Column Headers</span>
                <button
                  type="button"
                  onClick={handleDownloadNewcomerTemplate}
                  disabled={isDownloadingNewcomerTemplate}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingNewcomerTemplate ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>Download Blank Template</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Accepted columns: <code className="text-indigo-300 font-mono">Full Name *</code>, <code className="text-indigo-300 font-mono">RFID / Admission No</code>, <code className="text-indigo-300 font-mono">Gender</code>, <code className="text-indigo-300 font-mono">Contact</code>, <code className="text-indigo-300 font-mono">Registration No</code>.
              </p>
              <p className="text-[10px] text-slate-400">
                • <strong>RFID smart card numbers</strong> (e.g. 10-digit <span className="font-mono text-slate-200">1641052469</span>) are preserved in full without alteration.
              </p>
            </div>

            {/* Drag & Drop Upload Well */}
            <div
              onClick={() => bulkFileInputRef.current?.click()}
              className="p-6 rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-indigo-500/50 bg-[#151E32]/60 hover:bg-[#151E32] transition cursor-pointer text-center space-y-2 group"
            >
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleBulkNewcomerFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                {isUploadingBulkNewcomers ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
              </div>
              <div className="text-xs font-semibold text-white">
                {isUploadingBulkNewcomers ? 'Parsing spreadsheet rows...' : 'Click to select Excel (.xlsx) or CSV file'}
              </div>
              <p className="text-[11px] text-slate-400">
                Newcomers will be added directly into the Step 2 staging roster.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setIsBulkNewcomerModalOpen(false)
                  setBulkNewcomerError(null)
                  setBulkNewcomerSuccessMsg(null)
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ROLLBACK CONFIRMATION                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {rollbackTargetBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#101726] shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold font-heading text-white">
                Confirm Promotion Reversal
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to revert promotion batch{' '}
              <span className="font-mono font-bold text-white">{rollbackTargetBatch.batchId}</span>?
              This will remove all target enrollments created during this batch and restore previous student enrollments back to <span className="font-semibold text-emerald-300">Active</span> status.
            </p>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs">
              Batch: <span className="font-semibold">{rollbackTargetBatch.entityLabel}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setRollbackTargetBatch(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                disabled={isRollingBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {isRollingBack ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                <span>Confirm & Revert</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
