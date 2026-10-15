-- ==============================================================================
-- LabSync LIMS / LMR — Institutional Laboratory Management System
-- Complete Live PostgreSQL Schema Dump (public schema)
-- Generated: 2026-09-24T13:24:07.872Z
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- ------------------------------------------------------------------------------
-- 2. CUSTOM ENUM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.lab_type AS ENUM ('computer_lab', 'physics_lab', 'chemistry_lab', 'biology_lab', 'electronics_lab');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rm_reminder_status AS ENUM ('pending', 'snoozed', 'in_progress', 'completed', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.rm_severity AS ENUM ('low', 'routine', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'teacher');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABLES & COLUMNS
-- ------------------------------------------------------------------------------
-- Table: public.academic_holidays
CREATE TABLE IF NOT EXISTS public.academic_holidays (
  id text NOT NULL,
  title text NOT NULL,
  name text NOT NULL,
  title_np text,
  date_start date NOT NULL,
  date_end date,
  bs_date_str text,
  holiday_type text DEFAULT 'cultural'::text NOT NULL,
  description text,
  practicals_suspended boolean DEFAULT true NOT NULL,
  is_national boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.academic_years
CREATE TABLE IF NOT EXISTS public.academic_years (
  id text NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  actor_id uuid,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  entity_label text NOT NULL,
  changes jsonb,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Table: public.calendar_settings
CREATE TABLE IF NOT EXISTS public.calendar_settings (
  id text DEFAULT 'default'::text NOT NULL,
  start_day text DEFAULT 'sun'::text NOT NULL,
  sunday_weekend boolean DEFAULT false NOT NULL,
  saturday_weekend boolean DEFAULT true NOT NULL,
  academic_year text DEFAULT '2083'::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

-- Table: public.class_subjects
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  class_id text NOT NULL,
  subject_id text NOT NULL,
  teacher_id uuid,
  default_lab_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.classes
CREATE TABLE IF NOT EXISTS public.classes (
  id text NOT NULL,
  name text NOT NULL,
  grade integer,
  section text,
  stream_id text,
  capacity integer DEFAULT 40 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.email_dispatch_logs
CREATE TABLE IF NOT EXISTS public.email_dispatch_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  dispatch_type text NOT NULL,
  recipient_email text NOT NULL,
  reference_date date DEFAULT CURRENT_DATE NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.email_otps
CREATE TABLE IF NOT EXISTS public.email_otps (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  otp_code text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.institution_settings
CREATE TABLE IF NOT EXISTS public.institution_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_by uuid
);

-- Table: public.issue_categories
CREATE TABLE IF NOT EXISTS public.issue_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  color text DEFAULT '#6366F1'::text NOT NULL,
  icon text DEFAULT 'AlertTriangle'::text NOT NULL,
  default_severity text DEFAULT 'medium'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.lab_floor_elements
CREATE TABLE IF NOT EXISTS public.lab_floor_elements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lab_id text NOT NULL,
  element_type text NOT NULL,
  label text NOT NULL,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  width double precision DEFAULT 12.0 NOT NULL,
  height double precision DEFAULT 4.0 NOT NULL,
  rotation integer DEFAULT 0 NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.lab_incidents
CREATE TABLE IF NOT EXISTS public.lab_incidents (
  id text NOT NULL,
  lab_id text NOT NULL,
  schedule_id text,
  date date DEFAULT CURRENT_DATE NOT NULL,
  session_label text NOT NULL,
  subject_name text NOT NULL,
  subject_teacher_name text NOT NULL,
  batch_name text NOT NULL,
  title text NOT NULL,
  incident_type text DEFAULT 'breakage'::text NOT NULL,
  severity text DEFAULT 'minor'::text NOT NULL,
  equipment_name text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  student_rolls text,
  status text DEFAULT 'reported'::text NOT NULL,
  escalated_to_hod boolean DEFAULT false NOT NULL,
  escalation_reason text,
  escalated_at timestamp with time zone,
  resolution_notes text,
  resolved_by text,
  resolved_at timestamp with time zone,
  reported_by text DEFAULT 'Faculty In-Charge'::text NOT NULL,
  reported_by_id uuid,
  circumstances text,
  photo_url text,
  is_fined boolean DEFAULT false NOT NULL,
  fine_amount numeric DEFAULT 0,
  fine_paid boolean DEFAULT false NOT NULL,
  fine_receipt_no text,
  resolved_by_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.lab_notifications
CREATE TABLE IF NOT EXISTS public.lab_notifications (
  id text NOT NULL,
  incident_id text,
  target_role text NOT NULL,
  target_lab_id text,
  title text NOT NULL,
  message text NOT NULL,
  severity text DEFAULT 'info'::text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.labs
CREATE TABLE IF NOT EXISTS public.labs (
  id text NOT NULL,
  name text NOT NULL,
  code text,
  type public.lab_type DEFAULT 'computer_lab'::lab_type NOT NULL,
  capacity integer DEFAULT 40 NOT NULL,
  status text DEFAULT 'Operational'::text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.log_attendance
CREATE TABLE IF NOT EXISTS public.log_attendance (
  id text DEFAULT (gen_random_uuid())::text NOT NULL,
  log_id text NOT NULL,
  roll_number integer NOT NULL,
  is_present boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  student_id uuid
);

-- Table: public.maintenance_logs
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid,
  reminder_id uuid,
  lab_id text NOT NULL,
  asset_identifier text NOT NULL,
  work_performed text NOT NULL,
  checklist_completed jsonb DEFAULT '[]'::jsonb,
  parts_replaced text,
  cost_incurred numeric DEFAULT 0.00 NOT NULL,
  service_date date DEFAULT CURRENT_DATE NOT NULL,
  performed_by_id uuid NOT NULL,
  next_service_due date,
  remarks text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.maintenance_plans
CREATE TABLE IF NOT EXISTS public.maintenance_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lab_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  interval_days integer NOT NULL,
  severity public.rm_severity DEFAULT 'routine'::rm_severity NOT NULL,
  target_role text DEFAULT 'lab_incharge'::text NOT NULL,
  assigned_user_id uuid,
  checklist jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.maintenance_reminders
CREATE TABLE IF NOT EXISTS public.maintenance_reminders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  lab_id text NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  status public.rm_reminder_status DEFAULT 'pending'::rm_reminder_status NOT NULL,
  snoozed_until date,
  snooze_reason text,
  snooze_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.practical_logs
CREATE TABLE IF NOT EXISTS public.practical_logs (
  id text NOT NULL,
  schedule_id text,
  lab_id text NOT NULL,
  teacher_id uuid,
  date date DEFAULT CURRENT_DATE NOT NULL,
  period_label text NOT NULL,
  subject_name text NOT NULL,
  batch_group text NOT NULL,
  practical_title text NOT NULL,
  total_students integer DEFAULT 0 NOT NULL,
  present_students integer DEFAULT 0 NOT NULL,
  absent_students integer DEFAULT 0 NOT NULL,
  absent_rolls int4[] DEFAULT ARRAY[]::integer[],
  remarks text,
  status text DEFAULT 'conducted'::text,
  skip_reason text,
  topic_learned text,
  logged_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  academic_year_id text DEFAULT '2083'::text
);

-- Table: public.print_selection_tokens
CREATE TABLE IF NOT EXISTS public.print_selection_tokens (
  token text NOT NULL,
  ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval) NOT NULL
);

-- Table: public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  phone text,
  full_name text NOT NULL,
  role text DEFAULT 'teacher'::text NOT NULL,
  department text,
  approval_status text DEFAULT 'approved'::text,
  is_active boolean DEFAULT true NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.rate_limit_events
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  key text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.schedules
CREATE TABLE IF NOT EXISTS public.schedules (
  id text NOT NULL,
  lab_id text NOT NULL,
  teacher_id uuid,
  subject_name text NOT NULL,
  batch_name text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  slot_id text DEFAULT 't2'::text,
  day_key text DEFAULT 'sun'::text,
  span integer DEFAULT 1,
  is_merged boolean DEFAULT false,
  status public.session_status DEFAULT 'scheduled'::session_status,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  academic_year_id text DEFAULT '2083'::text
);

-- Table: public.session_seat_overrides
CREATE TABLE IF NOT EXISTS public.session_seat_overrides (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  schedule_id text,
  session_date date NOT NULL,
  practical_log_id text,
  enrollment_id uuid NOT NULL,
  workstation_id uuid NOT NULL,
  original_workstation_id uuid,
  reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.streams
CREATE TABLE IF NOT EXISTS public.streams (
  id text NOT NULL,
  name text NOT NULL,
  code text,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.student_enrollments
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  academic_year_id text NOT NULL,
  class_id text NOT NULL,
  student_id uuid NOT NULL,
  roll_number integer NOT NULL,
  section text,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.students
CREATE TABLE IF NOT EXISTS public.students (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  admission_no text,
  registration_no text,
  full_name text NOT NULL,
  gender text,
  dob_bs text,
  dob_ad date,
  guardian_name text,
  guardian_phone text,
  email text,
  is_active boolean DEFAULT true NOT NULL,
  archived_at timestamp with time zone,
  archive_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  default_lab_id text,
  credit_hours numeric DEFAULT 4.0,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.teacher_substitutions
CREATE TABLE IF NOT EXISTS public.teacher_substitutions (
  id text NOT NULL,
  schedule_id text,
  date date DEFAULT CURRENT_DATE NOT NULL,
  slot_id text DEFAULT 't2'::text NOT NULL,
  lab_id text NOT NULL,
  original_teacher_id uuid NOT NULL,
  original_teacher_name text NOT NULL,
  substitute_teacher_id uuid NOT NULL,
  substitute_teacher_name text NOT NULL,
  reason text,
  status text DEFAULT 'assigned'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Table: public.workstation_issues
CREATE TABLE IF NOT EXISTS public.workstation_issues (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workstation_id uuid NOT NULL,
  category_id uuid,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium'::text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  reported_by_id uuid NOT NULL,
  reported_by_name text NOT NULL,
  photos jsonb DEFAULT '[]'::jsonb NOT NULL,
  resolved_by_id uuid,
  resolved_by_name text,
  resolution_notes text,
  resolved_at timestamp with time zone,
  linked_maintenance_log_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.workstation_seat_plans
CREATE TABLE IF NOT EXISTS public.workstation_seat_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lab_id text NOT NULL,
  academic_year_id text NOT NULL,
  class_id text NOT NULL,
  workstation_id uuid NOT NULL,
  enrollment_id uuid NOT NULL,
  notes text,
  assigned_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Table: public.workstations
CREATE TABLE IF NOT EXISTS public.workstations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lab_id text NOT NULL,
  label text NOT NULL,
  pos_x double precision DEFAULT 50.0 NOT NULL,
  pos_y double precision DEFAULT 50.0 NOT NULL,
  device_type text DEFAULT 'desktop'::text NOT NULL,
  row_label text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. CONSTRAINTS & INTEGRITY RULES
-- ------------------------------------------------------------------------------
-- academic_holidays_pkey ON academic_holidays
DO $$ BEGIN
  ALTER TABLE academic_holidays ADD CONSTRAINT academic_holidays_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- academic_years_pkey ON academic_years
DO $$ BEGIN
  ALTER TABLE academic_years ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- audit_logs_pkey ON audit_logs
DO $$ BEGIN
  ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- calendar_settings_pkey ON calendar_settings
DO $$ BEGIN
  ALTER TABLE calendar_settings ADD CONSTRAINT calendar_settings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_pkey ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- classes_pkey ON classes
DO $$ BEGIN
  ALTER TABLE classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- email_dispatch_logs_pkey ON email_dispatch_logs
DO $$ BEGIN
  ALTER TABLE email_dispatch_logs ADD CONSTRAINT email_dispatch_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- email_otps_pkey ON email_otps
DO $$ BEGIN
  ALTER TABLE email_otps ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- institution_settings_pkey ON institution_settings
DO $$ BEGIN
  ALTER TABLE institution_settings ADD CONSTRAINT institution_settings_pkey PRIMARY KEY (key);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- issue_categories_pkey ON issue_categories
DO $$ BEGIN
  ALTER TABLE issue_categories ADD CONSTRAINT issue_categories_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_pkey ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_incidents_pkey ON lab_incidents
DO $$ BEGIN
  ALTER TABLE lab_incidents ADD CONSTRAINT lab_incidents_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_notifications_pkey ON lab_notifications
DO $$ BEGIN
  ALTER TABLE lab_notifications ADD CONSTRAINT lab_notifications_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- labs_pkey ON labs
DO $$ BEGIN
  ALTER TABLE labs ADD CONSTRAINT labs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- log_attendance_pkey ON log_attendance
DO $$ BEGIN
  ALTER TABLE log_attendance ADD CONSTRAINT log_attendance_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_logs_pkey ON maintenance_logs
DO $$ BEGIN
  ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_plans_pkey ON maintenance_plans
DO $$ BEGIN
  ALTER TABLE maintenance_plans ADD CONSTRAINT maintenance_plans_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_reminders_pkey ON maintenance_reminders
DO $$ BEGIN
  ALTER TABLE maintenance_reminders ADD CONSTRAINT maintenance_reminders_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- practical_logs_pkey ON practical_logs
DO $$ BEGIN
  ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- print_selection_tokens_pkey ON print_selection_tokens
DO $$ BEGIN
  ALTER TABLE print_selection_tokens ADD CONSTRAINT print_selection_tokens_pkey PRIMARY KEY (token);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- profiles_pkey ON profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- rate_limit_events_pkey ON rate_limit_events
DO $$ BEGIN
  ALTER TABLE rate_limit_events ADD CONSTRAINT rate_limit_events_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- schedules_pkey ON schedules
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_pkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- streams_pkey ON streams
DO $$ BEGIN
  ALTER TABLE streams ADD CONSTRAINT streams_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_pkey ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- students_pkey ON students
DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- subjects_pkey ON subjects
DO $$ BEGIN
  ALTER TABLE subjects ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- teacher_substitutions_pkey ON teacher_substitutions
DO $$ BEGIN
  ALTER TABLE teacher_substitutions ADD CONSTRAINT teacher_substitutions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_pkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_pkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstations_pkey ON workstations
DO $$ BEGIN
  ALTER TABLE workstations ADD CONSTRAINT workstations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_class_id_subject_id_teacher_id_key ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_class_id_subject_id_teacher_id_key UNIQUE (class_id, subject_id, teacher_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- classes_name_key ON classes
DO $$ BEGIN
  ALTER TABLE classes ADD CONSTRAINT classes_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- email_dispatch_unique_per_day ON email_dispatch_logs
DO $$ BEGIN
  ALTER TABLE email_dispatch_logs ADD CONSTRAINT email_dispatch_unique_per_day UNIQUE (dispatch_type, recipient_email, reference_date);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- log_attendance_log_id_roll_number_key ON log_attendance
DO $$ BEGIN
  ALTER TABLE log_attendance ADD CONSTRAINT log_attendance_log_id_roll_number_key UNIQUE (log_id, roll_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_session_override_student ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT uq_session_override_student UNIQUE (schedule_id, session_date, enrollment_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_session_override_workstation ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT uq_session_override_workstation UNIQUE (schedule_id, session_date, workstation_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- streams_code_key ON streams
DO $$ BEGIN
  ALTER TABLE streams ADD CONSTRAINT streams_code_key UNIQUE (code);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_enrollment_roll ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT uq_enrollment_roll UNIQUE (academic_year_id, class_id, roll_number);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_enrollment_student ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT uq_enrollment_student UNIQUE (academic_year_id, class_id, student_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- students_admission_no_key ON students
DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT students_admission_no_key UNIQUE (admission_no);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- students_registration_no_key ON students
DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT students_registration_no_key UNIQUE (registration_no);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- subjects_code_key ON subjects
DO $$ BEGIN
  ALTER TABLE subjects ADD CONSTRAINT subjects_code_key UNIQUE (code);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_seat_plan_enrollment ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT uq_seat_plan_enrollment UNIQUE (lab_id, academic_year_id, class_id, enrollment_id) DEFERRABLE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_seat_plan_workstation ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT uq_seat_plan_workstation UNIQUE (lab_id, academic_year_id, class_id, workstation_id) DEFERRABLE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- uq_workstation_lab_label ON workstations
DO $$ BEGIN
  ALTER TABLE workstations ADD CONSTRAINT uq_workstation_lab_label UNIQUE (lab_id, label);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- issue_categories_default_severity_check ON issue_categories
DO $$ BEGIN
  ALTER TABLE issue_categories ADD CONSTRAINT issue_categories_default_severity_check CHECK (default_severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- issue_categories_type_check ON issue_categories
DO $$ BEGIN
  ALTER TABLE issue_categories ADD CONSTRAINT issue_categories_type_check CHECK (type = ANY (ARRAY['hardware'::text, 'software'::text, 'network'::text, 'peripheral'::text, 'other'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_height_check ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_height_check CHECK (height > 0::double precision AND height <= 100::double precision);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_pos_x_check ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_pos_x_check CHECK (pos_x >= 0::double precision AND pos_x <= 100::double precision);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_pos_y_check ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_pos_y_check CHECK (pos_y >= 0::double precision AND pos_y <= 100::double precision);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_rotation_check ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_rotation_check CHECK (rotation = ANY (ARRAY[0, 90, 180, 270]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_width_check ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_width_check CHECK (width > 0::double precision AND width <= 100::double precision);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- labs_status_check ON labs
DO $$ BEGIN
  ALTER TABLE labs ADD CONSTRAINT labs_status_check CHECK (status = ANY (ARRAY['Operational'::text, 'Under Maintenance'::text, 'Inactive'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_plans_interval_days_check ON maintenance_plans
DO $$ BEGIN
  ALTER TABLE maintenance_plans ADD CONSTRAINT maintenance_plans_interval_days_check CHECK (interval_days > 0);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- profiles_approval_status_check ON profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_approval_status_check CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- profiles_role_check ON profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['super_admin'::text, 'lab_incharge'::text, 'hod'::text, 'teacher'::text, 'admin'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_roll_number_check ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_roll_number_check CHECK (roll_number > 0 AND roll_number <= 200);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_status_check ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_status_check CHECK (status = ANY (ARRAY['active'::text, 'transferred'::text, 'graduated'::text, 'archived'::text, 'completed'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- students_gender_check ON students
DO $$ BEGIN
  ALTER TABLE students ADD CONSTRAINT students_gender_check CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_severity_check ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_severity_check CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_status_check ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_status_check CHECK (status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'in_progress'::text, 'resolved'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstations_device_type_check ON workstations
DO $$ BEGIN
  ALTER TABLE workstations ADD CONSTRAINT workstations_device_type_check CHECK (device_type = ANY (ARRAY['desktop'::text, 'aio'::text, 'laptop'::text, 'server'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- audit_logs_actor_id_fkey ON audit_logs
DO $$ BEGIN
  ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_class_id_fkey ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_default_lab_id_fkey ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_default_lab_id_fkey FOREIGN KEY (default_lab_id) REFERENCES labs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_subject_id_fkey ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- class_subjects_teacher_id_fkey ON class_subjects
DO $$ BEGIN
  ALTER TABLE class_subjects ADD CONSTRAINT class_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- classes_stream_id_fkey ON classes
DO $$ BEGIN
  ALTER TABLE classes ADD CONSTRAINT classes_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- institution_settings_updated_by_fkey ON institution_settings
DO $$ BEGIN
  ALTER TABLE institution_settings ADD CONSTRAINT institution_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_floor_elements_lab_id_fkey ON lab_floor_elements
DO $$ BEGIN
  ALTER TABLE lab_floor_elements ADD CONSTRAINT lab_floor_elements_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_incidents_lab_id_fkey ON lab_incidents
DO $$ BEGIN
  ALTER TABLE lab_incidents ADD CONSTRAINT lab_incidents_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_incidents_reported_by_id_fkey ON lab_incidents
DO $$ BEGIN
  ALTER TABLE lab_incidents ADD CONSTRAINT lab_incidents_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_incidents_resolved_by_id_fkey ON lab_incidents
DO $$ BEGIN
  ALTER TABLE lab_incidents ADD CONSTRAINT lab_incidents_resolved_by_id_fkey FOREIGN KEY (resolved_by_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_incidents_schedule_id_fkey ON lab_incidents
DO $$ BEGIN
  ALTER TABLE lab_incidents ADD CONSTRAINT lab_incidents_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_notifications_incident_id_fkey ON lab_notifications
DO $$ BEGIN
  ALTER TABLE lab_notifications ADD CONSTRAINT lab_notifications_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES lab_incidents(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- lab_notifications_target_lab_id_fkey ON lab_notifications
DO $$ BEGIN
  ALTER TABLE lab_notifications ADD CONSTRAINT lab_notifications_target_lab_id_fkey FOREIGN KEY (target_lab_id) REFERENCES labs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- log_attendance_log_id_fkey ON log_attendance
DO $$ BEGIN
  ALTER TABLE log_attendance ADD CONSTRAINT log_attendance_log_id_fkey FOREIGN KEY (log_id) REFERENCES practical_logs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- log_attendance_student_id_fkey ON log_attendance
DO $$ BEGIN
  ALTER TABLE log_attendance ADD CONSTRAINT log_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_logs_lab_id_fkey ON maintenance_logs
DO $$ BEGIN
  ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_logs_performed_by_id_fkey ON maintenance_logs
DO $$ BEGIN
  ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_performed_by_id_fkey FOREIGN KEY (performed_by_id) REFERENCES profiles(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_logs_plan_id_fkey ON maintenance_logs
DO $$ BEGIN
  ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES maintenance_plans(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_logs_reminder_id_fkey ON maintenance_logs
DO $$ BEGIN
  ALTER TABLE maintenance_logs ADD CONSTRAINT maintenance_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES maintenance_reminders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_plans_assigned_user_id_fkey ON maintenance_plans
DO $$ BEGIN
  ALTER TABLE maintenance_plans ADD CONSTRAINT maintenance_plans_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_plans_lab_id_fkey ON maintenance_plans
DO $$ BEGIN
  ALTER TABLE maintenance_plans ADD CONSTRAINT maintenance_plans_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_reminders_lab_id_fkey ON maintenance_reminders
DO $$ BEGIN
  ALTER TABLE maintenance_reminders ADD CONSTRAINT maintenance_reminders_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- maintenance_reminders_plan_id_fkey ON maintenance_reminders
DO $$ BEGIN
  ALTER TABLE maintenance_reminders ADD CONSTRAINT maintenance_reminders_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES maintenance_plans(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- practical_logs_academic_year_id_fkey ON practical_logs
DO $$ BEGIN
  ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- practical_logs_lab_id_fkey ON practical_logs
DO $$ BEGIN
  ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- practical_logs_logged_by_fkey ON practical_logs
DO $$ BEGIN
  ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_logged_by_fkey FOREIGN KEY (logged_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- practical_logs_teacher_id_fkey ON practical_logs
DO $$ BEGIN
  ALTER TABLE practical_logs ADD CONSTRAINT practical_logs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- profiles_id_fkey ON profiles
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- schedules_academic_year_id_fkey ON schedules
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT schedules_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- schedules_lab_id_fkey ON schedules
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT schedules_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- schedules_teacher_id_fkey ON schedules
DO $$ BEGIN
  ALTER TABLE schedules ADD CONSTRAINT schedules_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_created_by_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_enrollment_id_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_original_workstation_id_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_original_workstation_id_fkey FOREIGN KEY (original_workstation_id) REFERENCES workstations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_practical_log_id_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_practical_log_id_fkey FOREIGN KEY (practical_log_id) REFERENCES practical_logs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_schedule_id_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- session_seat_overrides_workstation_id_fkey ON session_seat_overrides
DO $$ BEGIN
  ALTER TABLE session_seat_overrides ADD CONSTRAINT session_seat_overrides_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_academic_year_id_fkey ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_class_id_fkey ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- student_enrollments_student_id_fkey ON student_enrollments
DO $$ BEGIN
  ALTER TABLE student_enrollments ADD CONSTRAINT student_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- subjects_default_lab_id_fkey ON subjects
DO $$ BEGIN
  ALTER TABLE subjects ADD CONSTRAINT subjects_default_lab_id_fkey FOREIGN KEY (default_lab_id) REFERENCES labs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- teacher_substitutions_lab_id_fkey ON teacher_substitutions
DO $$ BEGIN
  ALTER TABLE teacher_substitutions ADD CONSTRAINT teacher_substitutions_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- teacher_substitutions_original_teacher_id_fkey ON teacher_substitutions
DO $$ BEGIN
  ALTER TABLE teacher_substitutions ADD CONSTRAINT teacher_substitutions_original_teacher_id_fkey FOREIGN KEY (original_teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- teacher_substitutions_schedule_id_fkey ON teacher_substitutions
DO $$ BEGIN
  ALTER TABLE teacher_substitutions ADD CONSTRAINT teacher_substitutions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- teacher_substitutions_substitute_teacher_id_fkey ON teacher_substitutions
DO $$ BEGIN
  ALTER TABLE teacher_substitutions ADD CONSTRAINT teacher_substitutions_substitute_teacher_id_fkey FOREIGN KEY (substitute_teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_category_id_fkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_category_id_fkey FOREIGN KEY (category_id) REFERENCES issue_categories(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_linked_maintenance_log_id_fkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_linked_maintenance_log_id_fkey FOREIGN KEY (linked_maintenance_log_id) REFERENCES maintenance_logs(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_reported_by_id_fkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_reported_by_id_fkey FOREIGN KEY (reported_by_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_resolved_by_id_fkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_resolved_by_id_fkey FOREIGN KEY (resolved_by_id) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_issues_workstation_id_fkey ON workstation_issues
DO $$ BEGIN
  ALTER TABLE workstation_issues ADD CONSTRAINT workstation_issues_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_academic_year_id_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_assigned_by_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_class_id_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_enrollment_id_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES student_enrollments(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_lab_id_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstation_seat_plans_workstation_id_fkey ON workstation_seat_plans
DO $$ BEGIN
  ALTER TABLE workstation_seat_plans ADD CONSTRAINT workstation_seat_plans_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- workstations_lab_id_fkey ON workstations
DO $$ BEGIN
  ALTER TABLE workstations ADD CONSTRAINT workstations_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 5. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX idx_academic_holidays_dates ON public.academic_holidays USING btree (date_start, date_end);
CREATE UNIQUE INDEX uq_academic_years_single_current ON public.academic_years USING btree (is_current) WHERE (is_current = true);
CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);
CREATE INDEX idx_email_dispatch_logs_recipient ON public.email_dispatch_logs USING btree (recipient_email);
CREATE INDEX idx_email_dispatch_logs_type_date ON public.email_dispatch_logs USING btree (dispatch_type, reference_date);
CREATE INDEX idx_email_otps_email ON public.email_otps USING btree (email);
CREATE INDEX idx_issue_categories_active ON public.issue_categories USING btree (is_active, sort_order);
CREATE INDEX idx_floor_elements_lab ON public.lab_floor_elements USING btree (lab_id) WHERE (is_active = true);
CREATE INDEX idx_log_attendance_student ON public.log_attendance USING btree (student_id);
CREATE INDEX idx_print_selection_tokens_expires ON public.print_selection_tokens USING btree (expires_at);
CREATE INDEX idx_rate_limit_events_key_created ON public.rate_limit_events USING btree (key, created_at DESC);
CREATE INDEX idx_session_overrides_date ON public.session_seat_overrides USING btree (session_date, schedule_id);
CREATE INDEX idx_enrollments_cohort ON public.student_enrollments USING btree (academic_year_id, class_id, status);
CREATE INDEX idx_enrollments_student ON public.student_enrollments USING btree (student_id);
CREATE INDEX idx_students_active ON public.students USING btree (is_active);
CREATE INDEX idx_students_name ON public.students USING btree (lower(full_name));
CREATE INDEX idx_workstation_issues_status ON public.workstation_issues USING btree (status);
CREATE INDEX idx_workstation_issues_ws ON public.workstation_issues USING btree (workstation_id);
CREATE INDEX idx_seat_plans_lookup ON public.workstation_seat_plans USING btree (lab_id, academic_year_id, class_id);
CREATE INDEX idx_workstations_lab ON public.workstations USING btree (lab_id) WHERE (is_active = true);

-- ------------------------------------------------------------------------------
-- 6. STORED PROCEDURES & DATABASE FUNCTIONS
-- ------------------------------------------------------------------------------
-- Function: public.commit_roster_ingestion_tx
CREATE OR REPLACE FUNCTION public.commit_roster_ingestion_tx(p_academic_year_id text, p_class_id text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb;
  v_student_id uuid;
  v_student_id_by_reg uuid;
  v_enrollment_id uuid;
  v_existing_enrollment_id uuid;
  v_existing_roll int;
  v_roll int;
  v_name text;
  v_adm text;
  v_reg text;
  v_created_students int := 0;
  v_matched_students int := 0;
  v_created_enrollments int := 0;
  v_retained_enrollments int := 0;
  v_rolls_seen int[] := '{}';
BEGIN
  -- 1. Authorization check inside database function
  IF NOT public.is_privileged() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Administrative role required to commit roster ingestion.';
  END IF;

  -- 2. Validate parameters & structural integrity of p_rows
  IF p_academic_year_id IS NULL OR trim(p_academic_year_id) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Target academic year is required.';
  END IF;

  IF p_class_id IS NULL OR trim(p_class_id) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Target class is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.academic_years WHERE id = p_academic_year_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year % does not exist.', p_academic_year_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Class % does not exist.', p_class_id;
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Roster payload must be a non-null JSON array.';
  END IF;

  IF jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Roster payload contains zero rows.';
  END IF;

  -- 3. Iterate through all rows with strict invariant validation
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    -- Extract and sanitize row values
    v_name := trim(coalesce(v_row->>'full_name', ''));
    v_adm := nullif(trim(coalesce(v_row->>'admission_no', '')), '');
    v_reg := nullif(trim(coalesce(v_row->>'registration_no', '')), '');

    -- Check required name
    IF v_name = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Student name cannot be empty.';
    END IF;

    -- Check valid roll number
    BEGIN
      v_roll := (v_row->>'roll_number')::int;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Invalid roll number format for student %.', v_name;
    END;

    IF v_roll IS NULL OR v_roll < 1 OR v_roll > 200 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Roll number % for student % is out of valid bounds (1-200).', v_roll, v_name;
    END IF;

    -- Check intra-payload duplicate roll numbers
    IF v_roll = ANY(v_rolls_seen) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: Duplicate roll number % detected inside upload payload.', v_roll;
    END IF;
    v_rolls_seen := array_append(v_rolls_seen, v_roll);

    -- 4. Identity Resolution & Strong Identifier Conflict Guard
    v_student_id := NULL;
    v_student_id_by_reg := NULL;

    IF v_adm IS NOT NULL THEN
      SELECT id INTO v_student_id FROM public.students WHERE admission_no = v_adm LIMIT 1;
    END IF;

    IF v_reg IS NOT NULL THEN
      SELECT id INTO v_student_id_by_reg FROM public.students WHERE registration_no = v_reg LIMIT 1;
    END IF;

    -- If both identifiers are provided, verify they resolve to the exact same student
    IF v_student_id IS NOT NULL AND v_student_id_by_reg IS NOT NULL AND v_student_id <> v_student_id_by_reg THEN
      RAISE EXCEPTION 'IDENTITY_CONFLICT: Admission number % (student ID %) and registration number % (student ID %) resolve to two different students.',
        v_adm, v_student_id, v_reg, v_student_id_by_reg;
    END IF;

    -- Consolidate student identity
    IF v_student_id IS NULL THEN
      v_student_id := v_student_id_by_reg;
    END IF;

    -- 5. Create student person record if not found by strong identifiers
    IF v_student_id IS NULL THEN
      INSERT INTO public.students (full_name, admission_no, registration_no, is_active)
      VALUES (v_name, v_adm, v_reg, true)
      RETURNING id INTO v_student_id;
      v_created_students := v_created_students + 1;
    ELSE
      v_matched_students := v_matched_students + 1;
    END IF;

    -- 6. Cohort Enrollment & Roll Mismatch Idempotency Guard
    v_existing_enrollment_id := NULL;
    v_existing_roll := NULL;

    SELECT id, roll_number INTO v_existing_enrollment_id, v_existing_roll
    FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id
      AND student_id = v_student_id;

    IF v_existing_enrollment_id IS NOT NULL THEN
      -- Student is already enrolled in this cohort
      IF v_existing_roll = v_roll THEN
        -- Exact same roll -> idempotent retention
        v_retained_enrollments := v_retained_enrollments + 1;
      ELSE
        -- Different roll -> explicit conflict error
        RAISE EXCEPTION 'ROLL_MISMATCH_CONFLICT: Student % is already enrolled with roll number %, but spreadsheet specifies roll %. Roll changes require an explicit enrollment management operation.',
          v_name, v_existing_roll, v_roll;
      END IF;
    ELSE
      -- Check if target roll number is already occupied by another student in this cohort
      IF EXISTS (
        SELECT 1 FROM public.student_enrollments
        WHERE academic_year_id = p_academic_year_id
          AND class_id = p_class_id
          AND roll_number = v_roll
      ) THEN
        RAISE EXCEPTION 'ROLL_COLLISION: Roll number % is already occupied in class % by another student.', v_roll, p_class_id;
      END IF;

      INSERT INTO public.student_enrollments (
        academic_year_id,
        class_id,
        student_id,
        roll_number,
        status
      ) VALUES (
        p_academic_year_id,
        p_class_id,
        v_student_id,
        v_roll,
        'active'
      )
      RETURNING id INTO v_enrollment_id;
      v_created_enrollments := v_created_enrollments + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed_rows', jsonb_array_length(p_rows),
    'students_created', v_created_students,
    'students_matched', v_matched_students,
    'enrollments_created', v_created_enrollments,
    'enrollments_retained', v_retained_enrollments
  );
END;
$function$
;

-- Function: public.create_student_with_enrollment_tx
CREATE OR REPLACE FUNCTION public.create_student_with_enrollment_tx(p_full_name text, p_academic_year_id text, p_class_id text, p_roll_number integer, p_admission_no text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_section text DEFAULT NULL::text, p_guardian_name text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_enrollment_id uuid;
BEGIN
  -- 1. Validate mandatory fields
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Student full name is required.';
  END IF;

  IF p_academic_year_id IS NULL OR p_class_id IS NULL OR p_roll_number IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Academic year, class, and roll number are required.';
  END IF;

  -- 2. Pre-check roll collision in target cohort
  IF EXISTS (
    SELECT 1 FROM public.student_enrollments
    WHERE academic_year_id = p_academic_year_id
      AND class_id = p_class_id
      AND roll_number = p_roll_number
  ) THEN
    RAISE EXCEPTION 'ROLL_COLLISION: Roll number % is already assigned in class % for academic year %.', p_roll_number, p_class_id, p_academic_year_id;
  END IF;

  -- 3. Resolve student identity by admission_no if provided
  IF p_admission_no IS NOT NULL AND trim(p_admission_no) <> '' THEN
    SELECT id INTO v_student_id
    FROM public.students
    WHERE admission_no = trim(p_admission_no)
    LIMIT 1;
  END IF;

  -- 4. Insert or update student person record
  IF v_student_id IS NULL THEN
    INSERT INTO public.students (
      full_name,
      admission_no,
      gender,
      guardian_name,
      guardian_phone,
      email,
      is_active
    ) VALUES (
      trim(p_full_name),
      nullif(trim(p_admission_no), ''),
      p_gender,
      nullif(trim(p_guardian_name), ''),
      nullif(trim(p_guardian_phone), ''),
      nullif(trim(p_email), ''),
      true
    )
    RETURNING id INTO v_student_id;
  ELSE
    UPDATE public.students
    SET full_name = trim(p_full_name),
        gender = coalesce(p_gender, gender),
        guardian_phone = coalesce(nullif(trim(p_guardian_phone), ''), guardian_phone)
    WHERE id = v_student_id;
  END IF;

  -- 5. Insert enrollment record
  INSERT INTO public.student_enrollments (
    academic_year_id,
    class_id,
    student_id,
    roll_number,
    section,
    status
  ) VALUES (
    p_academic_year_id,
    p_class_id,
    v_student_id,
    p_roll_number,
    nullif(trim(p_section), ''),
    'active'
  )
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'student_id', v_student_id,
    'enrollment_id', v_enrollment_id
  );
END;
$function$
;

-- Function: public.current_role
CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid();
$function$
;

-- Function: public.handle_maintenance_log_completion
CREATE OR REPLACE FUNCTION public.handle_maintenance_log_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_plan public.maintenance_plans%rowtype;
begin
  if new.reminder_id is not null then
    update public.maintenance_reminders 
    set status = 'completed' 
    where id = new.reminder_id;
  elsif new.plan_id is not null then
    update public.maintenance_reminders
    set status = 'completed'
    where plan_id = new.plan_id and status in ('pending', 'snoozed', 'in_progress', 'overdue');
  end if;

  if new.plan_id is not null then
    select * into v_plan from public.maintenance_plans where id = new.plan_id;
    if found and v_plan.is_active then
      insert into public.maintenance_reminders (
        plan_id, lab_id, title, due_date, status
      ) values (
        v_plan.id,
        v_plan.lab_id,
        v_plan.title,
        coalesce(new.next_service_due, new.service_date + v_plan.interval_days),
        'pending'
      );
    end if;
  end if;

  return new;
end;
$function$
;

-- Function: public.handle_new_maintenance_plan
CREATE OR REPLACE FUNCTION public.handle_new_maintenance_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.is_active then
    insert into public.maintenance_reminders (
      plan_id, lab_id, title, due_date, status
    ) values (
      new.id, new.lab_id, new.title, current_date + new.interval_days, 'pending'
    );
  end if;
  return new;
end;
$function$
;

-- Function: public.handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, email, phone, full_name, role, department, approval_status, is_active, permissions)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'teacher'),
    coalesce(new.raw_user_meta_data->>'department', 'Science Department'),
    coalesce(new.raw_user_meta_data->>'approval_status', 'approved'),
    true,
    '{}'::jsonb
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department;
  return new;
end;
$function$
;

-- Function: public.is_privileged
CREATE OR REPLACE FUNCTION public.is_privileged()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('super_admin', 'lab_incharge', 'hod', 'admin');
$function$
;

-- Function: public.swap_workstation_seat_plans_tx
CREATE OR REPLACE FUNCTION public.swap_workstation_seat_plans_tx(p_lab_id text, p_academic_year_id text, p_class_id text, p_ws_a uuid, p_ws_b uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_a record;
  v_plan_b record;
BEGIN
  -- Fetch existing assignments for both workstations
  SELECT id, enrollment_id INTO v_plan_a
  FROM public.workstation_seat_plans
  WHERE lab_id = p_lab_id
    AND academic_year_id = p_academic_year_id
    AND class_id = p_class_id
    AND workstation_id = p_ws_a;

  SELECT id, enrollment_id INTO v_plan_b
  FROM public.workstation_seat_plans
  WHERE lab_id = p_lab_id
    AND academic_year_id = p_academic_year_id
    AND class_id = p_class_id
    AND workstation_id = p_ws_b;

  IF v_plan_a.id IS NULL AND v_plan_b.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SWAP: Neither workstation has an active student assignment to swap.';
  END IF;

  -- Case 1: Both workstations are assigned -> swap enrollment_ids in place!
  IF v_plan_a.id IS NOT NULL AND v_plan_b.id IS NOT NULL THEN
    -- Defer unique checks until end of statement for atomic swap
    SET CONSTRAINTS uq_seat_plan_workstation, uq_seat_plan_enrollment DEFERRED;

    -- In PostgreSQL, a single UPDATE with CASE swaps enrollment_id atomically without constraint failure
    UPDATE public.workstation_seat_plans
    SET enrollment_id = CASE
          WHEN id = v_plan_a.id THEN v_plan_b.enrollment_id
          ELSE v_plan_a.enrollment_id
        END,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id IN (v_plan_a.id, v_plan_b.id);

  -- Case 2: Only ws_a is assigned -> move student to empty ws_b
  ELSIF v_plan_a.id IS NOT NULL AND v_plan_b.id IS NULL THEN
    UPDATE public.workstation_seat_plans
    SET workstation_id = p_ws_b,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id = v_plan_a.id;

  -- Case 3: Only ws_b is assigned -> move student to empty ws_a
  ELSE
    UPDATE public.workstation_seat_plans
    SET workstation_id = p_ws_a,
        assigned_by = coalesce(p_user_id, assigned_by)
    WHERE id = v_plan_b.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'swapped_a', v_plan_a.id,
    'swapped_b', v_plan_b.id
  );
END;
$function$
;

-- Function: public.sync_practical_log_attendance
CREATE OR REPLACE FUNCTION public.sync_practical_log_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  effective_headcount int;
  r int;
  is_absent boolean;
begin
  effective_headcount := coalesce(
    nullif(new.total_students, 0),
    nullif(new.present_students + new.absent_students, 0),
    (select coalesce(max(val), 0) from unnest(new.absent_rolls) as val),
    40
  );

  delete from public.log_attendance where log_id = new.id;

  if effective_headcount > 0 then
    for r in 1..effective_headcount loop
      is_absent := (new.absent_rolls is not null and r = any(new.absent_rolls));
      insert into public.log_attendance (id, log_id, roll_number, is_present, created_at)
      values (
        gen_random_uuid()::text,
        new.id,
        r,
        not is_absent,
        now()
      )
      on conflict (log_id, roll_number) do update set
        is_present = excluded.is_present;
    end loop;
  end if;

  return new;
end;
$function$
;

-- ------------------------------------------------------------------------------
-- 7. TRIGGERS
-- ------------------------------------------------------------------------------
-- Trigger: trg_maintenance_log_completion on public.maintenance_logs
DROP TRIGGER IF EXISTS trg_maintenance_log_completion ON public.maintenance_logs;
CREATE TRIGGER trg_maintenance_log_completion AFTER INSERT ON public.maintenance_logs FOR EACH ROW EXECUTE FUNCTION handle_maintenance_log_completion();

-- Trigger: trg_new_maintenance_plan on public.maintenance_plans
DROP TRIGGER IF EXISTS trg_new_maintenance_plan ON public.maintenance_plans;
CREATE TRIGGER trg_new_maintenance_plan AFTER INSERT ON public.maintenance_plans FOR EACH ROW EXECUTE FUNCTION handle_new_maintenance_plan();

-- Trigger: trg_sync_practical_log_attendance on public.practical_logs
DROP TRIGGER IF EXISTS trg_sync_practical_log_attendance ON public.practical_logs;
CREATE TRIGGER trg_sync_practical_log_attendance AFTER INSERT ON public.practical_logs FOR EACH ROW EXECUTE FUNCTION sync_practical_log_attendance();

-- Trigger: trg_sync_practical_log_attendance on public.practical_logs
DROP TRIGGER IF EXISTS trg_sync_practical_log_attendance ON public.practical_logs;
CREATE TRIGGER trg_sync_practical_log_attendance AFTER UPDATE ON public.practical_logs FOR EACH ROW EXECUTE FUNCTION sync_practical_log_attendance();

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY & POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.academic_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_floor_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_selection_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_seat_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstation_seat_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;

-- Policy: "Allow admins manage academic_holidays" on academic_holidays
DO $$ BEGIN
  CREATE POLICY "Allow admins manage academic_holidays" ON public.academic_holidays AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow all read academic_holidays" on academic_holidays
DO $$ BEGIN
  CREATE POLICY "Allow all read academic_holidays" ON public.academic_holidays AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage academic_years" on academic_years
DO $$ BEGIN
  CREATE POLICY "Allow manage academic_years" ON public.academic_years AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read academic_years" on academic_years
DO $$ BEGIN
  CREATE POLICY "Allow read academic_years" ON public.academic_years AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow authenticated users to insert audit logs" on audit_logs
DO $$ BEGIN
  CREATE POLICY "Allow authenticated users to insert audit logs" ON public.audit_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow super admins to view audit logs" on audit_logs
DO $$ BEGIN
  CREATE POLICY "Allow super admins to view audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO public USING ((((auth.jwt() ->> 'role'::text) = 'super_admin'::text) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'super_admin'::text))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read calendar settings" on calendar_settings
DO $$ BEGIN
  CREATE POLICY "Allow read calendar settings" ON public.calendar_settings AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow update calendar settings" on calendar_settings
DO $$ BEGIN
  CREATE POLICY "Allow update calendar settings" ON public.calendar_settings AS PERMISSIVE FOR ALL TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage class_subjects" on class_subjects
DO $$ BEGIN
  CREATE POLICY "Allow manage class_subjects" ON public.class_subjects AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read class_subjects" on class_subjects
DO $$ BEGIN
  CREATE POLICY "Allow read class_subjects" ON public.class_subjects AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage classes" on classes
DO $$ BEGIN
  CREATE POLICY "Allow manage classes" ON public.classes AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read classes" on classes
DO $$ BEGIN
  CREATE POLICY "Allow read classes" ON public.classes AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow privileged view email_dispatch_logs" on email_dispatch_logs
DO $$ BEGIN
  CREATE POLICY "Allow privileged view email_dispatch_logs" ON public.email_dispatch_logs AS PERMISSIVE FOR SELECT TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Admins can manage institution settings" on institution_settings
DO $$ BEGIN
  CREATE POLICY "Admins can manage institution settings" ON public.institution_settings AS PERMISSIVE FOR ALL TO public USING ((((auth.jwt() ->> 'role'::text) = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'lab_incharge'::text, 'hod'::text])))))));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Anyone can view institution settings" on institution_settings
DO $$ BEGIN
  CREATE POLICY "Anyone can view institution settings" ON public.institution_settings AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage categories" on issue_categories
DO $$ BEGIN
  CREATE POLICY "Allow manage categories" ON public.issue_categories AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read categories" on issue_categories
DO $$ BEGIN
  CREATE POLICY "Allow read categories" ON public.issue_categories AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage lab_floor_elements" on lab_floor_elements
DO $$ BEGIN
  CREATE POLICY "Allow manage lab_floor_elements" ON public.lab_floor_elements AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read floor elements" on lab_floor_elements
DO $$ BEGIN
  CREATE POLICY "Allow read floor elements" ON public.lab_floor_elements AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read lab_floor_elements" on lab_floor_elements
DO $$ BEGIN
  CREATE POLICY "Allow read lab_floor_elements" ON public.lab_floor_elements AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "delete lab incidents" on lab_incidents
DO $$ BEGIN
  CREATE POLICY "delete lab incidents" ON public.lab_incidents AS PERMISSIVE FOR DELETE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "insert lab incidents" on lab_incidents
DO $$ BEGIN
  CREATE POLICY "insert lab incidents" ON public.lab_incidents AS PERMISSIVE FOR INSERT TO public WITH CHECK (((reported_by_id = auth.uid()) OR is_privileged()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read lab incidents" on lab_incidents
DO $$ BEGIN
  CREATE POLICY "read lab incidents" ON public.lab_incidents AS PERMISSIVE FOR SELECT TO public USING ((is_privileged() OR (reported_by_id = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "update lab incidents" on lab_incidents
DO $$ BEGIN
  CREATE POLICY "update lab incidents" ON public.lab_incidents AS PERMISSIVE FOR UPDATE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read lab notifications" on lab_notifications
DO $$ BEGIN
  CREATE POLICY "read lab notifications" ON public.lab_notifications AS PERMISSIVE FOR SELECT TO public USING ((is_privileged() OR (target_role = "current_role"())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "write lab notifications" on lab_notifications
DO $$ BEGIN
  CREATE POLICY "write lab notifications" ON public.lab_notifications AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow insert/update labs" on labs
DO $$ BEGIN
  CREATE POLICY "Allow insert/update labs" ON public.labs AS PERMISSIVE FOR ALL TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read labs" on labs
DO $$ BEGIN
  CREATE POLICY "Allow read labs" ON public.labs AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage log_attendance" on log_attendance
DO $$ BEGIN
  CREATE POLICY "Allow manage log_attendance" ON public.log_attendance AS PERMISSIVE FOR ALL TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read log_attendance" on log_attendance
DO $$ BEGIN
  CREATE POLICY "Allow read log_attendance" ON public.log_attendance AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Delete Maintenance Logs" on maintenance_logs
DO $$ BEGIN
  CREATE POLICY "Delete Maintenance Logs" ON public.maintenance_logs AS PERMISSIVE FOR DELETE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Insert Maintenance Logs" on maintenance_logs
DO $$ BEGIN
  CREATE POLICY "Insert Maintenance Logs" ON public.maintenance_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Read Maintenance Logs" on maintenance_logs
DO $$ BEGIN
  CREATE POLICY "Read Maintenance Logs" ON public.maintenance_logs AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Update Maintenance Logs" on maintenance_logs
DO $$ BEGIN
  CREATE POLICY "Update Maintenance Logs" ON public.maintenance_logs AS PERMISSIVE FOR UPDATE TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Manage Plans" on maintenance_plans
DO $$ BEGIN
  CREATE POLICY "Manage Plans" ON public.maintenance_plans AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Read Maintenance Plans" on maintenance_plans
DO $$ BEGIN
  CREATE POLICY "Read Maintenance Plans" ON public.maintenance_plans AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Manage Reminders" on maintenance_reminders
DO $$ BEGIN
  CREATE POLICY "Manage Reminders" ON public.maintenance_reminders AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Read Maintenance Reminders" on maintenance_reminders
DO $$ BEGIN
  CREATE POLICY "Read Maintenance Reminders" ON public.maintenance_reminders AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "delete practical logs" on practical_logs
DO $$ BEGIN
  CREATE POLICY "delete practical logs" ON public.practical_logs AS PERMISSIVE FOR DELETE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "insert practical logs" on practical_logs
DO $$ BEGIN
  CREATE POLICY "insert practical logs" ON public.practical_logs AS PERMISSIVE FOR INSERT TO public WITH CHECK ((is_privileged() OR (teacher_id = auth.uid()) OR (logged_by = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read practical logs" on practical_logs
DO $$ BEGIN
  CREATE POLICY "read practical logs" ON public.practical_logs AS PERMISSIVE FOR SELECT TO public USING ((is_privileged() OR (teacher_id = auth.uid()) OR (logged_by = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "update practical logs" on practical_logs
DO $$ BEGIN
  CREATE POLICY "update practical logs" ON public.practical_logs AS PERMISSIVE FOR UPDATE TO public USING ((is_privileged() OR (teacher_id = auth.uid()) OR (logged_by = auth.uid()))) WITH CHECK ((is_privileged() OR (teacher_id = auth.uid()) OR (logged_by = auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read profiles" on profiles
DO $$ BEGIN
  CREATE POLICY "Allow read profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow users update own profile" on profiles
DO $$ BEGIN
  CREATE POLICY "Allow users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage schedules" on schedules
DO $$ BEGIN
  CREATE POLICY "Allow manage schedules" ON public.schedules AS PERMISSIVE FOR ALL TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read schedules" on schedules
DO $$ BEGIN
  CREATE POLICY "Allow read schedules" ON public.schedules AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "manage_session_seat_overrides_privileged" on session_seat_overrides
DO $$ BEGIN
  CREATE POLICY "manage_session_seat_overrides_privileged" ON public.session_seat_overrides AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read_session_seat_overrides_scoped" on session_seat_overrides
DO $$ BEGIN
  CREATE POLICY "read_session_seat_overrides_scoped" ON public.session_seat_overrides AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage streams" on streams
DO $$ BEGIN
  CREATE POLICY "Allow manage streams" ON public.streams AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read streams" on streams
DO $$ BEGIN
  CREATE POLICY "Allow read streams" ON public.streams AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "manage_student_enrollments_privileged" on student_enrollments
DO $$ BEGIN
  CREATE POLICY "manage_student_enrollments_privileged" ON public.student_enrollments AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read_student_enrollments_scoped" on student_enrollments
DO $$ BEGIN
  CREATE POLICY "read_student_enrollments_scoped" ON public.student_enrollments AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "manage_students_privileged" on students
DO $$ BEGIN
  CREATE POLICY "manage_students_privileged" ON public.students AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read_students_scoped" on students
DO $$ BEGIN
  CREATE POLICY "read_students_scoped" ON public.students AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage subjects" on subjects
DO $$ BEGIN
  CREATE POLICY "Allow manage subjects" ON public.subjects AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read subjects" on subjects
DO $$ BEGIN
  CREATE POLICY "Allow read subjects" ON public.subjects AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage teacher_substitutions" on teacher_substitutions
DO $$ BEGIN
  CREATE POLICY "Allow manage teacher_substitutions" ON public.teacher_substitutions AS PERMISSIVE FOR ALL TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read teacher_substitutions" on teacher_substitutions
DO $$ BEGIN
  CREATE POLICY "Allow read teacher_substitutions" ON public.teacher_substitutions AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow delete issues" on workstation_issues
DO $$ BEGIN
  CREATE POLICY "Allow delete issues" ON public.workstation_issues AS PERMISSIVE FOR DELETE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read issues" on workstation_issues
DO $$ BEGIN
  CREATE POLICY "Allow read issues" ON public.workstation_issues AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow report issues" on workstation_issues
DO $$ BEGIN
  CREATE POLICY "Allow report issues" ON public.workstation_issues AS PERMISSIVE FOR INSERT TO public WITH CHECK (((auth.uid() = reported_by_id) OR is_privileged()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow resolve issues" on workstation_issues
DO $$ BEGIN
  CREATE POLICY "Allow resolve issues" ON public.workstation_issues AS PERMISSIVE FOR UPDATE TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "manage_workstation_seat_plans_privileged" on workstation_seat_plans
DO $$ BEGIN
  CREATE POLICY "manage_workstation_seat_plans_privileged" ON public.workstation_seat_plans AS PERMISSIVE FOR ALL TO public USING (is_privileged()) WITH CHECK (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "read_workstation_seat_plans_scoped" on workstation_seat_plans
DO $$ BEGIN
  CREATE POLICY "read_workstation_seat_plans_scoped" ON public.workstation_seat_plans AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow manage workstations" on workstations
DO $$ BEGIN
  CREATE POLICY "Allow manage workstations" ON public.workstations AS PERMISSIVE FOR ALL TO public USING (is_privileged());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Policy: "Allow read workstations" on workstations
DO $$ BEGIN
  CREATE POLICY "Allow read workstations" ON public.workstations AS PERMISSIVE FOR SELECT TO public USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
