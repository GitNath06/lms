# Full-System Production Readiness & Gap Analysis: Prototype to Production Master Blueprint

> **Document**: `doc/audits/2026-10-18-full-system-gap-analysis-and-production-roadmap.md`  
> **Author**: Antigravity Core AI  
> **Target System**: LabSync LIMS / LMR  
> **Scope**: Complete Codebase Audit — Eliminating Mocks, Normalizing Relational Schema, Unifying Admin Console, Hardening Security & RBAC, Mobile-First Viewport Optimization, and Compiler-Driven Verification  
> **Date**: October 18, 2026  

---

## 1. Executive Forensic Disclosure: The Initial Audit vs. Full-System Reality

### 1.1 The Honest Reality Check
The previous document (`doc/audits/2026-10-18-production-readiness-and-mock-data-audit.md`) diagnosed the **immediate symptoms** visible in the user's screenshots:
1. Duplicate and unapproved teacher accounts leaking into dropdowns.
2. The subject filter in `/records` being capped at 11 hardcoded subjects instead of 29.
3. Dummy routine teachers (`COMP12-Teacher`, `CN12-Teacher`) in timetable filters.
4. Timetable dual-state caching between `localStorage` and `public.schedules`.

**Pausing before executing that initial plan was 100% the right call.**  
If we had executed only that 5-phase plan, the system would have remained in a "half-hardcoded" state: the 4 screenshot bugs would be resolved, but **6 other critical operational modules would remain tethered to prototype arrays and JSON blobs**:
- Bell and period timings would still be hardcoded in the live clock detector and navbar.
- Incident categories would remain in a split universe (part in PostgreSQL `issue_categories`, part in `institution_settings` JSON).
- Maintenance routines would not be fully reconciled with PostgreSQL `maintenance_plans`.
- Academic session labels (`2083/84`) would fail to dynamically switch upon cohort promotion.
- Mutating server actions lacked exhaustive role guards.
- Modals on mobile phones would cut off submit buttons below the mobile browser address bar (`100vh` vs `100dvh`).

This document provides the **authoritative, exhaustive system audit** across all 5 missing areas and outlines the definitive roadmap to take LabSync LIMS from a development prototype to an institutional-grade production product.

---

## 2. Forensic Analysis of the 5 Hidden Trap Areas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE SHADOW PROTOTYPE UNIVERSE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  lib/master-data.ts                  hooks/use-infrastructure-state.ts      │
│  - MASTER_TIME_SLOTS (10 slots)      - localStorage: 'lmr_admin_periods_v2' │
│  - DEFAULT_SUBJECTS (11 items)       - localStorage: 'lmr_admin_classes_v2' │
│  - DEFAULT_CLASSES (6 batches)       - localStorage: 'lmr_admin_faculty_v2' │
│  - MASTER_ROUTINE (50 dummy items)   - localStorage: 'lmr_admin_subjects_v2'│
│  - INITIAL_FACULTY (5 mock items)    - JSON: 'infrastructure_periods'       │
│  - LAB_ROOMS (5 static rooms)        - JSON: 'infrastructure_subjects'      │
│  - DEFAULT_INCIDENT_CATEGORIES (6)   - JSON: 'infrastructure_classes'       │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                          SEVER & MIGRATE VIA TS COMPILER
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CANONICAL POSTGRESQL SINGLE SOURCE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  public.profiles (Approved faculty with role guards)                        │
│  public.subjects (29 active curriculum subjects)                           │
│  public.classes (9 grade batches: 11 & 12 streams)                          │
│  public.class_subjects (31 active junction mappings with teacher UUIDs)     │
│  public.schedules (Timetable slots linked to subject and teacher UUIDs)    │
│  public.issue_categories (10 active hardware/software fault categories)     │
│  public.maintenance_plans & maintenance_logs (Preventive care logbook)     │
│  public.academic_years (Multi-year operational cycles: 2083, 2084)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Area 1: Complete Usage Map of `master-data.ts` & Shadow JSON Blobs

A forensic scan of the entire codebase revealed where prototype mocks are secretly consumed:

