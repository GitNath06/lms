export interface ClassRecord {
  id: string
  name: string
  grade?: number | null
  section?: string | null
  stream_id?: string | null
  capacity: number
  is_active: boolean
  created_at?: string
}

export interface ClassEnrollmentStat {
  class_id: string
  enrolled_count: number
}
