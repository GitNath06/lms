# LabSync LIMS (LMR) — System Architecture & Agent Onboarding Guide

> **Welcome to LabSync LIMS / LMR!**
> This document is designed for incoming AI agents and software engineers to get up to speed within 2 minutes. It outlines the architectural patterns, directory structure, data flows, and critical developer invariants of this repository.

---

## 1. Quick Orientation

- **What is it?** LabSync is an enterprise Laboratory Information & Management System built for academic colleges and higher secondary institutions (Classes 11 & 12, undergraduate science and computer labs in Nepal).
- **Primary Users**:
  - **Lab In-Charge**: Operations manager, technician, and audit verifier.
  - **Instructors / Teachers**: Log practical sessions, conduct CAD floor roll-call, report faulty equipment.
  - **Department Heads (HOD)**: Syllabus audit, incident escalation, and board compliance review.
  - **Super Admin**: System governance, user approvals, master timetable, and cohort promotion.
- **Key Value Drivers**:
  1. Paperless session logbooks with dual digital sign-offs.
  2. Interactive CAD floor plan with pan/zoom viewport and workstation lifecycle tracking.
  3. Preventive maintenance scheduling with interactive PC matrix inspection.
  4. Canonical institutional analytics (NEB 75% practical compliance, syllabus quotas, MTTR, occupancy).
  5. Official NEB Board exam exports (styled `.xlsx`), CSVs, and A4 landscape printable registers.

---

## 2. Tech Stack at a Glance

| Technology | Role | Implementation |
| :--- | :--- | :--- |
| **Next.js 16+** | Fullstack Framework | App Router, React Server Components (RSC), and Server Actions in `app/actions/`. |
| **React 19** | UI Library | Concurrent features, `useSyncExternalStore` for global command palette, zero hydration lag. |
| **TypeScript** | Type Safety | Strict mode enabled. **0 errors required on `npx tsc --noEmit`**. |
| **Tailwind CSS** | Styling | Deep Obsidian / Midnight Slate dark mode (`#0B0F19`, `#101726`), Pearl Slate light mode (`#F8FAFC`). Layered `.glass-card` surfaces (no repeated GPU backdrop-blur). |
| **Supabase PostgreSQL** | Primary Database | Direct connection pool via `pg` (`lib/db.ts`) with Supabase client fallbacks (`lib/supabase/`). |
| **ExcelJS** | Spreadsheet Engine | Styled `.xlsx` workbooks with official 3-tier signature blocks (`lib/exports/xlsx.ts`). |
| **Nepali Date Engine** | Dual Calendar | Simultaneous Gregorian (AD) and Bikram Sambat (BS) date conversion (`lib/nepali-calendar.ts`). |

---

## 3. Directory Map & Code Organization

```
d:/Projects/LMR/
├── app/
│   ├── (auth)/                  # Login, registration, OTP routes
│   ├── (dashboard)/             # Main protected application layout
│   │   ├── page.tsx             # Live Operational Command Center (KPIs, Cockpit, Session Queue)
│   │   ├── analytics/           # Canonical Institutional Analytics & Board Compliance (/analytics)
│   │   ├── computer-lab/        # Interactive CAD Floor Plan & Workstation Cockpit (/computer-lab)
│   │   ├── schedules/           # Weekly Routine Timetable Grid (/schedules)
│   │   ├── maintenance/         # 2-Tab Maintenance Workbench (/maintenance)
│   │   ├── records/             # Practical Session & Incident Registers
│   │   ├── admin/               # Super Admin Governance Console (/admin)
│   │   └── print/               # High-Fidelity A4 Landscape Print Sheets (/print/*)
│   ├── actions/                 # Next.js Server Actions ('use server' async functions ONLY)
│   │   ├── institutional-reports.ts  # Canonical report aggregations (zero shadow DB)
│   │   ├── academic-years.ts         # Multi-year enrollment & atomic cohort promotion
│   │   ├── computer-lab-seating.ts   # Workstation seating assignments & roll-call
│   │   ├── schedules.ts              # Timetable management & conflict checks
│   │   ├── practical-logs.ts         # Session logging & dual sign-off
│   │   └── maintenance.ts            # Routine execution & service history
│   └── globals.css              # Obsidian theme tokens, glass surfaces, print shields
├── components/
│   ├── analytics/               # Tabs: Compliance, Syllabus, Faculty, Occupancy, Workstations, Drawer
│   ├── computer-lab/            # CAD Viewport, Minimap Radar, HUD Controls, Live Cockpit Bar, Popover
│   ├── maintenance/             # Workstations matrix, SOP checklists, service drawers
│   ├── layout/                  # SidebarNav, GlobalHeader, HeaderSearchTrigger (Command Palette)
│   └── ui/                      # Base Radix primitives (Button, Dialog, Badge, Input, Tabs, etc.)
├── hooks/
│   ├── use-canvas-viewport.ts   # Clamped pan/zoom viewport math with auto-centering
│   ├── use-command-palette.ts   # Hydration-safe singleton state with useSyncExternalStore
│   └── use-user-scope.ts        # Scoped user profile & permissions hook
├── lib/
│   ├── scheduling/
│   │   └── conflict-engine.ts   # Triple-Collision Defense Engine (Room, Faculty, Cohort)
│   ├── audit/
│   │   └── audit-ledger.ts      # Immutable structured JSONB diff ledger
│   ├── exports/
│   │   ├── xlsx.ts              # Styled Excel workbook generator (NEB signature blocks)
│   │   └── csv.ts               # Raw CSV table export
│   ├── nepali-calendar.ts       # Bikram Sambat (BS) date engine
│   ├── permissions.ts           # Role-based access control rules
│   ├── lab-status.ts            # Lab facility status lifecycle & validators
│   └── db.ts                    # PostgreSQL pool connection resolver
├── tests/                       # Automated test suites (Node.js native test runner)
│   ├── phase6-cockpit-elevation.test.mjs
│   ├── phase6-canonical-reporting.test.mjs
│   ├── phase6-conflicts-and-audit.test.mjs
│   └── register-hooks.mjs       # Module loader hooks for ts/tsx
├── AGENTS.md                    # Single source of truth for AI agents (Rules & Schema)
└── PRD.md                       # Comprehensive Product Requirements Document
```