| Prototype Identifier | Where Defined | Secret Consumers in Active Code | What Breaks in Production |
| :--- | :--- | :--- | :--- |
| `MASTER_TIME_SLOTS` | `lib/master-data.ts` | `hooks/use-live-schedule.ts`, `components/layout/live-clock-header.tsx`, `components/admin/routine-manager.tsx`, `app/(dashboard)/page.tsx`, `components/schedules/session-action-modal.tsx` | When school shifts between Summer and Winter timings, the navbar period beacon (`PERIOD 5`), live session detector, and routine grid remain stuck on hardcoded minutes. |
| `DEFAULT_SUBJECTS` (11 items) | `lib/master-data.ts` | `hooks/use-infrastructure-state.ts`, `components/records/practical-filter-bar.tsx`, `components/schedules/session-action-modal.tsx` | Filter dropdowns truncate 18 of the school's 29 subjects. |
| `DEFAULT_CLASSES` | `lib/master-data.ts` | `hooks/use-infrastructure-state.ts`, `app/(dashboard)/admin/page.tsx` | Newly created batches in `/admin` don't propagate to timetable slot creators. |
| `INITIAL_FACULTY` | `hooks/use-infrastructure-state.ts` | `useInfrastructureState` fallback state | Legacy dummy faculty IDs (`t1` to `t5`) leak into session modals. |
| `MASTER_ROUTINE` (COMP12-Teacher) | `lib/master-data.ts` | `app/(dashboard)/schedules/page.tsx`, `hooks/use-live-schedule.ts`, `components/schedules/session-action-modal.tsx` | Dummy strings populate teacher filter options; live schedule calculates ongoing sessions from fake data. |
| `DEFAULT_INCIDENT_CATEGORIES` | `hooks/use-infrastructure-state.ts` | `components/admin/incident-categories-manager.tsx`, `institution_settings` key `infrastructure_incident_categories` | Split universe: PC faults use PostgreSQL `issue_categories` (10 rows), while lab damage uses JSON blob (6 items). |
| `academic_years: '2083'` hardcoded | Multiple files | `app/actions/classes.ts`, `components/schedules/timetable-grid.tsx`, `hooks/use-routine-state.ts` | System does not smoothly advance to `2084/85` when the current academic year changes in the database. |

---

### Area 2: Relational Junctions (`public.class_subjects`) & Soft-Deactivation

#### The Danger of Missing the Junction Table
In academic laboratories, a subject does not exist in a vacuum. A subject like "Computer Science" is taught to **Class 12 Science** by **Teacher A**, but to **Class 11 Science** by **Teacher B**.
- In PostgreSQL, this is modeled by `public.class_subjects`:
  - `id`: UUID (Primary Key)
  - `class_id`: `text` (Foreign Key &rarr; `public.classes.id`, e.g. `'12eng'`)
  - `subject_code`: `text` (Foreign Key &rarr; `public.subjects.code`, e.g. `'COMP-12'`)
  - `subject_name`: `text`
  - `weekly_quota`: `integer`
  - `teacher_id`: `uuid` (Foreign Key &rarr; `public.profiles.id`)
- **Current Database Status**: `public.class_subjects` contains **31 active relational rows**.
- **The Hazard**: The Admin Console previously edited subjects as flat objects without managing class assignments. When an admin created a subject, it was never mapped to classes in `class_subjects`, causing session logging and timetable creation to fail or fall back to defaults.
- **Foreign Key Protection Rule**: Never execute hard `DELETE FROM public.subjects` or `public.classes`. Existing practical logs (`practical_logs.class_subject_id`) and timetable entries (`schedules.subject_code`) reference them. All deletions must be **soft deactivations** (`UPDATE public.subjects SET is_active = false`).

---

### Area 3: Real Security & RBAC Audit

#### The 3 Vulnerability Vectors Checked

1. **Unprotected Server Actions (`app/actions/*.ts`)**:
   - Next.js Server Actions are public HTTP endpoints callable by anyone who knows the action ID.
   - `middleware.ts` intentionally passes Server Action requests (`request.headers.has('next-action')`) through so they can handle granular authorization.
   - **Requirement**: Every mutating Server Action (`create*`, `update*`, `delete*`, `deactivate*`) MUST call:
     ```typescript
     const scope = await getServerUserScope()
     if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
       throw new Error('Unauthorized: Administrative role required.')
     }
     ```
   - Incomplete guards found: `app/actions/classes.ts` had no mutation actions at all; `app/actions/settings.ts` allowed any `isPrivileged` user (including non-admin teachers with custom permissions) to overwrite period timings.

2. **Route Middleware (`middleware.ts`)**:
   - `/admin` is guarded (`role === 'super_admin'`).
   - `/maintenance` was **not guarded** in middleware, allowing unapproved teachers to view maintenance workbench routes.

3. **Supabase Direct Connection Pool (`getPgPool()`)**:
   - Because `lib/db.ts` uses direct PostgreSQL connections via `pg.Pool`, PostgreSQL Row Level Security (RLS) is bypassed at the database driver level.
   - **Architectural Consequence**: TypeScript code is the **sole security barrier**. Every single server action query that modifies records must explicitly validate the caller's `role` and `id`.

---

### Area 4: Mobile Shell, Drawers & Viewport Audit ($375\text{px}$)

