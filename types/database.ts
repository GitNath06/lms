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
          photo_url?: string | null
          avatar_url?: string | null
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
          photo_url?: string | null
          avatar_url?: string | null
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
          photo_url?: string | null
          avatar_url?: string | null
          is_active?: boolean
          approval_status?: 'pending' | 'approved' | 'rejected' | null
          permissions?: Record<string, boolean> | null
          created_at?: string
        }
        Relationships: []
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
        Relationships: []
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
          class_subject_id?: string | null
          academic_year_id?: string | null
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
          class_subject_id?: string | null
          academic_year_id?: string | null
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
          class_subject_id?: string | null
          academic_year_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
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
          class_subject_id?: string | null
          academic_year_id?: string | null
          seating_snapshot?: Json | null
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
          class_subject_id?: string | null
          academic_year_id?: string | null
          seating_snapshot?: Json | null
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
          class_subject_id?: string | null
          academic_year_id?: string | null
          seating_snapshot?: Json | null
          created_at?: string
        }
        Relationships: []
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
          class_id?: string | null
          subject_id?: string | null
          subject_teacher_id?: string | null
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
          class_id?: string | null
          subject_id?: string | null
          subject_teacher_id?: string | null
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
          class_id?: string | null
          subject_id?: string | null
          subject_teacher_id?: string | null
          is_fined?: boolean
          fine_amount?: number
          fine_paid?: boolean
          fine_receipt_no?: string | null
          created_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      class_subjects: {
        Row: {
          id: string
          academic_year_id?: string | null
          class_id: string
          subject_id: string
          teacher_id: string | null
          default_lab_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          academic_year_id?: string | null
          class_id: string
          subject_id: string
          teacher_id?: string | null
          default_lab_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          academic_year_id?: string | null
          class_id?: string
          subject_id?: string
          teacher_id?: string | null
          default_lab_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      log_attendance: {
        Row: {
          id: string
          log_id: string
          enrollment_id?: string | null
          roll_number: number
          student_id: string | null
          is_present: boolean
          created_at: string
        }
        Insert: {
          id?: string
          log_id: string
          enrollment_id?: string | null
          roll_number: number
          student_id?: string | null
          is_present?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          log_id?: string
          enrollment_id?: string | null
          roll_number?: number
          student_id?: string | null
          is_present?: boolean
          created_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      academic_holidays: {
        Row: {
          id: string
          title: string
          name: string
          title_np: string | null
          date_start: string
          date_end: string | null
          bs_date_str: string | null
          holiday_type: string
          description: string | null
          practicals_suspended: boolean
          is_national: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          title: string
          name?: string
          title_np?: string | null
          date_start: string
          date_end?: string | null
          bs_date_str?: string | null
          holiday_type?: string
          description?: string | null
          practicals_suspended?: boolean
          is_national?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          name?: string
          title_np?: string | null
          date_start?: string
          date_end?: string | null
          bs_date_str?: string | null
          holiday_type?: string
          description?: string | null
          practicals_suspended?: boolean
          is_national?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_plans: {
        Row: {
          id: string
          lab_id: string
          title: string
          category: string
          interval_days: number
          severity: 'low' | 'routine' | 'high' | 'critical'
          target_role: string
          assigned_user_id: string | null
          checklist: string[] | Json
          is_active: boolean
          description: string | null
          affected_machines?: string[] | null
          fleet_progress?: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          title: string
          category: string
          interval_days: number
          severity?: 'low' | 'routine' | 'high' | 'critical'
          target_role?: string
          assigned_user_id?: string | null
          checklist?: string[] | Json
          is_active?: boolean
          description?: string | null
          affected_machines?: string[] | null
          fleet_progress?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          title?: string
          category?: string
          interval_days?: number
          severity?: 'low' | 'routine' | 'high' | 'critical'
          target_role?: string
          assigned_user_id?: string | null
          checklist?: string[] | Json
          is_active?: boolean
          description?: string | null
          affected_machines?: string[] | null
          fleet_progress?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      maintenance_reminders: {
        Row: {
          id: string
          plan_id: string
          lab_id: string
          title: string
          due_date: string
          status: 'pending' | 'snoozed' | 'in_progress' | 'completed' | 'overdue'
          snoozed_until: string | null
          snooze_reason: string | null
          snooze_count: number
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          lab_id: string
          title: string
          due_date: string
          status?: 'pending' | 'snoozed' | 'in_progress' | 'completed' | 'overdue'
          snoozed_until?: string | null
          snooze_reason?: string | null
          snooze_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          lab_id?: string
          title?: string
          due_date?: string
          status?: 'pending' | 'snoozed' | 'in_progress' | 'completed' | 'overdue'
          snoozed_until?: string | null
          snooze_reason?: string | null
          snooze_count?: number
          created_at?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          id: string
          plan_id: string | null
          reminder_id: string | null
          lab_id: string
          asset_identifier: string
          work_performed: string
          checklist_completed: string[] | Json
          parts_replaced: string | null
          cost_incurred: number
          service_date: string
          performed_by_id: string
          next_service_due: string | null
          remarks: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id?: string | null
          reminder_id?: string | null
          lab_id: string
          asset_identifier: string
          work_performed: string
          checklist_completed?: string[] | Json
          parts_replaced?: string | null
          cost_incurred?: number
          service_date?: string
          performed_by_id: string
          next_service_due?: string | null
          remarks?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string | null
          reminder_id?: string | null
          lab_id?: string
          asset_identifier?: string
          work_performed?: string
          checklist_completed?: string[] | Json
          parts_replaced?: string | null
          cost_incurred?: number
          service_date?: string
          performed_by_id?: string
          next_service_due?: string | null
          remarks?: string | null
          created_at?: string
        }
        Relationships: []
      }
      rate_limit_events: {
        Row: {
          id: string
          key: string
          action: string
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          action: string
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          action?: string
          created_at?: string
        }
        Relationships: []
      }
      print_selection_tokens: {
        Row: {
          token: string
          ids: string[]
          created_at: string
          expires_at: string
        }
        Insert: {
          token: string
          ids: string[]
          created_at?: string
          expires_at: string
        }
        Update: {
          token?: string
          ids?: string[]
          created_at?: string
          expires_at?: string
        }
        Relationships: []
      }
      issue_categories: {
        Row: {
          id: string
          name: string
          type: 'hardware' | 'software' | 'network' | 'peripheral' | 'other'
          color: string
          icon: string
          default_severity: 'low' | 'medium' | 'high' | 'critical'
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'hardware' | 'software' | 'network' | 'peripheral' | 'other'
          color?: string
          icon?: string
          default_severity?: 'low' | 'medium' | 'high' | 'critical'
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: 'hardware' | 'software' | 'network' | 'peripheral' | 'other'
          color?: string
          icon?: string
          default_severity?: 'low' | 'medium' | 'high' | 'critical'
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workstations: {
        Row: {
          id: string
          lab_id: string
          label: string
          pos_x: number
          pos_y: number
          device_type: 'desktop' | 'aio' | 'laptop' | 'server'
          row_label: string | null
          position_id: string | null
          lan_ip: string | null
          pairing_token: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          label: string
          pos_x?: number
          pos_y?: number
          device_type?: 'desktop' | 'aio' | 'laptop' | 'server'
          row_label?: string | null
          position_id?: string | null
          lan_ip?: string | null
          pairing_token?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          label?: string
          pos_x?: number
          pos_y?: number
          device_type?: 'desktop' | 'aio' | 'laptop' | 'server'
          row_label?: string | null
          position_id?: string | null
          lan_ip?: string | null
          pairing_token?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workstation_issues: {
        Row: {
          id: string
          workstation_id: string
          category_id: string | null
          title: string
          description: string | null
          severity: 'low' | 'medium' | 'high' | 'critical'
          status: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
          reported_by_id: string | null
          reported_by_name: string
          source: 'staff' | 'student_terminal' | null
          student_name: string | null
          student_roll: string | null
          photos: Json
          resolved_by_id: string | null
          resolved_by_name: string | null
          resolution_notes: string | null
          resolved_at: string | null
          linked_maintenance_log_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workstation_id: string
          category_id?: string | null
          title: string
          description?: string | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
          reported_by_id?: string | null
          reported_by_name: string
          source?: 'staff' | 'student_terminal' | null
          student_name?: string | null
          student_roll?: string | null
          photos?: Json
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          linked_maintenance_log_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workstation_id?: string
          category_id?: string | null
          title?: string
          description?: string | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          status?: 'open' | 'acknowledged' | 'in_progress' | 'resolved'
          reported_by_id?: string | null
          reported_by_name?: string
          source?: 'staff' | 'student_terminal' | null
          student_name?: string | null
          student_roll?: string | null
          photos?: Json
          resolved_by_id?: string | null
          resolved_by_name?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          linked_maintenance_log_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      academic_years: {
        Row: {
          id: string
          name: string
          start_date: string
          end_date: string
          is_current: boolean
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          start_date: string
          end_date: string
          is_current?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_date?: string
          end_date?: string
          is_current?: boolean
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          id: string
          admission_no: string | null
          registration_no: string | null
          full_name: string
          gender: 'male' | 'female' | 'other' | null
          dob_bs: string | null
          dob_ad: string | null
          guardian_name: string | null
          guardian_phone: string | null
          email: string | null
          is_active: boolean
          archived_at: string | null
          archive_reason: string | null
          photo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
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
          is_active?: boolean
          archived_at?: string | null
          archive_reason?: string | null
          photo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          admission_no?: string | null
          registration_no?: string | null
          full_name?: string
          gender?: 'male' | 'female' | 'other' | null
          dob_bs?: string | null
          dob_ad?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          email?: string | null
          is_active?: boolean
          archived_at?: string | null
          archive_reason?: string | null
          photo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_enrollments: {
        Row: {
          id: string
          academic_year_id: string
          class_id: string
          student_id: string
          roll_number: number
          section: string | null
          status: 'active' | 'transferred' | 'graduated' | 'archived' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          academic_year_id: string
          class_id: string
          student_id: string
          roll_number: number
          section?: string | null
          status?: 'active' | 'transferred' | 'graduated' | 'archived' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          academic_year_id?: string
          class_id?: string
          student_id?: string
          roll_number?: number
          section?: string | null
          status?: 'active' | 'transferred' | 'graduated' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workstation_seat_plans: {
        Row: {
          id: string
          lab_id: string
          academic_year_id: string
          class_id: string
          workstation_id: string
          enrollment_id: string
          notes: string | null
          assigned_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          academic_year_id: string
          class_id: string
          workstation_id: string
          enrollment_id: string
          notes?: string | null
          assigned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          academic_year_id?: string
          class_id?: string
          workstation_id?: string
          enrollment_id?: string
          notes?: string | null
          assigned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_seat_overrides: {
        Row: {
          id: string
          schedule_id: string | null
          session_date: string
          practical_log_id: string | null
          enrollment_id: string
          workstation_id: string
          original_workstation_id: string | null
          reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          schedule_id?: string | null
          session_date: string
          practical_log_id?: string | null
          enrollment_id: string
          workstation_id: string
          original_workstation_id?: string | null
          reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          schedule_id?: string | null
          session_date?: string
          practical_log_id?: string | null
          enrollment_id?: string
          workstation_id?: string
          original_workstation_id?: string | null
          reason?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      lab_floor_elements: {
        Row: {
          id: string
          lab_id: string
          element_type: string
          label: string
          pos_x: number
          pos_y: number
          width: number
          height: number
          rotation: number
          metadata: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lab_id: string
          element_type: string
          label: string
          pos_x: number
          pos_y: number
          width?: number
          height?: number
          rotation?: number
          metadata?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lab_id?: string
          element_type?: string
          label?: string
          pos_x?: number
          pos_y?: number
          width?: number
          height?: number
          rotation?: number
          metadata?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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

export type MaintenancePlanRow = Database['public']['Tables']['maintenance_plans']['Row']
export type MaintenancePlanInsert = Database['public']['Tables']['maintenance_plans']['Insert']
export type MaintenancePlanUpdate = Database['public']['Tables']['maintenance_plans']['Update']

export type MaintenanceReminderRow = Database['public']['Tables']['maintenance_reminders']['Row']
export type MaintenanceReminderInsert = Database['public']['Tables']['maintenance_reminders']['Insert']
export type MaintenanceReminderUpdate = Database['public']['Tables']['maintenance_reminders']['Update']

export type MaintenanceLogRow = Database['public']['Tables']['maintenance_logs']['Row']
export type MaintenanceLogInsert = Database['public']['Tables']['maintenance_logs']['Insert']
export type MaintenanceLogUpdate = Database['public']['Tables']['maintenance_logs']['Update']

export type WorkstationRow = Database['public']['Tables']['workstations']['Row']
export type WorkstationInsert = Database['public']['Tables']['workstations']['Insert']
export type WorkstationUpdate = Database['public']['Tables']['workstations']['Update']

export type IssueCategoryRow = Database['public']['Tables']['issue_categories']['Row']
export type IssueCategoryInsert = Database['public']['Tables']['issue_categories']['Insert']
export type IssueCategoryUpdate = Database['public']['Tables']['issue_categories']['Update']

export type WorkstationIssueRow = Database['public']['Tables']['workstation_issues']['Row']
export type WorkstationIssueInsert = Database['public']['Tables']['workstation_issues']['Insert']
export type WorkstationIssueUpdate = Database['public']['Tables']['workstation_issues']['Update']

export type AcademicYearRow = Database['public']['Tables']['academic_years']['Row']
export type AcademicYearInsert = Database['public']['Tables']['academic_years']['Insert']
export type AcademicYearUpdate = Database['public']['Tables']['academic_years']['Update']

export type StudentRow = Database['public']['Tables']['students']['Row']
export type StudentInsert = Database['public']['Tables']['students']['Insert']
export type StudentUpdate = Database['public']['Tables']['students']['Update']

export type StudentEnrollmentRow = Database['public']['Tables']['student_enrollments']['Row']
export type StudentEnrollmentInsert = Database['public']['Tables']['student_enrollments']['Insert']
export type StudentEnrollmentUpdate = Database['public']['Tables']['student_enrollments']['Update']

export type WorkstationSeatPlanRow = Database['public']['Tables']['workstation_seat_plans']['Row']
export type WorkstationSeatPlanInsert = Database['public']['Tables']['workstation_seat_plans']['Insert']
export type WorkstationSeatPlanUpdate = Database['public']['Tables']['workstation_seat_plans']['Update']

export type SessionSeatOverrideRow = Database['public']['Tables']['session_seat_overrides']['Row']
export type SessionSeatOverrideInsert = Database['public']['Tables']['session_seat_overrides']['Insert']
export type SessionSeatOverrideUpdate = Database['public']['Tables']['session_seat_overrides']['Update']

export type LabFloorElementRow = Database['public']['Tables']['lab_floor_elements']['Row']
export type LabFloorElementInsert = Database['public']['Tables']['lab_floor_elements']['Insert']
export type LabFloorElementUpdate = Database['public']['Tables']['lab_floor_elements']['Update']


