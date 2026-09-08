# Product Requirements Document (PRD)
## Project Name: LabSync — Institutional Laboratory Management System (LIMS / LMR)

- **Target Persona**: Lab In-Charge, Department Heads (HOD), Subject Instructors, and Institutional Super Admins at academic colleges and higher secondary institutions (Classes 11 & 12, undergraduate science & engineering laboratories).
- **Primary Tech Stack**: Next.js 16+ (App Router, React 19, Server Components & Server Actions), TypeScript (Strict Mode), Tailwind CSS, Radix UI Primitives, Supabase PostgreSQL, ExcelJS.
- **Calendar Support**: Dual Gregorian (AD) and Bikram Sambat (BS) Nepali Calendar Engine.
- **Design Theme**: Deep Obsidian & Midnight Slate (Dark) / Pearl Slate (Light) with specular milled chamfer highlights, layered `.glass-card` surfaces, and tactile micro-physics.

---

## 1. Executive Summary

Academic science and technology laboratories (Computer, Physics, Chemistry, Biology, and Electronics) frequently struggle with manual paper logbooks, session slot collisions, untracked equipment damage, ad-hoc maintenance neglect, and cumbersome attendance tallying during institutional handovers.

**LabSync LIMS** digitizes and modernizes laboratory operations through a single, cohesive institutional platform:
1. **Academic Practical Operations**: Real-time Sunday–Friday timetable routines, Class 11/12 batch attendance tallying, syllabus progress tracking, and dual sign-off (Subject Teacher + Lab In-Charge audit verification).
2. **Laboratory Infrastructure & Maintenance**: Interactive 40-workstation visual grid inspection, recurring maintenance SOP routines (thermal paste, deep PC cleaning, BIOS updates, glassware checks), automated due-date reminder tracking, and institutional digital service certification.
3. **Breakage & Incident Escalation**: Systematic breakage triage, severity classification, coordinator/HOD escalation, and digital damage settlement registers.
4. **Institutional Reporting & Audit Handover**: Instant Excel (`.xlsx`) workbooks, CSV datasets, and pixel-perfect A4 landscape print sheets protected by `@media print` shields.

---

## 2. User Roles & Permissions (RBAC)

Role-based access control is strictly enforced at the server action and UI component layers (`lib/permissions.ts`, `hooks/use-user-scope.ts`):

| Role | Access Level | Primary Focus & Permissions |
| :--- | :--- | :--- |
| **Super Admin** (`super_admin`) | Full Root Access | User approvals & credential management, role assignments, system reset, timetable configuration, maintenance routine presets, institution settings, guarded by the **Precaution Active** safety lock. |
| **Lab In-Charge** (`lab_incharge`) | Laboratory Operations | Full Maintenance Workbench (`/maintenance`), workstation matrix inspections, incident triage & repair settlements, attendance verification, routine execution, and daily print sheets. |
| **Head of Dept** (`hod`) | Department Oversight | Department-wide practical audits, incident escalations, syllabus quota/pace review, and certified academic reports. |
| **Teacher / Faculty** (`teacher`) | Instructor Access | 1-click practical logging (`/logs/new`), viewing assigned timetable slots, student attendance roll-call, and reporting equipment breakages. |

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