Teachers in laboratory sessions use smartphones (iOS Safari, Android Chrome). Four severe mobile viewport traps were identified:

1. **Top Navbar Viewport Crushing**:
   - The top header (`app/(dashboard)/layout.tsx`) renders: Mobile Nav + Period 5 Badge + Live Clock + Nepali Date + Search Trigger + Cloud Sync + Notification Bell + Theme Toggle + User Avatar.
   - On a $375\text{px}$ iPhone screen, having all items expanded causes the header to overflow horizontally, pushing the entire page layout off-center.
   - **Remedy**: On viewports $<640\text{px}$, condense the header into: Hamburger Mobile Nav + Active Period Badge + Compact Clock icon + User Avatar. Hide secondary indicators behind the mobile drawer.

2. **The `100vh` vs. `100dvh` Mobile Modal Clipping Trap**:
   - Modals styled with `max-h-[90vh]` or `max-h-[85vh]` calculate height against the full screen, ignoring the mobile browser's bottom URL bar and toolbar (an extra $60\text{px}-80\text{px}$).
   - As a result, critical bottom action buttons ("Save & Submit Practical Log", "Confirm Booking", "Report Fault") are rendered underneath the browser address bar, making them unreachable.
   - **Remedy**: Use `max-h-[calc(100dvh-2rem)]` with `flex flex-col` and `overflow-y-auto` bodies for all dialogs and drawers.

3. **Thumb-Friendly Live Attendance on Mobile**:
   - On desktop, `/computer-lab` uses an interactive CAD floor canvas.
   - On mobile phones ($360\text{px}-430\text{px}$), panning a 34-node floor plan is cumbersome. The mobile experience must feature a **1-tap Student List Mode** with large green (Present) and red (Absent) pill buttons sized $\ge 44\text{px}$ for one-handed thumb logging.

4. **Incident Photo Upload on Mobile**:
   - Avoid hardcoded `capture="environment"`, which forces the rear camera and crashes on devices with restricted permissions. Allow users to choose between live camera capture and gallery photo selection.

---

### Area 5: Compiler-Driven Verification (Zero Random Clicking)

#### The "Delete the Mock File & Let TypeScript Scream" Protocol
Manual clicking across 30+ pages cannot guarantee that all shadow states are eliminated. Instead, we use **compiler-enforced verification**:

1. Once an entity (e.g. `DEFAULT_SUBJECTS`) is rewired to PostgreSQL:
   - Comment out or remove `DEFAULT_SUBJECTS` from `lib/master-data.ts`.
   - Run `npx tsc --noEmit`.
   - The TypeScript compiler will instantly locate every single component, action, or hook that still imports the mock array.
   - We fix every compiler error by pointing the code to the canonical PostgreSQL action.
   - When `npx tsc --noEmit` returns **0 errors with the mock export deleted**, we have mathematical certainty that no hidden fallback remains.

#### The 3-Pipeline Entity Lifecycle Trace Matrix

Instead of random page clicking, verification follows three comprehensive end-to-end data pipelines:

```
PIPELINE 1: Master Configuration Pipeline
Admin creates Subject + Class + Assigns Teacher in /admin
  ──► Verified in PostgreSQL (public.subjects, public.classes, public.class_subjects)
  ──► Instant appearance in /schedules (Timetable Slot Creator)
  ──► Instant appearance in /records/new (Practical Session Logger)
  ──► Instant appearance in /incidents (Equipment Fault Reporter)

PIPELINE 2: Teacher Live Practical Pipeline (Simulated Mobile 375px)
Teacher opens /computer-lab on phone during active period
  ──► Auto-detects Period from database bell schedule
  ──► 1-tap marks 1 student absent + flags PC-04 as faulty
  ──► Submits practical log with dual-signoff stamp
  ──► Verified in public.practical_logs & public.workstation_issues

PIPELINE 3: Laboratory Triage & Board Compliance Pipeline
Lab In-Charge opens /maintenance workbench
  ──► Sees flagged PC-04 in Hardware Diagnostics Hub
  ──► Records service log & resolves fault ticket
  ──► Verifies attendance in /records
  ──► Exports official NEB 3-tier signature Excel workbook & A4 print sheet
```

---

## 3. Systematic 5-Phase Implementation Blueprint

### Phase 1: Canonical Database Actions & Relational Architecture
1. **Create `app/actions/subjects.ts`**:
   - `getSubjectsAction(filter?: { activeOnly?: boolean; labId?: string })` querying `public.subjects`.
   - `createSubjectAction(data)` with RBAC guard (`super_admin` only) and `revalidatePath`.
   - `updateSubjectAction(id, data)` with RBAC guard and `revalidatePath`.
   - `deactivateSubjectAction(id)` with soft-deactivation (`is_active = false`) and foreign key reference check.
   - `getClassSubjectsAction(classId?: string, academicYearId?: string)` querying `public.class_subjects`.
   - `assignSubjectToClassAction(data)` & `removeClassSubjectAction(classSubjectId)`.
