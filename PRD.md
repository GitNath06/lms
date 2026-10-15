# Product Requirements Document (PRD)
## Project Name: LabSync — Institutional Laboratory Management System (LIMS / LMR)

- **Target Persona**: Lab In-Charge, Department Heads (HOD), Subject Instructors, and Institutional Super Admins at academic colleges and higher secondary institutions (Classes 11 & 12, undergraduate science & engineering laboratories in Nepal).
- **Primary Tech Stack**: Next.js 16+ (App Router, React 19, Server Components & Server Actions), TypeScript (Strict Mode), Tailwind CSS, Radix UI Primitives, Supabase PostgreSQL, ExcelJS.
- **Calendar Support**: Dual Gregorian (AD) and Bikram Sambat (BS) Nepali Calendar Engine (`nepali-date-converter`, `lib/nepali-calendar.ts`).
- **Design Theme**: Deep Obsidian & Midnight Slate (Dark: Canvas `#0B0F19`, Surface `#101726`) / Pearl Slate (Light: `#F8FAFC`) with specular milled chamfer highlights, layered `.glass-card` surfaces, and tactile micro-physics.

---

## 1. Executive Summary

Academic science and technology laboratories (Computer, Physics, Chemistry, Biology, and Electronics) frequently struggle with manual paper logbooks, session slot collisions, untracked equipment damage, ad-hoc maintenance neglect, and cumbersome attendance tallying during institutional handovers.

**LabSync LIMS** digitizes and modernizes laboratory operations through a single, cohesive institutional platform:
1. **Academic Practical Operations**: Real-time Sunday–Friday timetable routines, Class 11/12 batch attendance tallying, syllabus progress tracking, and dual sign-off (Subject Teacher + Lab In-Charge audit verification).
2. **Interactive CAD Floor Plan & Workstation Cockpit**: Clamped pan/zoom CAD floor viewport, 34-node minimap radar, chamfered living LCD nodes with status LEDs, high-speed roll-call accelerators (`Jump-to-Roll`, `Mark All Present`, `Invert`), and quick station popovers.
3. **Laboratory Infrastructure & Maintenance**: Interactive visual matrix inspections, recurring maintenance SOP routines (thermal paste, deep PC cleaning, BIOS updates, glassware checks), automated due-date reminders, and digital service certification.
4. **Institutional Reporting & Board Exam Intelligence**: Canonical PostgreSQL queries (zero shadow databases) computing NEB 75% practical attendance compliance, syllabus completion quotas, faculty dual sign-off rate, 36 hr/wk lab room occupancy, and workstation MTTR/uptime hotspots.
5. **Triple-Collision Defense & Audit Ledger**: Pre-flight collision engine preventing Room, Faculty, and Student Cohort double-booking across weekly timetable and ad-hoc practical slots, coupled with an immutable structured JSONB diff audit ledger.
6. **Multi-Year Academic Lifecycle & Cohort Promotion**: Multi-year student roll management, atomic cohort promotion from Grade 11 to Grade 12 with repeater and transfer exceptions, and database status check constraint enforcement.
7. **Institutional Handover & Multi-Format Exports**: Official NEB Board Exam styled `.xlsx` workbooks with three-tier signature blocks, raw CSV exports, and high-fidelity A4 landscape print sheets (`@media print` protected).

---

## 2. User Roles & Permissions (RBAC)

Role-based access control is strictly enforced at the server action and UI component layers (`lib/permissions.ts`, `hooks/use-user-scope.ts`):

| Role | Access Level | Primary Focus & Permissions |
| :--- | :--- | :--- |
| **Super Admin** (`super_admin`) | Full Root Access | User approvals & credential management, role assignments, system reset, timetable configuration, maintenance routine presets, academic year lifecycle & cohort promotions, institution settings, guarded by the **Precaution Active** safety lock. |
| **Lab In-Charge** (`lab_incharge`) | Laboratory Operations | Full Maintenance Workbench (`/maintenance`), CAD floor plan, workstation matrix inspections, incident triage & repair settlements, attendance verification, routine execution, and daily print sheets. |
| **Head of Dept** (`hod`) | Department Oversight | Department-wide practical audits, incident escalations, syllabus quota/pace review, board exam compliance analytics, and certified academic reports. |
| **Teacher / Faculty** (`teacher`) | Instructor Access | 1-click practical logging (`/logs/new`), Live Lab Cockpit roll-call, viewing assigned timetable slots, student attendance roll-call, and reporting equipment breakages. |