-- 2. LAB ROOMS & FACILITIES
create table labs (
  id text primary key,
  name text not null,
  type lab_type not null,
  capacity int not null default 36,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 3. MASTER ROUTINES & TIMETABLE
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
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 4. PRACTICAL LOG ENTRIES (Academic Session Records)
create table practical_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id text references schedules(id) on delete set null,
  lab_id text references labs(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  date text not null, -- YYYY-MM-DD (Nepal Standard Time)
  time_slot text not null,
  subject_code text not null,
  subject_title text not null,
  class_grade text not null,
  batch text,
  experiment_title text,
  topic_learned text,
  total_students int not null default 0,
  present_students int not null default 0,
  status session_status default 'completed',
  is_skipped boolean default false,
  skip_reason text,
  remarks text,
  incharge_verified boolean default false,
  verified_by uuid references profiles(id),
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 5. PREVENTIVE MAINTENANCE PLANS
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

-- 6. MAINTENANCE REMINDERS & DUE ALERTS
create table maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references maintenance_plans(id) on delete cascade not null,
  due_date text not null,
  snooze_until text,
  status maintenance_status default 'pending',
  last_notified_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 7. CERTIFIED SERVICE LOGBOOK (Historical Service Record)
create table maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references maintenance_plans(id) on delete set null,
  lab_id text references labs(id) on delete cascade not null,
  performed_by uuid references profiles(id) on delete set null,
  performed_at timestamp with time zone default now(),
  checklist_completed text[] default '{}',
  serviced_machines text[] default '{}',
  observations text,
  next_recommended_date text,
  status text not null default 'completed',
  created_at timestamp with time zone default now()
);

-- 8. EQUIPMENT BREAKAGE & INCIDENT REGISTER
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

-- 9. ACADEMIC CALENDAR & GAZETTED HOLIDAYS
create table academic_holidays (
  id uuid primary key default gen_random_uuid(),
  date text not null unique, -- YYYY-MM-DD
  name text not null,
  nepali_date text,
  is_gazetted boolean default true,
  affects_labs boolean default true
);

-- 10. INSTITUTION SETTINGS
create table institution_settings (
  id text primary key default 'default',
  institution_name text not null,
  institution_code text,
  academic_year text,
  current_term text,
  daily_shifts jsonb default '["Morning", "Day"]'::jsonb,
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
- **Sliding Segmented Tabs (Area 1)**:
  - Fluid animated pill indicator with spatial continuity between `Live & Upcoming`, `Pending`, `Logged Records`, and `All`.
  - Zero heavy animation runtimes (pure CSS transitions + React layout measurement).
  - Tactile button physics (`active:scale-[0.97]` with `motion-reduce:active:scale-100` safety).
- **Lab Identity Edge Ribbons (Area 4)**:
  - Subtle `3px` left-border accent ribbons on session items for instant visual recognition:
    - Computer Lab: `border-l-indigo-500`
    - Physics Lab: `border-l-cyan-500`
    - Chemistry Lab: `border-l-rose-500`
    - Biology Lab: `border-l-emerald-500`
    - Electronics / Hardware: `border-l-amber-500`
- **Academic Progress Widget (`SyllabusProgress`)**:
  - Term experiment quota pace vs. recent verified practical activity.
  - Smooth animated progress bar fill (`duration-700 ease-out`).
- **Equipment Health & Breakage Summary (`IncidentRegistryCard`)**:
  - Overview of open breakages, HOD escalations, and 1-click **Report Damage** modal.

### Module 3: Dual Calendar & Nepali Date Engine
- **Bilingual Gregorian (AD) & Bikram Sambat (BS)**:
  - Integrated Nepali calendar converter (`nepali-date-converter`, `lib/nepali-calendar.ts`).
  - Dual Calendar Picker component (`components/admin/dual-calendar-picker.tsx`) showing simultaneous BS year/month/day and AD equivalent.
- **Academic Holiday & Recess Detection**:
  - Auto-identifies gazetted national and institutional holidays.
  - Whole-day suspension banners automatically replace routine grids on recess dates.

### Module 4: Weekly Routine & Timetable Grid (`/schedules`)
- **Sunday–Friday Academic Week Schedule**:
  - Full support for standard Nepali school/college 6-day academic operating cycle.
- **Live "Now" Timeline Beacon**:
  - Highlights ongoing period slot with a pulsating `LIVE` badge and ambient column tint.
- **2-Line Slot Typography Hierarchy**:
  - Line 1: Subject Code & Class Grade/Batch in bold.
  - Line 2: Teacher Name and Micro-Time Slot Badge (zero horizontal truncation).
- **Lab Highlight & Dim Context Filter**:
  - Isolates a specific lab while preserving the broader schedule grid in dimmed background context.
- **Consecutive Period Merging**:
  - Seamless consolidation of two continuous periods into a single extended practical block.

### Module 5: Practical Attendance & Session Logging (`/logs` & `/logs/new`)
- **Interactive Attendance Logging**:
  - Total enrolled strength counter, present students, and automated attendance percentage computation.
- **Skip Protocol**:
  - Standardized reasons for skipped lab slots ("Theory Class in Room", "Exam / Test", "Holiday / Event", "Teacher Absent").
- **Dual Sign-Off Workflow**:
  - Subject Teacher submits log &rarr; Lab In-Charge audits and marks verified with digital verification timestamp.
- **Ad-Hoc Session Dispatching**:
  - Instant ad-hoc session creator for unscheduled makeup classes or emergency practical slots.

### Module 6: Preventive Maintenance Workbench & Workstation Matrix (`/maintenance`)
- **Streamlined 2-Tab Workbench Architecture**:
  - **Tab 1: Routine Tasks & Schedules**: Active maintenance definitions, cadence, last serviced date/technician, next due status badges (`Overdue`, `Due Today`, `Scheduled`), and 1-click **Record Service** or **Postpone**.
  - **Tab 2: Certified Service History & Logbook**: Searchable historical logbook with machine checklists, observations, and printable log sheet.
- **Interactive 40-Workstation Matrix (`WorkstationMatrixSelector`)**:
  - Visual grid of PC desks (`PC-01` to `PC-40` or custom room configurations).
  - 3-State cycling on desk click:
    1. **Pending** (`bg-zinc-100 dark:bg-zinc-900 border-zinc-200`)
    2. **Cleaned & Serviced** (`bg-emerald-500/15 border-emerald-500 text-emerald-600`)
    3. **Flagged Faulty** (`bg-rose-500/15 border-rose-500 text-rose-600` with warning icon)
  - Batch Action Toolbar: `Select All`, `Invert`, `Flag Faults`, `Reset`.
  - Dynamic Grid Customization: Preset jumpers (`30`, `36`, `40`, `48`), custom station identifier injection (e.g. `SRV-01`), and decommissioned PC removal.
  - Automatic remark synthesis: Summarizes inspected machines into certified text (e.g. `PC-01 to PC-40 (All Serviced)`).
- **Institutional Digital Sign-Off Certificate Stamp**:
  - Institutional seal stamp rendered on maintenance log completion.
  - Records technician identity, role badge, timestamp, and audit trail.
- **Zero Pricing Clutter**: Strictly focused on technical compliance (cleaning, thermal paste, BIOS, OS updates, cable routing, glassware safety) without budgetary noise.

### Module 7: Equipment Breakage & Incident Register (`/incidents` & `/records/incidents`)
- **Breakage Intake**: Equipment name, damage type, severity (`minor`, `moderate`, `major_critical`), and photographic/description notes.
- **HOD Escalation Trigger**: High-severity incidents automatically flag for Department Head / Coordinator intervention.
- **Settlement & Repair Drawer**: Lab In-Charge records repairs, replacements, student compensation status, or decommissioning.

### Module 8: Unified Records & Multi-Format Exports (`/records`)
- **Cascading Filter Bar**: Instant search across date ranges, lab rooms, subject codes, faculty, and completion statuses.
- **ExcelJS Export Engine (`lib/exports/xlsx.ts`)**: Generates styled `.xlsx` workbooks with branded headers, alternating row striping, auto-width columns, and compliance metrics.
- **CSV Dataset Export (`lib/exports/csv.ts`)**: Clean raw comma-separated values for school data systems.

### Module 9: High-Fidelity A4 Landscape Print Engine (`/print/*`)
- **Available Print Sheets**:
  - `/print/daily-log`: Daily institutional laboratory sign-off register.
  - `/print/records`: Filtered historical practical session register.
  - `/print/incidents`: Institutional equipment damage and hazard register.
  - `/print/maintenance`: Technical maintenance logbook and servicing certificate.
- **Print Shield Architecture**: `@media print` CSS rules automatically strip sidebars, command palettes, theme toggles, and backgrounds, enforcing a pure white background with crisp black typography and dual signature blocks ("Lab In-Charge" and "HOD / Principal").

### Module 10: Institutional Admin Console & Safety Lock (`/admin`)
- **Tab 1: User Access & Approvals**: Manage registrations, assign roles, reset credentials, and generate temporary passwords.
- **Tab 2: Master Timetable Routine Manager**: Edit weekly schedule periods, map subject codes to faculty, and configure room quotas.
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
  - Specular Sheen: `absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent`.

---

## 6. Project Architecture & Directory Layout

```plaintext
├── app/
│   ├── (auth)/login/page.tsx           # Authentication with OTP & password
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Dashboard layout shell, header & command palette
│   │   ├── page.tsx                    # Main Live Cockpit & Session Feed
│   │   ├── schedules/                  # Timetable Routine Grid (Sun–Fri)
│   │   ├── logs/                       # Practical logs table & new session form
│   │   ├── maintenance/                # Lab Maintenance Workbench
│   │   ├── incidents/                  # Breakage & damage register
│   │   ├── records/                    # Unified audit registers & export center
│   │   ├── admin/                      # Super Admin Console (Users, Routine, SOPs, Settings)
│   │   └── print/                      # A4 Landscape Print Sheets (Daily, Records, Incidents, Maintenance)
│   └── actions/                        # Next.js Server Actions (auth, logs, schedules, maintenance, incidents, records)
├── components/
│   ├── ui/                             # Radix UI + Tailwind primitives (button, card, sliding tabs, etc.)
│   ├── layout/                         # Sidebar, mobile nav, live clock, header search trigger
│   ├── dashboard/                      # Live cockpit, telemetry card, incident registry, syllabus progress
│   ├── maintenance/                    # Workstation matrix selector, log modal, snooze modal, create plan modal
│   ├── records/                        # Practical & incident record tables, filters, drawers
│   ├── admin/                          # User access manager, routine manager, maintenance routines manager
│   └── calendar/                       # Dual calendar picker & academic calendar modal
├── hooks/                              # Reactive state hooks (schedule, user-scope, routine, logs, incident, command-palette)
├── lib/
│   ├── nepali-calendar.ts              # Bikram Sambat (BS) date conversion & formatting
│   ├── permissions.ts                  # Central RBAC capability checker
│   ├── exports/                        # ExcelJS (.xlsx) and CSV export generators
│   └── supabase/                       # Supabase client and server session utilities
└── types/                              # Strict TypeScript data models matching Supabase schema
```

---

## 7. Critical Governance & Developer Guardrails

1. **NO Literal `+` in Button Labels**: Always pair icons with natural text (`<Plus className="h-4 w-4" /> <span>Record Service</span>`), never `<span>+ Record Service</span>`.
2. **Standardized Academic Terminology**:
   - Use **"Attendance"** — never "Turnout".
   - Use **"Timetable"** or **"Schedule Grid"** — never "Matrix" or "Today's Matrix".
   - Use **"Logbook"** — never "Ledger".
   - Use **"Equipment Breakage"** — avoid archaic "Apparatus Breakage".
3. **Safety Lock**: The Super Admin safety switch is named **"Precaution Active"**; retain this label and functionality.
4. **Zero Pricing/Cost Clutter**: Maintenance logs and plans track technical compliance only. No financial fields.
5. **Zero Department Regressions**: Never re-introduce department strings to profiles or tables. Use Role Badges and Facility Scopes.
6. **Strict TypeScript Standards**: All pull requests and edits must pass `npx tsc --noEmit` with **0 errors**.

---

## 7. Automated Institutional Email Notification Engine

### Architecture & Flows
- **Daily Practical Schedule Reminders**: Automated 7:00 AM NPT dispatch (via Vercel Cron `15 1 * * 0-5` UTC, excluding Saturday recess) delivering tailored daily rosters with period times, room/lab assignments, and student tallies to each teacher.
- **Skipped Practical Session Alerts**: Triggered upon session log submission with `status: 'skipped'`, notifying the assigned teacher with the recorded skip reason.
- **Incident & Breakage Broadcasts**: Immediate alerting to Lab In-Charges, Coordinators, and HODs when equipment breakages or damage are reported or escalated.
- **Overdue Preventive Maintenance Scans**: Automated daily scan alerting Lab In-Charges of overdue equipment maintenance checklists.
- **Proactive 48h Holiday Lab Shutdown SOP**: 48h advance notice before institutional closures prompting Lab In-Charges to initiate power-down protocols.
- **New Teacher Registration Alerts**: Real-time alerts to Super Admins and Lab In-Charges when a newly registered faculty member completes email OTP verification and awaits role approval.

### Technical Safeguards & Reliability
1. **Serverless Lifecycle Protection**: All Server Action background notifications use Next.js native `after()` callbacks (`import { after } from 'next/server'`), ensuring SMTP handshakes complete without truncation when responses return to the client.
2. **Connection Pooling & Rate Throttling**: Nodemailer configured with `pool: true`, `maxConnections: 2`, `rateDelta: 1000`, and `rateLimit: 3` (maximum 3 emails/second) to prevent Gmail SMTP `421` concurrency limit and `454` throttling errors.
3. **Strict Route Authorization**: `/api/cron/reminders` validates incoming requests against `process.env.CRON_SECRET` via `Bearer` token and returns `401 Unauthorized` on mismatch.
4. **Anti-Spam Idempotency**: PostgreSQL `public.email_dispatch_logs` table enforces unique constraint `(dispatch_type, recipient_email, reference_date)` to prevent duplicate dispatches within the same cycle.