2. **Enhance `app/actions/classes.ts`**:
   - Add `createClassAction`, `updateClassAction`, and `deactivateClassAction` with RBAC guard and soft-delete protection.
3. **Fix `getTeachers()` in `app/actions/logs.ts`**:
   - Enforce: `SELECT id, full_name, email, role FROM public.profiles WHERE approval_status = 'approved' AND is_active = true AND role IN ('teacher', 'lab_incharge') ORDER BY full_name`.
   - Instantly fixes the duplicate Dinanath Shah account and eliminates rejected test accounts.
4. **Unify Period Timings**:
   - Update `app/actions/settings.ts` to strictly require `super_admin` for modifying period schedules, and provide a typed `getPeriodSlotsAction()`.
5. **Ghost `localStorage` Eviction**:
   - Create `components/layout/client-storage-evictor.tsx` mounted in `app/(dashboard)/layout.tsx` to evict legacy prototype keys (`lmr_admin_faculty_v2`, `lmr_admin_classes_v2`, `lmr_admin_subjects_v2`, `lab_master_routine_2083_v6`, `lmr_admin_periods_v2`).

### Phase 2: Admin Console Unification (Tab 02 Curriculum & Tab 03 Maintenance)
1. **Rewire `/admin` Tab 02 (Curriculum & Classes)**:
   - Replace `useInfrastructureState` hooks for subjects and classes with direct calls to `getSubjectsAction`, `getClassesAction`, and `getClassSubjectsAction`.
   - Add Class & Teacher assignment controls inside the subject management drawer.
2. **Rewire Incident Categories**:
   - Ensure `/admin` Incident Categories tab directly modifies `public.issue_categories` via existing actions in `app/actions/workstations.ts`, eliminating the redundant `infrastructure_incident_categories` JSON blob.
3. **Reconcile Maintenance Routines**:
   - Verify `/admin` Maintenance tab interacts with `public.maintenance_plans` and `public.maintenance_routine_templates`.

### Phase 3: Client Dropdown & Filter Purge (Compiler-Driven)
1. **Rewire `components/records/practical-filter-bar.tsx`**:
   - Query live subjects via `getSubjectsAction()`, unlocking all 29 subjects in the curriculum.
2. **Purge Fake Routines in `app/(dashboard)/schedules/page.tsx`**:
   - Remove `MASTER_ROUTINE` dummy fallback; populate teacher filter solely with approved profiles.
3. **Compiler Purge**:
   - Deprecate mock exports in `lib/master-data.ts`. Run `npx tsc --noEmit` and resolve all resulting errors repository-wide.

### Phase 4: Mobile-First Hardening & Shell Optimization ($375\text{px}$)
1. **Condense Top Navbar on Mobile**:
   - Adjust `components/layout/header` layout to prevent horizontal scroll clipping on $<640\text{px}$ viewports.
2. **Dynamic Viewport Height for All Modals**:
   - Update modal containers across `/records`, `/computer-lab`, `/schedules`, and `/incidents` to use `max-h-[calc(100dvh-2rem)]`.
3. **Mobile Roll-Call UX**:
   - Ensure the mobile view of `/computer-lab` provides a clear, high-contrast list view with large touch targets for quick roll-call completion.

### Phase 5: Verification & Production Dry-Run
1. **Automated Verification**:
   - `npx tsc --noEmit` passing with 0 errors.
   - Run the full regression test suite: `npm test`.
2. **Persona Walkthrough**:
   - Execute Pipelines 1, 2, and 3 across simulated viewports and roles.

---

## 4. Execution Governance & Invariant Checklist

Before declaring any phase complete, the following invariants must be verified:

- [ ] **No Literal `+` in Buttons**: Lucide `<Plus className="h-4 w-4" />` used exclusively.
- [ ] **Standardized Terminology**: "Attendance", "Timetable", "Logbook", "Equipment Breakage".
- [ ] **Precaution Active Intact**: Safety lock toggle in `/admin` preserved.
- [ ] **Zero Department Regressions**: Role badges and facility scope rendered instead of legacy department strings.
- [ ] **Zero Shadow Databases**: All analytics and dropdowns query PostgreSQL directly.
- [ ] **Strict Soft-Deactivations**: No raw `DELETE` queries on active curriculum foreign keys.
- [ ] **Server Action RBAC Guards**: All mutating actions enforce `getServerUserScope()`.
- [ ] **0 Compile Errors**: Full `npx tsc --noEmit` pass.
