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

### `labs`
- Physical and virtual laboratory facilities.
- Fields: `id`, `name`, `code`, `capacity`, `type` (`computer_lab`, `physics_lab`, `chemistry_lab`, `biology_lab`), `status` (`'Operational' | 'Under Maintenance' | 'Inactive'`), `is_active` (`boolean`), `created_at`.
- Database constraint: `CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'))`.
- Active lifecycle rule: `is_active` is automatically derived (`status === 'Operational'`).

### `incident_categories`
- Master incident taxonomy and hazard classifications.
- Fields: `id`, `name`, `severity` (`low`, `medium`, `high`, `critical`), `scope` (`all`, `comp`, `science`), `is_active` (`boolean`), `sla_hours`, `created_at`.
- Referential integrity: Categories with historical incident records must be soft-archived (`is_active: false`) rather than hard-deleted.

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

### G. Enterprise Dashboard Architecture & Semantic Color System Refactor
- **Semantic Color Tokens**: Replaced decorative rainbow accents with a focused semantic palette:
  - Brand Accent: Indigo (`#6366F1`)
  - Success: Emerald (`#10B981`)
  - Warning: Amber (`#F59E0B`, strictly scoped to pending/roll-call backlogs)
  - Danger: Rose (`#EF4444`, critical equipment faults and low attendance)
  - Neutral: Slate / Zinc scale (`text-zinc-950 dark:text-slate-100`, muted `text-zinc-500 dark:text-slate-400`)
- **Three-Tier Attendance Semantic Logic**:
  - `>= 85%`: Optimal / Success (Emerald `#10B981`)
  - `75% - 84%`: Normal / Nominal (Neutral Slate/Zinc — clean, readable text with zero false alarm)
  - `< 75%`: Low Rate / Danger (Rose `#EF4444`)
  - `0%` / Roll-call pending: Neutral dash (`—`) with muted status badge ("Awaiting")
- **Standalone High-Density KPI Cards (Zero Card-in-Card Nesting)**:
  - Stripped outer parent containers, outer headers, and bottom footers to reduce vertical bloat by **~55%** (from ~170px to ~76px).
  - 3 standalone `.glass-card` elements in a `grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3`:
    - Row 1: Compact `h-6 w-6` tinted icon badge + uppercase title on left; semantic status pill on right.
    - Row 2: Punchy bold metric (`text-xl sm:text-[22px] font-extrabold font-heading`) on left; secondary context / micro-progress bar on right.
- **1:1 Level Height Alignment**: Synchronized the left column's KPI row and right column's `QuickOperationsCard` to an identical ~76px height for surgical horizontal alignment.
- **Queue Capping Standard**: Upcoming session queue capped at 4 items (`MAX_UPCOMING_DEFAULT = 4`) with smooth on-demand collapse/expand controls.
- **Universal Equipment Terminology Overhaul**: Completely purged archaic "Apparatus" terminology across incident reports, session modals, registers, exports, drawers, and database tables in favor of modern "Equipment" (e.g. `Lab Equipment / Workstation`).

### H. Super Admin Console Governance, Lab Status Lifecycle & Server Action Hardening
- **Lab Facility Status Architecture**:
  - Added `status text NOT NULL DEFAULT 'Operational' CHECK (status IN ('Operational', 'Under Maintenance', 'Inactive'))` to PostgreSQL `public.labs`.
  - Derived lifecycle: `is_active` is automatically derived (`status === 'Operational'`).
  - Real-time synchronization: Subscribed `useInfrastructureState` to Supabase Realtime channel for `labs` and broadcast bus (`broadcastSync`), ensuring immediate updates across tabs without page reloads.
  - Telemetry: Added dynamic amber maintenance badge with `<Wrench />` icon on both Admin Facility table and main Dashboard facility pods. Replaced "Book Lab Slot" with "Servicing In Progress / Booking Suspended" when non-operational.
- **Defense-in-Depth Server-Side Booking & Log Guards**:
  - Hardened `createSchedule` and `createPracticalLog` to query live lab status directly from PostgreSQL before writing rows.
  - Server actions reject any booking or practical session logging if target lab is `Under Maintenance` or `Inactive`.
- **Incident Taxonomy Governance**:
  - Built `IncidentCategoriesManager.tsx` with full CRUD, search query filtering, laboratory scope tags, severity pills, and official defaults reset.
  - Enforced referential integrity: categories referenced by existing incidents are safely archived (`is_active = false`) instead of hard-deleted to protect historical logbooks.
