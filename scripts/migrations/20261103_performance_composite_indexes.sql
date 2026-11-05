-- Performance Optimization: High-Velocity Composite B-Tree Indexes
-- Prevents sequential table scans during class roster loads, seat assignments, and date-locked log queries.

-- 1. High-velocity cohort queries (getStudentsByClass, roster pagination, roll-call)
CREATE INDEX IF NOT EXISTS idx_student_enrollments_cohort 
ON public.student_enrollments (academic_year_id, class_id, status, roll_number);

-- 2. CAD floor seating lookups by class & academic year
CREATE INDEX IF NOT EXISTS idx_workstation_seat_plans_class_year 
ON public.workstation_seat_plans (class_id, academic_year_id);

-- 3. Date-locked practical log skip/completion detection & routine linking
CREATE INDEX IF NOT EXISTS idx_practical_logs_date_schedule 
ON public.practical_logs (date, schedule_id);

