import type { AcademicYearRow } from '@/types/database'

export interface AcademicYear extends AcademicYearRow {}

export interface CreateAcademicYearInput {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current?: boolean
}

export interface UpdateAcademicYearInput {
  id: string
  name?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  is_archived?: boolean
}

export interface AcademicYearDependencyReport {
  yearId: string
  yearName: string
  isCurrent: boolean
  practicalLogsCount: number
  enrollmentsCount: number
  seatPlansCount: number
  classSubjectsCount: number
  schedulesCount: number
  totalDependencies: number
  canDelete: boolean
  blockReason?: string
}

export interface StudentPromotionException {
  studentId: string
  action: 'repeat' | 'archive'
}

export interface PromoteCohortInput {
  fromClassId: string
  toClassId: string
  fromAcademicYearId: string
  toAcademicYearId: string
  exceptions?: StudentPromotionException[]
  internalBypassScopeCheck?: boolean
}

export interface PromoteCohortResult {
  promotedCount: number
  retainedCount: number
  archivedCount: number
}


export interface PromotionStudentItem {
  studentId: string
  enrollmentId: string
  action: 'promote' | 'repeat' | 'transferred' | 'graduated'
  targetRollNumber?: number
  section?: string
  isExistingTarget?: boolean
}

export interface LateralNewcomerItem {
  fullName: string
  admissionNo: string
  gender?: 'male' | 'female' | 'other'
  targetRollNumber: number
  section?: string
}

export interface ExecuteCohortPromotionBatchInput {
  fromClassId: string
  toClassId?: string
  fromAcademicYearId: string
  toAcademicYearId: string
  isGraduation?: boolean
  students: PromotionStudentItem[]
  lateralNewcomers?: LateralNewcomerItem[]
  notes?: string
}

export interface PromotionBatchReceipt {
  batchId: string
  promotedCount: number
  retainedCount: number
  transferredCount: number
  graduatedCount: number
  newcomersCount: number
  totalProcessed: number
}

export interface PromotionBatchHistoryItem {
  id: string
  batchId: string
  createdAt: string
  actorName: string
  entityLabel: string
  metadata: {
    batchId: string
    fromClassId: string
    toClassId?: string
    fromAcademicYearId: string
    toAcademicYearId: string
    isGraduation?: boolean
    promotedCount: number
    retainedCount: number
    transferredCount: number
    graduatedCount: number
    newcomersCount: number
    notes?: string
  }
}
