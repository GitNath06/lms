import type { StudentRow, StudentEnrollmentRow } from '@/types/database'

export interface Student extends StudentRow {}

export interface StudentEnrollment extends StudentEnrollmentRow {}

export interface StudentWithEnrollment {
  student_id: string
  enrollment_id: string
  full_name: string
  roll_number: number
  admission_no: string | null
  registration_no: string | null
  gender: 'male' | 'female' | 'other' | null
  class_id: string
  academic_year_id: string
  section: string | null
  enrollment_status: 'active' | 'transferred' | 'graduated' | 'archived'
  is_active: boolean
  assigned_workstation_label?: string | null
  is_unseated?: boolean
  photo_url?: string | null
}

export interface StudentFilterParams {
  query?: string
  academicYearId?: string
  classId?: string
  status?: 'active' | 'transferred' | 'graduated' | 'archived' | 'all'
  page?: number
  limit?: number
}

export interface UpsertStudentInput {
  id?: string
  admission_no?: string | null
  registration_no?: string | null
  full_name: string
  gender?: 'male' | 'female' | 'other' | null
  dob_bs?: string | null
  dob_ad?: string | null
  guardian_name?: string | null
  guardian_phone?: string | null
  email?: string | null
  photo_url?: string | null
}

export interface EnrollStudentInput {
  student_id: string
  academic_year_id: string
  class_id: string
  roll_number: number
  section?: string | null
  status?: 'active' | 'transferred' | 'graduated' | 'archived'
}

export interface CreateStudentWithEnrollmentInput {
  student: UpsertStudentInput
  enrollment: {
    academic_year_id: string
    class_id: string
    roll_number: number
    section?: string | null
  }
}
