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

- **Framework**: Next.js (App Router) with React Server Components (RSC) and Server Actions in `app/actions/`.
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
  - Supabase PostgreSQL.
  - Typed schema models in `types/database.ts`.
  - Database access via `@supabase/supabase-js` and server clients in `lib/supabase/server.ts`.
- **Calendar & Dual-Date System**:
  - Gregorian (AD) dates integrated with Bikram Sambat (BS) Nepali calendar (`nepali-date-converter`, `lib/nepali-calendar.ts`, `components/admin/dual-calendar-picker.tsx`).
- **Export & Reporting Engines**:
  - ExcelJS (`lib/exports/xlsx.ts`) for styled `.xlsx` workbooks.
  - CSV export (`lib/exports/csv.ts`).
  - High-fidelity A4 landscape print sheets (`app/(dashboard)/print/*`) with `@media print` shields.

---

## 3. Database Models & Schema Summary

### `profiles`
- Institutional accounts: `id`, `full_name`, `email`, `role`, `approval_status`, `permissions` (JSON), `created_at`.
- Roles: `'super_admin' | 'lab_incharge' | 'hod' | 'teacher'`.
- Statuses: `'pending' | 'approved' | 'rejected'`.
- Note: Legacy `department` has been eliminated from the data model and user profiles. Use **Role Badge & Assigned Lab / Facility Scope**.

### `practical_logs`
- Completed or skipped practical sessions logged by instructors.
- Fields: `session_id`, `lab_id`, `teacher_id`, `subject_code`, `class_grade`, `batch`, `experiment_title`, `topic_learned`, `total_students`, `present_students`, `is_skipped`, `skip_reason`, `remarks`, `incharge_verified`.

### `master_schedules` / `schedules`
- Weekly institutional timetable.
- Fields: `day_of_week` (0=Sunday to 5=Friday), `time_slot`, `period_number`, `lab_id`, `teacher_id`, `subject_code`, `grade_batch`, `is_active`.

