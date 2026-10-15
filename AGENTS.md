<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LMR (LabSync LIMS) — Institutional Repository Blueprint & Agent Guide

> **Important**: This document is the single source of truth for all AI agents working on this codebase. Read this document before inspecting code or writing changes to avoid re-investigating the architecture from scratch.

---

## 1. Project Goal & Institutional Context

### Primary Persona & Purpose
- **User Role**: Lab In-Charge at an academic institution in Nepal (Secondary / Higher Secondary / College levels — Class 11, Class 12, and undergraduate labs).
- **Core Mission**: Modernize laboratory operations by replacing paper logbooks, manual registers, and scattered Excel sheets with a clean, high-clarity institutional digital system (**LabSync LIMS / LMR**).
- **Dual Core Responsibilities**:
  1. **Academic Practical Operations**: Class 11 & 12 batch schedules (e.g. Science A/B), practical experiment syllabi, roll-call attendance tally, faculty session logging, and dual sign-off (Teacher + Lab In-Charge).
  2. **Laboratory Infrastructure & Maintenance**: Routine preventive care and servicing for Computer Labs (BIOS updates, thermal paste, deep PC cleaning, software/OS installation, cable management) as well as Physics, Chemistry, and Biology laboratories (equipment inspection, glassware check, calibration).

---

## 2. Technical Stack & Architecture

- **Framework**: Next.js 16+ (App Router) with React 19, React Server Components (RSC), and Server Actions in `app/actions/`.
- **Language**: TypeScript (strict mode enabled). Every task **must pass `npx tsc --noEmit` with 0 errors**.
- **Styling & UI**:
  - Tailwind CSS with custom CSS variables (`app/globals.css`).
  - Dark / Light theme support with system toggle. Canvas: Deep Obsidian (`#0B0F19` dark; rich midnight slate surfaces `#101726`, elevated wells `#151E32`) and Pearl Slate (`#F8FAFC` light).
  - Modern Typography Stack:
    - Heading: `Plus Jakarta Sans` (`--font-heading`, `font-heading`).
    - Body/Interface: `Inter` (`--font-sans`, `font-sans`).
    - Bilingual Devanagari Fallback: `Noto Sans Devanagari` (`--font-devanagari`) baked into `--font-heading` and `--font-sans` font families for clean Bikram Sambat rendering.
    - Code/Monospace: `JetBrains Mono` (`--font-mono`, `font-mono`).
  - Radix UI primitives (`@radix-ui/react-*`), Lucide React icons (`lucide-react`).
  - High-performance layered surface `.glass-card` and `.glass-header` (eliminates GPU lag).
  - Global `tabular-nums` for numeric and financial/attendance alignment.
- **Database & Backend**:
  - Supabase PostgreSQL with Direct Connection Pool (`lib/db.ts`).
  - Typed schema models in `types/database.ts`.
  - Database access via `@supabase/supabase-js`, `pg` Pool (`getPgPool`), and server clients in `lib/supabase/server.ts`.
- **Calendar & Dual-Date System**:
  - Gregorian (AD) dates integrated with Bikram Sambat (BS) Nepali calendar (`nepali-date-converter`, `lib/nepali-calendar.ts`, `components/admin/dual-calendar-picker.tsx`).
- **Export & Reporting Engines**:
  - ExcelJS (`lib/exports/xlsx.ts`) for styled `.xlsx` workbooks with official NEB 3-tier signature blocks.
  - CSV export (`lib/exports/csv.ts`).
  - High-fidelity A4 landscape print sheets (`app/(dashboard)/print/*`) with `@media print` shields.

---

## 3. Database Models & Schema Summary

### `profiles`
- Institutional accounts: `id`, `full_name`, `email`, `role`, `approval_status`, `permissions` (JSON), `created_at`.
- Roles: `'super_admin' | 'lab_incharge' | 'hod' | 'teacher'`.
- Statuses: `'pending' | 'approved' | 'rejected'`.
- Note: Legacy `department` has been eliminated from the data model and user profiles. Use **Role Badge & Assigned Lab / Facility Scope**.