> **Note on Data Model Integrity**: Legacy "department" strings have been completely purged from the user model. Faculty and administrators are scoped exclusively via **Role Badges** and **Assigned Laboratory / Facility Scope**.

---

## 3. Database Schema Specification (Supabase PostgreSQL)

```sql
-- ENUMS
create type user_role as enum ('super_admin', 'lab_incharge', 'hod', 'teacher');
create type approval_status as enum ('pending', 'approved', 'rejected');
create type lab_type as enum ('computer_lab', 'physics_lab', 'chemistry_lab', 'biology_lab', 'electronics_lab');
create type session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled', 'skipped');
create type incident_severity as enum ('minor', 'moderate', 'major_critical');
create type incident_status as enum ('reported', 'investigating', 'resolved', 'escalated_to_hod');
create type maintenance_cadence as enum ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semester', 'yearly');
create type maintenance_status as enum ('pending', 'overdue', 'completed', 'snoozed');

-- 1. PROFILES TABLE (Zero department clutter; Scoped RBAC)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null unique,
  role user_role default 'teacher',
  approval_status approval_status default 'pending',
  permissions jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 2. LAB ROOMS & FACILITIES (Status Lifecycle)
create table labs (
  id text primary key,
  name text not null,
  type lab_type not null,
  capacity int not null default 36,
  status text not null default 'Operational' check (status in ('Operational', 'Under Maintenance', 'Inactive')),
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 3. ACADEMIC YEARS
create table academic_years (
  id text primary key, -- e.g. '2083'
  name text not null, -- e.g. '2083/84'
  start_date text not null,
  end_date text not null,
  is_current boolean default false,
  created_at timestamp with time zone default now()
);

-- 4. CLASSES & CURRICULAR MAPPING
create table classes (
  id text primary key, -- e.g. '11sci', '12eng'
  name text not null,
  grade_level int not null check (grade_level in (11, 12)),
  stream text not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id text references classes(id) on delete cascade not null,
  subject_code text not null,
  subject_name text not null,
  weekly_quota int default 2,
  created_at timestamp with time zone default now()
);

-- 5. STUDENTS & ANNUAL ENROLLMENTS
create table students (
  id uuid primary key default gen_random_uuid(),
  admission_no text unique,
  registration_no text unique,
  full_name text not null,
  gender text check (gender in ('M', 'F', 'O')),
  is_active boolean default true,
  archived_at timestamp with time zone,
  archive_reason text,
  created_at timestamp with time zone default now()
);

create table student_enrollments (
  id uuid primary key default gen_random_uuid(),
  academic_year_id text references academic_years(id) on delete cascade not null,
  class_id text references classes(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  roll_number int not null,
  section text not null default 'A',
  status text not null default 'active' check (status in ('active', 'transferred', 'graduated', 'archived', 'completed')),
  created_at timestamp with time zone default now(),
  unique (academic_year_id, class_id, roll_number),
  unique (academic_year_id, class_id, student_id)
);

-- 6. WORKSTATIONS & CAD FLOOR ELEMENTS
create table workstations (
  id text primary key, -- e.g. 'PC-01'
  lab_id text references labs(id) on delete cascade not null,
  label text not null,
  pos_x float not null default 0,
  pos_y float not null default 0,
  device_type text not null default 'pc',
  row_label text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table floor_elements (
  id uuid primary key default gen_random_uuid(),
  lab_id text references labs(id) on delete cascade not null,
  element_type text not null, -- 'door', 'window', 'pillar', 'board', 'podium', 'bench'
  label text,
  pos_x float not null default 0,
  pos_y float not null default 0,
  width float not null default 80,
  height float not null default 40,
  rotation float not null default 0
);

create table workstation_seat_plans (
  id uuid primary key default gen_random_uuid(),
  lab_id text references labs(id) on delete cascade not null,
  academic_year_id text references academic_years(id) on delete cascade not null,
  class_id text references classes(id) on delete cascade not null,
  workstation_id text references workstations(id) on delete cascade not null,
  enrollment_id uuid references student_enrollments(id) on delete cascade not null,
  notes text,
  assigned_by uuid references profiles(id),
  created_at timestamp with time zone default now(),
  unique (lab_id, academic_year_id, class_id, workstation_id),
  unique (lab_id, academic_year_id, class_id, enrollment_id)
);

create table workstation_issues (
  id uuid primary key default gen_random_uuid(),
  workstation_id text references workstations(id) on delete cascade not null,
  reported_by uuid references profiles(id),
  title text not null,
  description text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 7. MASTER ROUTINES & TIMETABLE
create table schedules (
  id text primary key,
  day_of_week int not null, -- 0=Sunday to 5=Friday
  time_slot text not null,
  slot_id text not null,
  span int default 1,
  lab_id text references labs(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  subject_code text not null,
  subject_title text not null,
  class_grade text not null,
  default_students int default 36,
  status text default 'active',
  created_at timestamp with time zone default now()
);

-- 8. PRACTICAL LOG ENTRIES (Academic Session Records)
create table practical_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id text references schedules(id) on delete set null,
  lab_id text references labs(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  date text not null, -- YYYY-MM-DD
  period_label text,
  subject_name text not null,
  batch_group text,
  practical_title text,
  topic_learned text,
  total_students int not null default 0,
  present_students int not null default 0,
  absent_students int not null default 0,
  absent_rolls int[] default '{}',
  status session_status default 'completed',
  skip_reason text,
  remarks text,
  logged_by uuid references profiles(id),
  academic_year_id text references academic_years(id),
  class_subject_id uuid references class_subjects(id),
  created_at timestamp with time zone default now()
);

-- 9. PREVENTIVE MAINTENANCE PLANS & SERVICE LOGS
create table maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  lab_id text references labs(id) on delete cascade not null,
  cadence maintenance_cadence not null default 'monthly',
  checklist text[] default '{}',
  affected_machines text[] default '{}',
  category text not null default 'hardware',
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references maintenance_plans(id) on delete set null,
  lab_id text references labs(id) on delete cascade not null,
  performed_by uuid references profiles(id) on delete set null,
  performed_at timestamp with time zone default now(),
  asset_identifier text,
  work_performed text,
  observations text,
  next_recommended_date text,
  status text not null default 'completed',
  created_at timestamp with time zone default now()
);

-- 10. EQUIPMENT BREAKAGE & INCIDENT REGISTER
create table lab_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lab_id text references labs(id) on delete cascade not null,
  reported_by uuid references profiles(id) on delete set null,
  equipment_name text not null,
  incident_type text not null,
  severity incident_severity default 'minor',
  status incident_status default 'reported',
  escalated_to_hod boolean default false,
  resolution_notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 11. IMMUTABLE AUDIT LEDGER
create table audit_ledger (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_id uuid references profiles(id),
  before_state jsonb,
  after_state jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
```