### `maintenance_plans`
- Preventive maintenance routine definitions.
- Fields: `title`, `description`, `lab_id`, `cadence` (`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `semester`, `yearly`), `checklist` (`string[]`), `affected_machines` (`string[]`, e.g. `['PC-01', 'PC-02', ...]`), `is_active`, `category` (`hardware`, `software`, `network`, `general`), `created_by`.

### `maintenance_reminders`
- Due date tracking & alert notices for plans.
- Fields: `plan_id`, `due_date`, `snooze_until`, `status` (`pending`, `overdue`, `completed`, `snoozed`).

### `maintenance_logs`
- Historical certified service logbook entries.
- Fields: `plan_id`, `lab_id`, `performed_by`, `performed_at`, `checklist_completed` (`string[]`), `serviced_machines` (`string[]`), `observations`, `next_recommended_date`, `status` (`completed`, `flagged`).

### `lab_incidents`
- Break-fix damage and hazard register.
- Fields: `title`, `lab_id`, `reported_by`, `equipment_name`, `incident_type` (`breakage`, `malfunction`, `burnt_apparatus`, `chemical_hazard`, `missing`, `other`), `severity` (`low`, `medium`, `high`, `critical`), `status` (`reported`, `investigating`, `resolved`, `escalated_to_hod`), `resolution_notes`, `resolved_at`.

---

## 4. Roles & Permissions Architecture (`lib/permissions.ts`)

| Role | Access Level | Primary Focus |
| :--- | :--- | :--- |
| **Super Admin** (`super_admin`) | Full root access | User approvals, role assignment, system reset, timetable configuration, maintenance routines. |
| **Lab Incharge** (`lab_incharge`) | Laboratory operations | Maintenance Workbench (`/maintenance`), incident triage, attendance verification, routine execution. |
| **Head of Dept** (`hod`) | Department oversight | Incident escalations, syllabus progress review, departmental practical audits. |
| **Teacher** (`teacher`) | Instructor access | 1-click practical logging (`/logs/new`), viewing assigned timetable, reporting broken equipment. |

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
- **Redesigned from bloated metrics to a streamlined 2-tab Workbench**:
  - **Tab 1 (Routine Tasks & Schedules)**: Direct list of tasks, target lab, frequency, last serviced date & technician, next due badge, and 1-click **Record Service** / **Postpone**.
  - **Tab 2 (Service History & Logbook)**: Searchable history logbook with machine checklists and printable A4 landscape logbook.
- **Embedded Admin Console (`/admin` Tab 03 &rarr; Maintenance Routines)**:
  - Admin management for routines: active/paused toggles, SOP checklist editor, and 1-click installer for recommended presets (Deep PC cleaning, Thermal paste, BIOS update, Glassware safety inspection).
- **Purged Unnecessary Clutter**: Removed all price/cost fields from routine maintenance to keep the focus purely on technical upkeep and academic operations.

### E. Design System & Modern Typography Overhaul
- **Brand Typography**: Replaced generic fonts with Plus Jakarta Sans (`font-heading`), Inter (`font-sans`), and JetBrains Mono (`font-mono`).
- **Bilingual Devanagari Integration**: Loaded `Noto_Sans_Devanagari` with explicit weights `['400', '500', '600', '700']` and `subsets: ['devanagari']` attached via `--font-devanagari` to heading and sans fallback chains for Bikram Sambat rendering.
- **UI Primitives Refined**:
  - Removed hardcoded `font-mono` from `Badge` base class; added `info` and `indigo` variants.
  - Removed uppercase monospace forcing from `TableHead`.
  - Aligned `Skeleton` radius across all variants to `rounded-xl`.
  - Switched `ThemeToggle` to `variant="outline"`.
  - User menu display upgraded to show Assigned Role & Facility Scope (zero department references).
- **Performance & Compositing**: Stripped `backdrop-blur-xl` from repeated card grids in favor of GPU-friendly layered `.glass-card` styling; reserved backdrop-blur strictly for sticky headers and popover modals.

### F. Layout, Global Search & Deep Obsidian Dark Theme Architecture
- **Exposed Header Command Palette**: Integrated a prominent, interactive search pill (`Search sessions, rooms, faculty... Ctrl K` / `⌘K`) directly in the global dashboard topbar (`components/layout/header-search-trigger.tsx`).
- **Hydration-Safe State Management**: Built `hooks/use-command-palette.ts` using React 19's `useSyncExternalStore` for singleton palette state without window DOM events or memory leaks.
- **Universal Slim Cross-Browser Scrollbars**: Added standard CSS scrollbar properties for Firefox (`scrollbar-width: thin; scrollbar-color: ...`) alongside 6px WebKit scrollbars in `app/globals.css`.
- **Unified PageHeader & Responsive Breadcrumbs**: Standardized page headers across `/records`, `/records/incidents`, and `/maintenance` with responsive mobile truncation (`truncate max-w-[160px]` and intermediate parent hiding).
- **Balanced Dashboard Grid**: Replaced the previous 5-button block with a compact 2-column Quick Operations strip (`Print Report` + `New Log` + `Daily Sheet ↗`), eliminating asymmetric dashboard scrolling.
- **Deep Obsidian & Midnight Slate Dark Theme**:
  - Tokenized semantic scale: Canvas (`#0B0F19`), Surface-1 (`#101726`), Surface-2 (`#151E32`), Surface-3 (`#1A253D`), and hairline borders (`border-white/[0.08]`).
  - Milled chamfer highlight (`inset 0 1px 0 0 rgba(255, 255, 255, 0.06)`) on cards.
  - Tactile form inputs grounded on Surface-2 (`#151E32`) with glowing indigo focus rings and legible placeholders.
  - Scoped micro-glow pips (`0 0 10px 1px`) on telemetry beacons to prevent GPU compositing repaint lag during scrolling.
  - Preserved strict `@media print` white shield across all surface classes.

---

## 6. Critical User Rules & Terminology Standards

Agents working on this repository **MUST** follow these rules without exception:

### 1. NO Literal `+` in Button Labels
- **RULE**: Never put literal `+` inside button or action text (e.g. `<span>+ Record Service</span>` or `<span>+ Quick Book</span>`).
- **Reason**: The UI already uses icons (`<Plus />`, `<Wrench />`, `<UserPlus />`). Adding a literal `+` next to an icon is redundant and sloppy.
- **Correct**: `<Plus className="h-4 w-4" /> <span>Record Service</span>`
- **Incorrect**: `<span>+ Record Service</span>`

### 2. Standardized Academic Terminology
Always use natural school/college terminology:
- Use **"Attendance"** — **NEVER** "Turnout" or "Turnout Tally".
- Use **"Timetable"** or **"Schedule Grid"** — **NEVER** "Matrix" or "Today's Matrix".
- Use **"Logbook"** — **NEVER** "Ledger" (for maintenance and session logs).
- Use **"Save & Submit Log"** — **NEVER** "Endorse" or "Log Done".
- Use **"Equipment Breakage"** — Avoid repetitive/antiquated "Apparatus Breakage" where generic equipment applies.

### 3. Safety Lock: Keep "Precaution Active" Intact
- In the Super Admin console (`/admin`), the safety lock switch that guards sensitive actions (e.g. editing teacher permissions or routines) is called **"Precaution Active"**. The user explicitly confirmed: `"Precaution Active is fine"`. Keep this safety toggle and label as-is.

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
- Large KPI metrics must use `font-heading font-extrabold tabular-nums` for executive punch rather than forcing `font-mono` across entire cards.

### 8. Strict TypeScript Verification
- Always execute `npx tsc --noEmit` before finishing any task to guarantee 0 compile or type errors across all routes and components.