### `labs`
- Physical and virtual laboratory facilities.
- Fields: `id`, `name`, `code`, `capacity`, `type` (`computer_lab`, `physics_lab`, `chemistry_lab`, `biology_lab`), `status` (`'Operational' | 'Under Maintenance' | 'Inactive'`), `is_active` (`boolean`), `created_at`.
- Database constraint: `CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'))`.
- Active lifecycle rule: `is_active` is automatically derived (`status === 'Operational'`).

### `academic_years`
- Institutional operational cycles.
- Fields: `id` (e.g. `'2083'`), `name` (e.g. `'2083/84'`), `start_date`, `end_date`, `is_current` (`boolean`), `created_at`.

### `classes`
- Academic grade and stream definitions.
- Fields: `id` (e.g. `'11sci'`, `'12eng'`), `name`, `grade_level` (11 or 12), `stream`, `is_active`, `created_at`.

### `class_subjects`
- Curricular subject mapping per class.
- Fields: `id`, `class_id`, `subject_code`, `subject_name`, `weekly_quota`, `created_at`.

### `students`
- Student biographical records.
- Fields: `id` (UUID), `admission_no`, `registration_no`, `full_name`, `gender`, `is_active`, `archived_at`, `archive_reason`, `created_at`.

### `student_enrollments`
- Academic year cohort enrollment linking students to classes.
- Fields: `id`, `academic_year_id`, `class_id`, `student_id`, `roll_number`, `section`, `status`, `created_at`.
- Constraint: `CHECK (status IN ('active', 'transferred', 'graduated', 'archived', 'completed'))`.

### `workstations`
- Physical laboratory desks and computing nodes.
- Fields: `id`, `lab_id`, `label` (e.g. `'PC-01'`), `pos_x`, `pos_y`, `device_type` (`pc`, `mac`, `server`), `row_label`, `is_active`, `created_at`.
- **Operational Status Invariant**: Operational status is NOT a static column. It is dynamically derived from `workstation_issues` (`in_progress` &rarr; `under_repair`, `open` &rarr; `flagged`, else &rarr; `operational`).

### `floor_elements`
- Architectural floor components for CAD rendering.
- Fields: `id`, `lab_id`, `element_type` (`door`, `window`, `pillar`, `board`, `podium`, `bench`), `label`, `pos_x`, `pos_y`, `width`, `height`, `rotation`.

### `workstation_seat_plans`
- Student-to-workstation assignments per class & academic year.
- Fields: `id`, `lab_id`, `academic_year_id`, `class_id`, `workstation_id`, `enrollment_id`, `notes`, `assigned_by`, `created_at`.

### `workstation_issues`
- Hardware and software fault tickets.
- Fields: `id`, `workstation_id`, `reported_by`, `title`, `description`, `severity` (`low`, `medium`, `high`, `critical`), `status` (`open`, `in_progress`, `resolved`), `resolved_at`, `created_at`.

### `practical_logs`
- Completed or skipped practical sessions logged by instructors.
- Fields: `id`, `schedule_id`, `lab_id`, `teacher_id`, `date`, `period_label`, `subject_name`, `batch_group`, `practical_title`, `total_students`, `present_students`, `absent_students`, `absent_rolls`, `remarks`, `status`, `skip_reason`, `topic_learned`, `logged_by`, `created_at`, `academic_year_id`, `class_subject_id`.
- Note: Verification is stored in `remarks` (e.g., verified stamp) or `logged_by`.

### `schedules`
- Weekly institutional timetable.
- Fields: `id`, `day_of_week` (0=Sunday to 5=Friday), `time_slot`, `slot_id`, `span`, `lab_id`, `teacher_id`, `subject_code`, `subject_title`, `class_grade`, `default_students`, `status`, `created_at`.