---

## 4. Core Feature Specifications & Module Breakdown

### Module 1: Authentication, Access Approvals & Security Shell
- **Email/Password & OTP Flow**: Supabase Auth client/server integration (`@supabase/ssr`).
- **Account Approval Pipeline**: New accounts start in `pending` approval status. Super Admins approve or reject registrations from the Admin Console.
- **Top Navigation & Global Command Palette**:
  - Prominent search pill (`Search sessions, rooms, faculty... Ctrl+K` / `⌘K`).
  - Hydration-safe state synchronization powered by React 19's `useSyncExternalStore`.
  - Live clock indicator rendering Nepal Standard Time (NPT) with active period tracking.
- **User Profile Menu**: Renders role badge, assigned facility scope, theme toggle, and secure sign-out.

### Module 2: Live Operational Command Center (`/`)
- **Live Session Cockpit**:
  - Two-state dynamic dispatcher (Active Session Running vs. Standby / Next Upcoming).
  - Concentric radar pulse pip (`animate-ping`) for real-time in-session telemetry.
  - Multi-lab horizontal switcher for admins and coordinators to inspect concurrent sessions across rooms.
  - 1-click **Log Attendance** and **Skip Session** triggers.
- **High-Density KPI Row (Zero Card-in-Card Nesting)**:
  - 3 standalone `.glass-card` elements in a `grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3` at ~76px total height.
  - Row 1: Tinted icon badge + title (left) | status pill (right).
  - Row 2: Bold metric (`text-xl font-extrabold font-heading`) on left | micro-context / progress bar on right.
