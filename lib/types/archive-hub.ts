export type ArchiveCategoryType = 'trash' | 'graduated' | 'transferred' | 'academic_years' | 'infrastructure'

export interface ArchivedStudentRecord {
  studentId: string
  enrollmentId: string | null
  fullName: string
  admissionNo: string | null
  registrationNo: string | null
  gender: string | null
  classId: string | null
  className: string | null
  academicYearId: string | null
  academicYearName: string | null
  rollNumber: number | null
  section: string | null
  enrollmentStatus: string
  isStudentActive: boolean
  archivedAt: string | null
  archiveReason: string | null
  attendanceCount: number
  canPermanentPurge: boolean
}

export interface ArchivedAcademicYearRecord {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  isArchived: boolean
  totalLogs: number
  totalEnrollments: number
}

export interface ArchivedInfrastructureRecord {
  id: string
  type: 'lab' | 'incident_category'
  name: string
  codeOrSeverity?: string
  status: string
  createdAt: string
}

export interface ArchiveHubTelemetry {
  trashCount: number
  graduatedCount: number
  transferredCount: number
  archivedYearsCount: number
  inactiveLabsCount: number
  archivedCategoriesCount: number
}