### `maintenance_plans`
- Preventive maintenance routine definitions.
- Fields: `id`, `title`, `description`, `lab_id`, `cadence` (`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `semester`, `yearly`), `checklist` (`string[]`), `affected_machines` (`string[]`, e.g. `['PC-01', 'PC-02', ...]`), `category`, `is_active`, `created_by`.

### `maintenance_logs`
- Historical certified service logbook entries.
- Fields: `id`, `plan_id`, `lab_id`, `performed_by`, `performed_at`, `asset_identifier`, `work_performed`, `observations`, `next_recommended_date`, `status`, `created_at`.

### `lab_incidents`
- Equipment breakage and hazard register.
- Fields: `id`, `title`, `lab_id`, `reported_by`, `equipment_name`, `incident_type`, `severity` (`minor`, `moderate`, `major_critical`), `status` (`reported`, `investigating`, `resolved`, `escalated_to_hod`), `resolution_notes`, `resolved_at`.

### `audit_ledger`
- Immutable audit log tracking sensitive changes.
- Fields: `id`, `entity_type`, `entity_id`, `action`, `actor_id`, `before_state` (JSONB), `after_state` (JSONB), `metadata` (JSONB), `created_at`.

---

## 4. Roles & Permissions Architecture (`lib/permissions.ts`)

| Role | Access Level | Primary Focus |
| :--- | :--- | :--- |
| **Super Admin** (`super_admin`) | Full root access | User approvals, role assignment, system reset, timetable configuration, maintenance routines, cohort promotion. |
| **Lab Incharge** (`lab_incharge`) | Laboratory operations | Maintenance Workbench (`/maintenance`), CAD floor plan, workstation triage, attendance verification, routine execution. |
| **Head of Dept** (`hod`) | Department oversight | Incident escalations, syllabus progress review, departmental practical audits, board compliance. |
| **Teacher** (`teacher`) | Instructor access | 1-click practical logging (`/logs/new`), Live Lab Cockpit roll-call, viewing timetable, reporting broken equipment. |

---

## 5. Development History & Key Milestones Completed

### A. Academic Practical Logbook & Routine
- Built interactive session logging (`/logs/new`) with Class 11/12 roll attendance counter and auto-calculated attendance percentage.
- Implemented dual-signoff tracking (Subject Teacher log entry + Lab In-Charge digital audit verification).
- Formatted A4 landscape printable registers (`/print/records`, `/print/daily-log`) and Excel exports.

### B. Timetable Engine & Live Lab Pods
- Interactive Weekly Routine Grid (`/schedules`) supporting Sunday–Friday academic schedules.
- Live Lab Pods on the main dashboard (`/`) displaying real-time occupancy, current ongoing subject, instructor name, and quick session logging.

### C. Incident & Damage Escalation System (`/incidents`)
- Breakage and fault triage workflow with severity levels and HOD escalation triggers.
- Printable incident damage register (`/print/incidents`).

### D. Lab Maintenance Workbench (`/maintenance`)
- Streamlined 2-tab Workbench: Routine Tasks & Schedules vs. Certified Service History Logbook.
- Embedded Admin Console (`/admin` Tab 03 &rarr; Maintenance Routines) with 1-click presets.
- Zero pricing/cost clutter: focus strictly on technical upkeep and academic safety.

### E. Design System & Modern Typography Overhaul
- Brand Typography: Plus Jakarta Sans (`font-heading`), Inter (`font-sans`), and JetBrains Mono (`font-mono`).
- Bilingual Devanagari Integration: Loaded `Noto_Sans_Devanagari` with explicit weights `['400', '500', '600', '700']` and `subsets: ['devanagari']` attached via `--font-devanagari`.
- UI Primitives: High-density `.glass-card` surfaces without GPU-taxing repeated backdrop-blur.

### F. Phase 6: Unified Master Blueprint — Workstation Cockpit Elevation & Institutional Intelligence
- **Track 1: CAD Workstation Floor & Live Cockpit Elevation**:
  - Interactive Viewport (`hooks/use-canvas-viewport.ts`): Clamped zoom ($0.5\times$ to $1.6\times$) with cursor-centered focal scaling, multi-touch pinch, middle-click/space-drag panning, and workstation auto-centering beacon.
  - Floating HUD Controls (`components/computer-lab/canvas-controls-hud.tsx`): 1-tap zoom, fit-to-screen, 1:1 reset, pan mode toggle, and minimap toggle (strictly zero literal `+` labels).
  - Radar Minimap (`components/computer-lab/canvas-minimap-radar.tsx`): 34-node live floor preview with interactive draggable/clickable bounding viewport box.
  - Living LCD Workstation Nodes (`components/maintenance/workstations/workstation-node.tsx`): Chamfered milled bezels, status LEDs, glowing attendance rings, and tactile spring click response.
  - High-Speed Roll-Call Accelerators (`components/computer-lab/live-cockpit-bar.tsx`): Jump-to-Roll auto-pan input, Mark All Present, Invert Attendance, and three-tier semantic status badge.
  - Quick Station Popover (`components/computer-lab/station-quick-popover.tsx`): 1-tap floating attendance flip, Tier 2 seat reassign, and direct fault report ticket creation.
  - Official A4 Wall Seating Chart (`app/(dashboard)/print/seating-chart/page.tsx`): Laminated physical room chart grouped by rows A–D with teacher podium.
- **Track 2: Institutional Reporting, Governance & Operational Intelligence**:
  - Canonical Reporting Engine (`app/actions/institutional-reports.ts`): Zero shadow databases. Direct queries for NEB 75% Board Compliance, syllabus quota completion, faculty dual sign-off ledger, lab occupancy index, and workstation MTTR/uptime analytics.
  - Workstation Technical Biography Drawer (`components/analytics/workstation-biography-drawer.tsx`): Complete lifecycle timeline of faults, servicing history, and past student seatings.
  - Triple-Collision Defense Engine (`lib/scheduling/conflict-engine.ts`): Prevents room, faculty, and student cohort double-booking across weekly academic timetable slots.
  - Immutable Audit Ledger (`lib/audit/audit-ledger.ts`): Structured JSONB before/after diff audit trail for roll-call overrides, session seat swaps, and workstation issue lifecycle changes.
  - Official Board Excel Export (`lib/exports/xlsx.ts`): Styled `.xlsx` workbook generation for NEB Practical Attendance & Board Exam Compliance Register with three-tier institutional signatures.
  - Real-Time Derived Reminders Queue (`getInstitutionalReminders`): Live alerts for critical workstation faults, overdue preventive maintenance, and unverified practical sessions.
  - Multi-Year Academic Lifecycle & Cohort Promotion (`app/actions/academic-years.ts`): Single-query aggregations for enrollment counts, atomic cohort promotions with exceptions (repeaters, archived/left), and database status check constraint enforcement.

---

## 6. Critical User Rules & Terminology Standards

Agents working on this repository **MUST** follow these rules without exception:

### 1. NO Literal `+` in Button Labels
- **RULE**: Never put literal `+` inside button or action text (e.g. `<span>+ Record Service</span>` or `<span>+ Quick Book</span>`).
- **Correct**: `<Plus className="h-4 w-4" /> <span>Record Service</span>`
- **Incorrect**: `<span>+ Record Service</span>`

### 2. Standardized Academic Terminology
- Use **"Attendance"** — **NEVER** "Turnout" or "Turnout Tally".
- Use **"Timetable"** or **"Schedule Grid"** — **NEVER** "Matrix" or "Today's Matrix".
- Use **"Logbook"** — **NEVER** "Ledger" (for maintenance and session logs).
- Use **"Save & Submit Log"** — **NEVER** "Endorse" or "Log Done".
- Use **"Equipment Breakage"** — **NEVER** "Apparatus Breakage".

### 3. Safety Lock: Keep "Precaution Active" Intact
- In the Super Admin console (`/admin`), the safety lock switch that guards sensitive actions (e.g. editing teacher permissions or routines) is called **"Precaution Active"**. Keep this safety toggle and label as-is.

### 4. Zero Pricing/Cost Clutter in Maintenance
- Maintenance plans and service logs are strictly for technical compliance (cleaning, thermal paste, BIOS, updates, hardware checks). Do not re-add financial/budget/pricing fields.

### 5. Zero Department Regressions
- Department strings have been purged from the data model and UI. In user profiles, menus, and lab cards, display **Role Badges** (`super_admin`, `lab_incharge`, `hod`, `teacher`) and **Assigned Lab / Facility Scope**. Never re-add or render `department`.

### 6. Font Loader & CSS Variable Rules
- `Noto_Sans_Devanagari` in Next.js `next/font/google` requires explicit subsets (`subsets: ['devanagari']`) and weights (`weight: ['400', '500', '600', '700']`).
- All 4 font instances must attach their `.variable` classes to `<html className="...">` in `app/layout.tsx`.
- Single Tailwind config: keep `tailwind.config.ts`. Never introduce duplicate `tailwind.config.js` or `.mjs`.

### 7. Performance & Glass Surfaces
- Never apply `backdrop-blur-*` to repeated card grids or list items (causes GPU compositor thrashing on low-end hardware). Use the layered `.glass-card` class instead.
- Reserve backdrop-filter exclusively for single viewport elements like sticky headers (`.glass-header`) or modal dialogs.
- Large KPI metrics must use `font-heading font-extrabold tabular-nums` for executive punch.

### 8. Strict TypeScript Verification
- Always execute `npx tsc --noEmit` before finishing any task to guarantee 0 compile or type errors across all routes and components.

### 9. Semantic Color Palette & Three-Tier Attendance Rules
- **Brand Accent**: Indigo (`--color-accent` / `#6366F1`)
- **Success**: Emerald (`--color-success` / `#10B981`)
- **Warning**: Amber (`--color-warning` / `#F59E0B`) — strictly scoped to items requiring user action (e.g., `Pending Roll-Call`, unlogged past sessions, awaiting review). **NEVER** use amber for nominal attendance.
- **Danger**: Rose (`--color-danger` / `#EF4444`) for critical equipment breakages, major hazards, and critically low attendance.
- **Neutral**: Slate / Zinc scale for all structural text, borders, and nominal states.
- **Attendance Semantic Tiers**:
  - `>= 85%`: Success (Emerald text + emerald badge `Optimal`)
  - `75% - 84%`: Nominal (Neutral slate text + indigo/neutral badge `Normal` — **NO false warning color**)
  - `< 75%`: Danger (Rose text + rose badge `Low Rate`)
  - `0%` / Pending: Neutral dash `—` + neutral badge `Awaiting`

### 10. High-Density Card Pattern: Zero Card-in-Card Nesting
- **No Double-Nesting**: Never wrap individual metric cards inside a parent card container with redundant outer headers or footers.
- **Direct Grid**: Place metric cards directly inside a responsive grid (`grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3`) as standalone top-level `.glass-card` elements.
- **2-Row High-Density Layout (~76px total height)**:
  - Row 1: `h-6 w-6` tinted icon badge + uppercase title (left) | status pill (right).
  - Row 2: Bold punchy metric (`text-xl sm:text-[22px] font-extrabold font-heading`) on left | micro-context / progress bar on right.
  - Padding must remain compact: `p-2.5 sm:p-3`.

### 11. Dashboard Layout Symmetry & Height Alignment
- In the 2-column continuous command center (`lg:grid-cols-12`):
  - Left Column (`lg:col-span-8`): Holds Practical Operations KPI cards, Live Session Cockpit, and Segmented Session Feed.
  - Right Column (`lg:col-span-4`): Holds Quick Operations, Facility Rooms Telemetry, and Incident Registry.
  - Top-Fold Alignment: The left column's 3 KPI cards (~76px) and the right column's `QuickOperationsCard` (~76px) must maintain matching heights.
  - Queue Capping: Default queue lists capped at 4 items (`MAX_UPCOMING_DEFAULT = 4`) with an expandable toggle.

### 12. Universal "Equipment" Standard (Zero "Apparatus")
- The term "Apparatus" is strictly forbidden. Always use **"Equipment"** across all schemas, UI components, modals, filters, and exports.

### 13. Next.js `'use server'` RPC Export Rules
- Files marked with `'use server'` (`app/actions/*`) MUST ONLY export `async function`s.
- Domain constants, types, and synchronous validators belong in pure TypeScript modules in `lib/` (e.g. `lib/lab-status.ts`).

### 14. Lab Facility Status Lifecycle & Server-Side Enforcement
- Allowed Statuses: `'Operational' | 'Under Maintenance' | 'Inactive'` (validated by database constraint `labs_status_check`).
- Derived Active Lifecycle: `is_active = (status === 'Operational')`.
- Server Guard Requirement: Server actions (`createSchedule`, `createPracticalLog`) MUST query PostgreSQL directly and reject attempts to book or log practicals for non-operational labs.

### 15. Incident Category Referential Integrity
- Categories referenced by past incidents must be soft-archived (`is_active = false`) rather than hard-deleted.

### 16. Zero Shadow Databases
- All institutional analytics and reporting MUST query live PostgreSQL tables (`practical_logs`, `schedules`, `workstation_issues`, `student_enrollments`, `students`). Never introduce redundant reporting datastores or caching replicas that drift from operational state.

### 17. Triple-Collision Defense Invariant
- Every timetable slot and ad-hoc live session booking MUST be validated by `detectScheduleCollisions` in `lib/scheduling/conflict-engine.ts` across three independent dimensions:
  1. Room Collision (same lab, overlapping time slot, same day)
  2. Faculty Collision (same teacher, overlapping time slot, same day)
  3. Cohort Collision (same class/grade cohort, overlapping time slot, same day)

### 18. Student Enrollment Status Check Constraints
- In `public.student_enrollments`, the `status` column has a strict check constraint:
  `CHECK (status IN ('active', 'transferred', 'graduated', 'archived', 'completed'))`.
  Never use unapproved statuses (e.g. `'retained'`, `'promoted'`). Use `'active'` for new/repeating enrollments, `'archived'` for completed prior years, and `'transferred'` for departing students.

### 19. Workstation Status Derivation
- `public.workstations` does NOT have a `status` column. Workstation operational state is dynamically derived by inspecting `public.workstation_issues`:
  - `status = 'in_progress'` &rarr; `under_repair`
  - `status = 'open'` &rarr; `flagged`
  - No active issues &rarr; `operational`

### 20. Node.js Test Execution Protocol
- Test suites in `tests/*.test.mjs` must load `.env.local` into `process.env` at initialization so `resolveDatabaseUrl()` connects with SSL enabled.
- Run tests using:
  `node --experimental-strip-types --import ./tests/register-hooks.mjs --test <test_path>`

### 21. Future UI Redesign Initiative (Stitch.google.com)
- When prompted by the user to redesign the UI or modernize components with Stitch (`stitch.google.com`), refer to [doc/plans/REMINDER_UI_REDESIGN_WITH_STITCH_GOOGLE.md](file:///d:/Projects/LMR/doc/plans/REMINDER_UI_REDESIGN_WITH_STITCH_GOOGLE.md) for the target screens, design system tokens, and reapplication workflow.

### 22. Sequential Task Documentation & Pre-flight Review
- **Authoritative Register**: After completing any major feature or architectural task, agents MUST create a sequentially numbered task log in `doc/tasks/` (e.g. `doc/tasks/2026-10-11-task-XX-<title>.md`) and update the master index in [doc/tasks/README.md](file:///d:/Projects/LMR/doc/tasks/README.md).
- **Mandatory Pre-flight Review**: Before starting any new task, agents MUST review [doc/tasks/README.md](file:///d:/Projects/LMR/doc/tasks/README.md) and read relevant task files to preserve established invariants and avoid regressions.

### 23. Institutional Holiday & Weekly Recess Invariant
- **Authoritative Policy Engine**: Laboratory practical operations and attendance tallies are automatically suspended on institutional holidays (e.g., Bada Dashain, Tihar, Constitution Day) as well as statutory Saturday weekends and when the Sunday Week Off Policy is active.
- **Single Source of Truth**: All client views and server actions must validate dates against [lib/calendar-policy.ts](file:///d:/Projects/LMR/lib/calendar-policy.ts) (`evaluateDateSuspension` and `checkServerDateSuspension`).
- **Live Cockpit Invariant**: On suspended dates, `/computer-lab` MUST NOT auto-select routine slots, MUST NOT display roll-call glowing rings or "Save & Submit Practical Log" actions, and MUST display the official **Institutional Recess / Holiday Suspension Card**.
- **Server Guard Requirement**: Both `submitLiveSession` and `createPracticalLog` MUST reject any attempts to submit practical logs on suspended dates.