- **Quick Operations Strip**:
  - Synchronized ~76px height in right column (`Print Report` + `New Log` + `Daily Sheet ↗`).
- **Three-Tier Semantic Attendance System**:
  - `>= 85%`: Success (Emerald text + emerald badge `Optimal`)
  - `75% - 84%`: Nominal (Neutral slate text + neutral badge `Normal` — zero false warning)
  - `< 75%`: Danger (Rose text + rose badge `Low Rate`)
  - `0%` / Pending: Neutral dash `—` + neutral badge `Awaiting`

### Module 3: Interactive CAD Floor Plan & Workstation Cockpit (`/computer-lab`)
- **CAD Pan/Zoom Interactive Viewport**:
  - Smooth clamping ($0.5\times$ to $1.6\times$) with cursor-centered focal scaling.
  - Multi-touch pinch zoom, middle-click and `Space + Drag` panning, and focus auto-centering.
- **Floating HUD Canvas Controls**:
  - Zoom in/out, 1:1 reset, fit-to-screen, pan mode toggle, radar minimap toggle. Strictly zero literal `+` in labels.
- **Collapsible Minimap Radar**:
  - Real-time 34-node room preview with attendance/status micro-dots and interactive draggable/clickable bounding viewport box.
- **Living LCD Workstation Nodes**:
  - Chamfered extruded bezels (`inset 0 1px 0 0 rgba(255,255,255,0.08)`), power status LEDs, glowing roll-call rings, and tactile spring click response (`active:scale-95`).
- **High-Speed Roll-Call Accelerators**:
  - Jump-to-Roll input with instant viewport pan & focal halo beacon.
  - "Mark All Present", "Invert Attendance", and live 3-tier attendance indicator.
- **Quick Station Popover**:
  - Floating 1-tap popover for attendance toggle, Tier 2 seat partner swap, and direct fault report ticket creation.
- **Official A4 Wall Seating Chart (`/print/seating-chart`)**:
  - Laminated printable room chart grouped by rows A–D with teacher podium.

### Module 4: Dual Calendar & Nepali Date Engine
- **Bilingual Gregorian (AD) & Bikram Sambat (BS)**:
  - Integrated Nepali calendar converter (`nepali-date-converter`, `lib/nepali-calendar.ts`).
  - Dual Calendar Picker component (`components/admin/dual-calendar-picker.tsx`) showing simultaneous BS year/month/day and AD equivalent.
- **Academic Holiday & Recess Detection**:
  - Auto-identifies gazetted national and institutional holidays.
  - Whole-day suspension banners automatically replace routine grids on recess dates.

### Module 5: Weekly Routine & Timetable Grid (`/schedules`)
- **Sunday–Friday Academic Week Schedule**:
  - Full support for standard Nepali school/college 6-day academic operating cycle.
- **Live "Now" Timeline Beacon**:
  - Highlights ongoing period slot with a pulsating `LIVE` badge and ambient column tint.
- **2-Line Slot Typography Hierarchy**:
  - Line 1: Subject Code & Class Grade/Batch in bold.
  - Line 2: Teacher Name and Micro-Time Slot Badge (zero horizontal truncation).
- **Consecutive Period Merging**:
  - Seamless consolidation of two continuous periods into a single extended practical block.

### Module 6: Triple-Collision Defense Engine (`lib/scheduling/conflict-engine.ts`)
- Pre-flight validation executed before creating schedules or ad-hoc practical logs.
- Guarding 3 critical conflict dimensions:
  1. **Room Collision**: Prevents double-booking the same lab at overlapping times on the same day.
  2. **Faculty Collision**: Prevents scheduling the same instructor in multiple rooms at the same time.
  3. **Student Cohort Collision**: Prevents double-booking a class/batch across concurrent practicals.

