import type { UserProfile } from '@/lib/permissions'

export interface BootstrapDataPayload {
  academic_years: Array<{
    id: string
    name: string
    start_date: string
    end_date: string
    is_current: boolean
    is_archived?: boolean
  }>
  labs: Array<{
    id: string
    name: string
    code: string
    type: string
    capacity: number
    status: string
    is_active?: boolean
  }>
  classes: Array<{
    id: string
    name: string
    grade: string
    section: string
    stream_id: string
    capacity: number
    is_active?: boolean
  }>
  subjects: Array<{
    id: string
    code: string
    name: string
    default_lab_id?: string
    credit_hours?: number
    is_active?: boolean
  }>
  class_subjects: Array<{
    id: string
    class_id: string
    subject_id: string
    teacher_id?: string
    default_lab_id?: string
    academic_year_id?: string
    subject_code?: string
    subject_name?: string
    class_name?: string
    teacher_name?: string
    lab_name?: string
  }>
  teachers: Array<{
    id: string
    full_name: string
    email: string
    role: string
    department?: string | null
    photo_url?: string | null
  }>
  academic_holidays: Array<{
    id: string
    name: string
    date_start: string
    date_end: string
    type?: string
  }>
  issue_categories: Array<{
    id: string
    name: string
    type: string
    color?: string
    icon?: string
    default_severity?: string
    is_active?: boolean
    sort_order?: number
  }>
  period_settings: any
  user_profile?: UserProfile | null
  user_scope?: any | null
}