- **Next.js Server Actions Compilation Hardening**:
  - Enforced strict `'use server'` rules: server action files (`app/actions/*`) must strictly export `async function`s.
  - Relocated domain constants (`VALID_LAB_STATUSES`) and synchronous validators (`validateLabStatus`, `deriveLabIsActive`) into pure TypeScript modules (`lib/lab-status.ts`).

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
- Use **"Equipment Breakage"** — **NEVER** "Apparatus Breakage" (see Rule 12).

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

### 9. Semantic Color Palette & Three-Tier Attendance Rules
- **Brand Accent**: Indigo (`--color-accent` / `#6366F1`) for primary actions, links, and brand focal points.
- **Success**: Emerald (`--color-success` / `#10B981`) for completed sessions, active operations, and optimal attendance.
- **Warning**: Amber (`--color-warning` / `#F59E0B`) — strictly scoped to items requiring user action (e.g., `Pending Roll-Call`, unlogged past sessions, awaiting review). **NEVER** use amber as an arbitrary decorative accent or for nominal attendance.
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
  - **Row 1**: `h-6 w-6` tinted icon badge + uppercase title (left) | status pill (right).
  - **Row 2**: Bold punchy metric (`text-xl sm:text-[22px] font-extrabold font-heading`) on left | micro-context / progress bar on right.
  - Padding must remain compact: `p-2.5 sm:p-3`.

### 11. Dashboard Layout Symmetry & Height Alignment
- In the 2-column continuous command center (`lg:grid-cols-12`):
  - **Left Column** (`lg:col-span-8`): Holds Practical Operations KPI cards, Live Session Cockpit, and Segmented Session Feed.
  - **Right Column** (`lg:col-span-4`): Holds Quick Operations, Facility Rooms Telemetry, and Incident Registry.
  - **Top-Fold Alignment**: The left column's 3 KPI cards (~76px) and the right column's `QuickOperationsCard` (~76px) must maintain matching heights to create a level, symmetric horizontal fold on desktop viewports.
  - **Queue Capping**: Default queue lists must be capped at 4 items (`MAX_UPCOMING_DEFAULT = 4`) with an expandable toggle to prevent uneven vertical scrolling.

### 12. Universal "Equipment" Standard (Zero "Apparatus")
- The term **"Apparatus"** is strictly forbidden. It is an archaic 19th-century academic term unsuited for modern multi-disciplinary institutions with Computer, Physics, Chemistry, and Biology labs.
- Always use **"Equipment"** across all schemas, UI components, modals, filters, and exports:
  - Use `Lab Equipment / Workstation` (never `Apparatus / Station Equipment`).
  - Use `Equipment Breakage` (never `Apparatus Breakage`).
  - Use `Equipment & Circumstances` (never `Apparatus & Circumstances`).
  - Use `equipment_name` and "equipment name" in placeholders.

### 13. Next.js `'use server'` RPC Export Rules (Zero Object/Constant Exports)
- **RULE**: Files marked with `'use server'` (`app/actions/*`) MUST ONLY export `async function`s.
- **Reason**: Next.js App Router treats `'use server'` files as Remote Procedure Call (RPC) endpoints. Exporting objects, arrays, constants, enums, or synchronous helper functions triggers Next.js compilation/runtime fatal error: `A "use server" file can only export async functions, found object`.
- **Enforcement**: Place all domain constants (e.g. `VALID_LAB_STATUSES`), types, and synchronous validators in non-`'use server'` files inside `lib/` (e.g. `lib/lab-status.ts`). In server actions, only import them internally or re-export them strictly as TypeScript types (`export type { ... }`).
- **React `cache` in Server Actions**: Do NOT wrap server action exports in `cache(...)` from `'react'`. React's `cache` is designed for Server Components, not Server Action RPC endpoints. Use explicit in-memory maps or Next.js `revalidatePath` / `unstable_cache`.

### 14. Lab Facility Status Lifecycle & Server-Side Enforcement
- **Allowed Statuses**: `'Operational' | 'Under Maintenance' | 'Inactive'` (validated by database constraint `labs_status_check`).
- **Derived Active Lifecycle**: `is_active` must always be derived from status: `is_active = (status === 'Operational')`.
- **UI State**: When a lab is `Under Maintenance`, UI must display an amber badge with a `<Wrench />` icon, and booking buttons must show "Servicing In Progress / Booking Suspended".
- **Server Guard Requirement**: Client-side disabled buttons are not enough. Server actions (`createSchedule`, `createPracticalLog`) MUST query PostgreSQL directly and reject attempts to book or log practicals for labs marked `Under Maintenance` or `Inactive`.

### 15. Incident Category Referential Integrity
- **Protection**: Deleting an incident category must check if past incident records are linked to it.
- **Soft-Archive**: If referenced by existing records, soft-delete it (`is_active: false`) to preserve historical incident registries and print sheets. Only unreferenced categories may be permanently removed.