---

## 4. Key Domain Relationships & Core Flows

### A. Academic Operations Pipeline
```
[Academic Year: 2083]
       │
       ▼
[Class: 11sci] ──> [Student Enrollment] ──> [Seat Plan] ──> [Workstation: PC-01]
       │                                                          │
       ▼                                                          ▼
[Timetable Slot] ─────────────────────────────────────────> [Live CAD Cockpit]
       │                                                          │
       ▼                                                          ▼
[Practical Session] <── [Triple-Collision Engine Guard]    [Roll-Call Accelerators]
       │                                                          │
       ▼                                                          ▼
[Practical Log Entry] ──> [Dual Sign-Off: Teacher + In-Charge] ──> [Board Compliance Report]
```

### B. Workstation Lifecycle & Maintenance Flow
```
[Workstation: PC-01]
       │
       ├─ If workstation_issues has status 'in_progress' ──> Status: 'under_repair' (Amber)
       ├─ If workstation_issues has status 'open'        ──> Status: 'flagged' (Rose)
       └─ If no active issues                            ──> Status: 'operational' (Emerald)
       │
       ▼
[Maintenance Plan: Monthly Deep PC Clean] ──> [Workstation Matrix Inspection]
       │
       ▼
[Service Log Completed] ──> [Workstation Event Logged] ──> [PC Biography Timeline]
```

---

## 5. Critical Engineering Invariants & Gotchas

> **READ THIS BEFORE CODING**: Violating these invariants will cause build errors, test failures, or UX inconsistencies.

### 1. Zero Shadow Databases
- **Rule**: Never create auxiliary tables or external caching layers for reports and metrics.
- **Why**: Operational integrity requires that metrics reflect real-time ground truth.
- **How**: All institutional reports in `app/actions/institutional-reports.ts` run canonical PostgreSQL queries directly against `practical_logs`, `schedules`, `workstations`, `workstation_issues`, and `student_enrollments`.

### 2. Workstation Status is NOT a Column
- **Trap**: `SELECT status FROM workstations` will fail. The `workstations` table does not have a `status` column.
- **Fix**: Workstation status is dynamically derived by inspecting `workstation_issues`:
  - `status = 'in_progress'` &rarr; `under_repair`
  - `status = 'open'` &rarr; `flagged`
  - Otherwise &rarr; `operational`

### 3. Practical Log Verification Invariant
- **Trap**: `verification_remarks` does NOT exist in `practical_logs`.
- **Fix**: Session verification is tracked via `remarks ILIKE '%verified%'` or checking whether `logged_by` / `remarks` is present.

### 4. Student Enrollment Status Check Constraints
- **Trap**: Trying to set `status = 'promoted'` or `status = 'retained'` in `student_enrollments` will trigger a database constraint violation.
- **Allowed Values**: `'active' | 'transferred' | 'graduated' | 'archived' | 'completed'`.

### 5. Next.js `'use server'` Export Rules
- **Trap**: Exporting objects, arrays, constants, enums, or synchronous helper functions from files in `app/actions/*` triggers fatal Next.js runtime compilation error:
  `A "use server" file can only export async functions, found object`.
- **Fix**: Put domain constants, enums, and synchronous validators in `lib/` (e.g., `lib/lab-status.ts`). In server action files, only export `async function`s or TypeScript types (`export type { ... }`).

### 6. NO Literal `+` in Button Labels
- **Trap**: Adding `<span>+ Record Service</span>` or `<span>+ Quick Book</span>`.
- **Fix**: Use icons without duplicate literal text: `<Plus className="h-4 w-4" /> <span>Record Service</span>`.

### 7. Standardized Academic Terminology
- Use **"Attendance"** — NEVER "Turnout".
- Use **"Timetable"** or **"Schedule Grid"** — NEVER "Matrix" (except for the 40-workstation physical grid).
- Use **"Logbook"** — NEVER "Ledger" (for maintenance and session logs).
- Use **"Equipment"** — NEVER "Apparatus".

### 8. High-Density Card Standards (Zero Card-in-Card Nesting)
- Top-level KPI cards must be standalone `.glass-card` elements in a direct grid (`grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3`) with compact padding (`p-2.5 sm:p-3`) and ~76px height to maintain 1:1 level height alignment with the right column's `QuickOperationsCard`.

---

## 6. Verification & Testing Playbook

When making changes, always execute the following checks before finishing your task:

### A. TypeScript Type Check
```bash
npx tsc --noEmit
```
*Expected: 0 errors.*

### B. Automated Test Suites
Run individual Phase 6 test suites or the entire suite via Node.js native test runner:
```bash
# Cockpit elevation & CAD viewport
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-cockpit-elevation.test.mjs

# Canonical reporting engine
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-canonical-reporting.test.mjs

# Triple collision & audit ledger
node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs

# Full project test runner
npm test
```

### C. Production Build
```bash
npm run build
```
*Expected: Successful compilation of all routes and server actions.*
