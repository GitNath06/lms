export interface SubjectRecord {
  id: string
  code: string
  name: string
  default_lab_id: string | null
  credit_hours: number | null
  is_active: boolean
  created_at?: string
}

export interface CreateSubjectInput {
  id?: string
  code: string
  name: string
  default_lab_id?: string | null
  credit_hours?: number | null
  is_active?: boolean
}

export interface UpdateSubjectInput {
  code?: string
  name?: string
  default_lab_id?: string | null
  credit_hours?: number | null
  is_active?: boolean
}

export interface ClassSubjectRecord {
  id: string
  academic_year_id: string | null
  class_id: string
  subject_id: string
  teacher_id: string | null
  default_lab_id: string | null
  created_at?: string
  // Enriched joined fields
  class_name?: string
  subject_code?: string
  subject_name?: string
  teacher_name?: string
  lab_name?: string
}

export interface AssignSubjectToClassInput {
  academic_year_id?: string | null
  class_id: string
  subject_id: string
  teacher_id?: string | null
  default_lab_id?: string | null
}