### Module 7: Canonical Institutional Reporting & Operational Intelligence (`/analytics`)
- **Zero Shadow Databases**: All metrics derived directly on-the-fly from live PostgreSQL operational tables.
- **NEB 75% Board Exam Practical Compliance**:
  - Class-wise student practical attendance tally, total session hours, present hours, percentage rate, and compliance flag (`Eligible` vs. `At Risk`).
- **Syllabus Practical Quota & Skipped Sessions**:
  - Track term syllabus experiment quotas per subject, completed sessions, and categorize reasons for skipped lab slots.
- **Faculty Practical Operations & Dual Sign-Off Audit**:
  - Teacher session logging volume, dual sign-off verification rate by Lab In-Charge, and pending verification backlog.
- **Laboratory Room Occupancy Index**:
  - Standard 36-period academic weekly capacity, booked periods, occupancy percentage, and total student footfall.
- **Workstation Reliability & MTTR Hotspots**:
  - Workstation uptime %, Mean Time To Resolution (MTTR in hours), and repeat fault hotspots.
- **Workstation Technical Biography Drawer**:
  - Interactive slide-out lifecycle timeline showing historical faults, preventive maintenance services, and past student seating history for any PC.

### Module 8: Multi-Year Academic Lifecycle & Cohort Promotion
- **Academic Year Management**: Multi-cycle support (`2082/83`, `2083/84`) with active operational cycle switching.
- **Atomic Cohort Promotion (`promoteCohortAction`)**:
  - Mass promotion from Grade 11 to Grade 12.
  - Exception handling for repeaters (retained in same grade) and transfers/dropouts (archived).
  - Enforced check constraint: `status IN ('active', 'transferred', 'graduated', 'archived', 'completed')`.

### Module 9: Preventive Maintenance Workbench (`/maintenance`)
- **2-Tab Architecture**:
  - **Tab 1: Routine Tasks & Schedules**: Active maintenance routines, cadence, last serviced date & technician, next due status badges (`Overdue`, `Due Today`, `Scheduled`), and 1-click **Record Service** or **Postpone**.
  - **Tab 2: Certified Service History & Logbook**: Searchable historical logbook with machine checklists, observations, and printable log sheet.
- **Interactive 40-Workstation Matrix (`WorkstationMatrixSelector`)**:
  - Visual grid of PC desks (`PC-01` to `PC-40`).
  - 3-State cycling on desk click: Pending &rarr; Cleaned & Serviced &rarr; Flagged Faulty.
  - Batch Action Toolbar: `Select All`, `Invert`, `Flag Faults`, `Reset`.
- **Institutional Digital Sign-Off Certificate Stamp**:
  - Institutional seal stamp rendered on maintenance log completion.
- **Zero Pricing Clutter**: Strictly focused on technical compliance (cleaning, thermal paste, BIOS, OS updates, cable routing, glassware safety) without budgetary noise.

### Module 10: Equipment Breakage & Incident Register (`/incidents` & `/records/incidents`)
- **Breakage Intake**: Equipment name, damage type, severity (`minor`, `moderate`, `major_critical`), and description notes.
- **HOD Escalation Trigger**: High-severity incidents automatically flag for Department Head / Coordinator intervention.
- **Settlement & Repair Drawer**: Lab In-Charge records repairs, replacements, student compensation status, or decommissioning.

### Module 11: Multi-Format Board Exports & Real-Time Reminders
- **ExcelJS Export Engine (`lib/exports/xlsx.ts`)**:
  - Official NEB Practical Attendance & Board Exam Compliance Register with institutional header styling, alternating row striping, auto-width columns, and 3-tier signature blocks ("Subject Teacher", "Lab In-Charge", "HOD / Principal").
- **CSV Dataset Export (`lib/exports/csv.ts`)**: Clean raw comma-separated values for school data systems.
- **Real-Time Reminders Queue (`getInstitutionalReminders`)**:
  - Derived alert notifications for critical workstation faults, overdue preventive maintenance, and unverified practical sessions.

