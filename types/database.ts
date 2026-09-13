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
          email: string | null
          phone: string | null
          full_name: string
          role: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'admin'
          department: string | null
          is_active: boolean
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          permissions: Record<string, boolean> | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          phone?: string | null
          full_name: string
          role?: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'admin'
          department?: string | null
          is_active?: boolean
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          permissions?: Record<string, boolean> | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          phone?: string | null
          full_name?: string
          role?: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'admin'
          department?: string | null
          is_active?: boolean
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          permissions?: Record<string, boolean> | null
          created_at?: string
        }
      }
      labs: {
        Row: {
          id: string
          name: string
          type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity: number
          status: 'Operational' | 'Under Maintenance' | 'Inactive'
          is_active: boolean
          created_at?: string
        }
        Insert: {
          id?: string
          name: string
          type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity?: number
          status?: 'Operational' | 'Under Maintenance' | 'Inactive'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
          capacity?: number
          status?: 'Operational' | 'Under Maintenance' | 'Inactive'
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
          experiment_name?: string | null
          absent_roll_numbers?: (number | string)[] | string | null
          verification_remarks?: string | null
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
          experiment_name?: string | null
          absent_roll_numbers?: (number | string)[] | string | null
          verification_remarks?: string | null
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
          experiment_name?: string | null
          absent_roll_numbers?: (number | string)[] | string | null
          verification_remarks?: string | null
          logged_by?: string | null
          created_at?: string
        }
      }
      lab_incidents: {
        Row: {
          id: string
          lab_id: string
          schedule_id: string | null
          date: string
          session_label: string
          subject_name: string
          subject_teacher_name: string
          batch_name: string
          title: string
          incident_type: 'breakage' | 'malfunction' | 'chemical_hazard' | 'burnt_apparatus' | 'missing' | 'other' | string
          severity: 'minor' | 'moderate' | 'major_critical'
          equipment_name: string
          quantity: number
          student_rolls: string | null
          status: 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
          escalated_to_hod: boolean
          escalation_reason: string | null
          escalated_at: string | null
          resolution_notes: string | null
          resolved_by: string | null
          resolved_by_id: string | null
          resolved_at: string | null
          reported_by: string
          reported_by_id: string | null
          circumstances: string | null
          photo_url: string | null
          is_fined: boolean
          fine_amount: number | null
          fine_paid: boolean
          fine_receipt_no: string | null
          created_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          schedule_id?: string | null
          date?: string
          session_label: string
          subject_name: string
          subject_teacher_name: string
          batch_name: string
          title: string
          incident_type?: 'breakage' | 'malfunction' | 'chemical_hazard' | 'burnt_apparatus' | 'missing' | 'other' | string
          severity?: 'minor' | 'moderate' | 'major_critical'
          equipment_name: string
          quantity?: number
          student_rolls?: string | null
          status?: 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
          escalated_to_hod?: boolean
          escalation_reason?: string | null
          escalated_at?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_by_id?: string | null
          resolved_at?: string | null
          reported_by?: string
          reported_by_id?: string | null
          circumstances?: string | null
          photo_url?: string | null
          is_fined?: boolean
          fine_amount?: number
          fine_paid?: boolean
          fine_receipt_no?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          schedule_id?: string | null
          date?: string
          session_label?: string
          subject_name?: string
          subject_teacher_name?: string
          batch_name?: string
          title?: string
          incident_type?: 'breakage' | 'malfunction' | 'chemical_hazard' | 'burnt_apparatus' | 'missing' | 'other' | string
          severity?: 'minor' | 'moderate' | 'major_critical'
          equipment_name?: string
          quantity?: number
          student_rolls?: string | null
          status?: 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
          escalated_to_hod?: boolean
          escalation_reason?: string | null
          escalated_at?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_by_id?: string | null
          resolved_at?: string | null
          reported_by?: string
          reported_by_id?: string | null
          circumstances?: string | null
          photo_url?: string | null
          is_fined?: boolean
          fine_amount?: number
          fine_paid?: boolean
          fine_receipt_no?: string | null
          created_at?: string
        }
      }
      lab_notifications: {
        Row: {
          id: string
          incident_id: string | null
          target_role: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'all' | string
          target_lab_id: string | null
          title: string
          message: string
          severity: 'info' | 'warning' | 'critical'
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          incident_id?: string | null
          target_role: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'all' | string
          target_lab_id?: string | null
          title: string
          message: string
          severity?: 'info' | 'warning' | 'critical'
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          incident_id?: string | null
          target_role?: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'all' | string
          target_lab_id?: string | null
          title?: string
          message?: string
          severity?: 'info' | 'warning' | 'critical'
          is_read?: boolean
          created_at?: string
        }
      }
      streams: {
        Row: {
          id: string
          name: string
          code: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          created_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          name: string
          grade: number | null
          section: string | null
          stream_id: string | null
          capacity: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          grade?: number | null
          section?: string | null
          stream_id?: string | null
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          grade?: number | null
          section?: string | null
          stream_id?: string | null
          capacity?: number
          is_active?: boolean
          created_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          code: string
          name: string
          default_lab_id: string | null
          credit_hours: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          code: string
          name: string
          default_lab_id?: string | null
          credit_hours?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          default_lab_id?: string | null
          credit_hours?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      class_subjects: {
        Row: {
          id: string
          class_id: string
          subject_id: string
          teacher_id: string | null
          default_lab_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          subject_id: string
          teacher_id?: string | null
          default_lab_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          subject_id?: string
          teacher_id?: string | null
          default_lab_id?: string | null
          created_at?: string
        }
      }
      log_attendance: {
        Row: {
          id: string
          log_id: string
          roll_number: number
          is_present: boolean
          created_at: string
        }
        Insert: {
          id?: string
          log_id: string
          roll_number: number
          is_present?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          log_id?: string
          roll_number?: number
          is_present?: boolean
          created_at?: string
        }
      }
      teacher_substitutions: {
        Row: {
          id: string
          schedule_id: string | null
          date: string
          slot_id: string
          lab_id: string
          original_teacher_id: string
          original_teacher_name: string
          substitute_teacher_id: string
          substitute_teacher_name: string
          reason: string | null
          status: 'assigned' | 'completed' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          date?: string
          slot_id?: string
          lab_id: string
          original_teacher_id: string
          original_teacher_name: string
          substitute_teacher_id: string
          substitute_teacher_name: string
          reason?: string | null
          status?: 'assigned' | 'completed' | 'cancelled'
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          date?: string
          slot_id?: string
          lab_id?: string
          original_teacher_id?: string
          original_teacher_name?: string
          substitute_teacher_id?: string
          substitute_teacher_name?: string
          reason?: string | null
          status?: 'assigned' | 'completed' | 'cancelled'
          created_at?: string
        }
      }
      faculty_substitutions: {
        Row: {
          id: string
          schedule_id: string | null
          date: string
          slot_id: string
          lab_id: string
          original_teacher_id: string
          original_teacher_name: string
          substitute_teacher_id: string
          substitute_teacher_name: string
          reason: string | null
          status: 'assigned' | 'completed' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          date?: string
          slot_id?: string
          lab_id: string
          original_teacher_id: string
          original_teacher_name: string
          substitute_teacher_id: string
          substitute_teacher_name: string
          reason?: string | null
          status?: 'assigned' | 'completed' | 'cancelled'
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          date?: string
          slot_id?: string
          lab_id?: string
          original_teacher_id?: string
          original_teacher_name?: string
          substitute_teacher_id?: string
          substitute_teacher_name?: string
          reason?: string | null
          status?: 'assigned' | 'completed' | 'cancelled'
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
      user_role: 'super_admin' | 'lab_incharge' | 'hod' | 'teacher' | 'admin'
      lab_type: 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'biology_lab' | 'electronics_lab'
      session_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
    }
  }
}
