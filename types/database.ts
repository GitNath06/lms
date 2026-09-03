export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'admin' | 'teacher'
          department: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'admin' | 'teacher'
          department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'admin' | 'teacher'
          department?: string | null
          created_at?: string
        }
      }
      labs: {
        Row: {
          id: string
          name: string
          type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity: number
          is_active: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          name: string
          type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          lab_id: string
          teacher_id: string | null
          subject_name: string
          batch_name: string
          start_time: string
          end_time: string
          is_merged: boolean
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          slot_id?: string | null
          day_key?: string | null
          span?: number | null
          metadata?: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          teacher_id?: string | null
          subject_name: string
          batch_name: string
          start_time: string
          end_time: string
          is_merged?: boolean
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          slot_id?: string | null
          day_key?: string | null
          span?: number | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          teacher_id?: string | null
          subject_name?: string
          batch_name?: string
          start_time?: string
          end_time?: string
          is_merged?: boolean
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          slot_id?: string | null
          day_key?: string | null
          span?: number | null
          metadata?: Json | null
          created_at?: string
        }
      }
      practical_logs: {
        Row: {
          id: string
          schedule_id: string | null
          lab_id: string
          teacher_id: string | null
          date: string
          period_label: string
          subject_name: string
          batch_group: string
          practical_title: string
          total_students: number
          present_students: number
          absent_students: number
          remarks: string | null
          status?: 'conducted' | 'skipped' | null
          skip_reason?: string | null
          topic_learned?: string | null
          logged_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          lab_id: string
          teacher_id?: string | null
          date?: string
          period_label: string
          subject_name: string
          batch_group: string
          practical_title: string
          total_students?: number
          present_students?: number
          absent_students?: number
          remarks?: string | null
          status?: 'conducted' | 'skipped' | null
          skip_reason?: string | null
          topic_learned?: string | null
          logged_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          lab_id?: string
          teacher_id?: string | null
          date?: string
          period_label?: string
          subject_name?: string
          batch_group?: string
          practical_title?: string
          total_students?: number
          present_students?: number
          absent_students?: number
          remarks?: string | null
          status?: 'conducted' | 'skipped' | null
          skip_reason?: string | null
          topic_learned?: string | null
          logged_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'teacher'
      lab_type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
      session_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
    }
  }
}