### Module 12: High-Fidelity A4 Landscape Print Engine (`/print/*`)
- **Available Print Sheets**:
  - `/print/daily-log`: Daily institutional laboratory sign-off register.
  - `/print/records`: Filtered historical practical session register.
  - `/print/incidents`: Institutional equipment damage and hazard register.
  - `/print/maintenance`: Technical maintenance logbook and servicing certificate.
  - `/print/seating-chart`: Laminated physical room seating chart.
- **Print Shield Architecture**: `@media print` CSS rules automatically strip sidebars, command palettes, theme toggles, and backgrounds, enforcing a pure white background with crisp black typography and dual signature blocks.

### Module 13: Institutional Admin Console & Safety Lock (`/admin`)
- **Tab 1: User Access & Approvals**: Manage registrations, assign roles, reset credentials.
- **Tab 2: Master Timetable Routine Manager**: Edit weekly schedule periods, map subject codes to faculty.
- **Tab 3: Maintenance Routines Manager**: Edit checklists, toggle active/paused routines, and 1-click install recommended SOP presets.
- **Tab 4: Institution Settings**: Configure institution name, shift structures, and academic terms.
- **Precaution Active Safety Switch**: A mandatory toggle guard that prevents accidental edits or deletions in administrative tools.

---

## 5. Visual Design System & Interaction Standards

### Color Tokens & Palette Hierarchy
- **Dark Theme (Deep Obsidian & Midnight Slate)**:
  - Canvas: `#0B0F19`
  - Surface-1: `#101726`
  - Surface-2: `#151E32`
  - Surface-3: `#1A253D`
  - Hairline Borders: `border-white/[0.08]`
  - Milled Chamfer Highlight: `inset 0 1px 0 0 rgba(255, 255, 255, 0.06)`
- **Light Theme (Pearl Slate)**:
  - Canvas: `#F8FAFC`
  - Surface: `#FFFFFF`
  - Hairline Borders: `border-zinc-200/80`
- **Typography Stack**:
  - Heading: `Plus Jakarta Sans` (`font-heading`)
  - Body & UI: `Inter` (`font-sans`)
  - Bilingual Devanagari Fallback: `Noto Sans Devanagari` (`--font-devanagari`)
  - Monospace / Numerics: `JetBrains Mono` (`font-mono`) with global `tabular-nums`
- **Tactile Physics**:
  - Buttons compress `2–3%` on click (`active:scale-[0.97]` with `motion-reduce:active:scale-100`).
  - Cards elevate on hover (`hover:-translate-y-0.5 hover:shadow-xs transition-all duration-150 ease-out`).

---

## 6. Critical Developer Guardrails & Invariants

1. **NO Literal `+` in Button Labels**: Always pair icons with natural text (`<Plus className="h-4 w-4" /> <span>Record Service</span>`), never `<span>+ Record Service</span>`.
2. **Standardized Academic Terminology**:
   - Use **"Attendance"** — never "Turnout".
   - Use **"Timetable"** or **"Schedule Grid"** — never "Matrix".
   - Use **"Logbook"** — never "Ledger".
   - Use **"Equipment Breakage"** — never "Apparatus Breakage".
3. **Safety Lock**: The Super Admin safety switch is named **"Precaution Active"**; retain this label and functionality.
4. **Zero Pricing/Cost Clutter**: Maintenance logs and plans track technical compliance only. No financial fields.
5. **Zero Department Regressions**: Never re-introduce department strings to profiles or tables. Use Role Badges and Facility Scopes.
6. **Zero Shadow Databases**: All analytics and reports must query canonical PostgreSQL tables directly.
7. **Triple-Collision Validation**: Every schedule slot and live booking must pass Room, Faculty, and Cohort collision checks.
8. **Strict TypeScript Standards**: All code must pass `npx tsc --noEmit` with **0 errors**.
9. **Next.js `'use server'` Rules**: Server action files must only export async functions. Domain constants, types, and synchronous validators belong in `lib/`.
10. **Derived Workstation Status**: Workstation operational state is derived from `workstation_issues`, not a static column.