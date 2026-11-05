# Comprehensive System Audit: Transitioning from Prototype to Production

> **Document**: `doc/audits/2026-10-18-production-readiness-and-mock-data-audit.md`  
> **Author**: Antigravity Core AI  
> **Target System**: LabSync LIMS / LMR  
> **Status**: Full Forensic Audit Completed across all Server Actions, Client Hooks, and PostgreSQL Tables  
> **Scope**: Data Unification, Hardcoded Mocks Purge, Admin Single Source of Truth, Security, and Mobile Responsiveness  

---

## 1. Executive Summary & Root Cause Analysis

### The "Dual Universe" Dilemma
During the development phase, the application relied on rapid prototype scaffolding:
1. **Frontend Prototype Layer**: `lib/master-data.ts` provided static fallback arrays (`DEFAULT_CLASSES`, `DEFAULT_SUBJECTS`, `MASTER_ROUTINE`, `INITIAL_FACULTY`, `LAB_ROOMS`), and `hooks/use-infrastructure-state.ts` stored updates inside `localStorage` and serialized JSON blobs in `institution_settings`.
2. **Normalized PostgreSQL Production Layer**: Real relational tables (`public.profiles`, `public.subjects`, `public.classes`, `public.class_subjects`, `public.labs`, `public.schedules`, `public.issue_categories`) were established with strict schemas.

**The Problem**: The UI hooks were never fully severed from the prototype layer. As a result, when an administrator adjusts settings or views rosters:
- Dropdowns merge static mock arrays with database rows.
- Inactive/rejected user accounts appear in faculty rolls.
- Real curriculum subjects in PostgreSQL are hidden because the frontend filter is capped to a hardcoded 11-item array.
- Schedule routines retain dummy labels like `COMP12-Teacher`.

---

## 2. Complete Inventory of Hardcoded Mocks & Discrepancies

### A. Faculty & Teachers (`public.profiles`)
| Location | Current Implementation | Flaw & Risk | Production Requirement |
| :--- | :--- | :--- | :--- |
| `app/actions/logs.ts:1076` (`getTeachers`) | `SELECT id, full_name FROM profiles ORDER BY full_name` | Lacks `WHERE approval_status = 'approved' AND is_active = true`. Pulls rejected accounts (causing **duplicate Dinanath Shah**) and non-teachers (Super Admin, HOD). Has fallback `defaultTeachers: [{ id: 't1' ... }]`. | Filter strictly: `WHERE approval_status = 'approved' AND is_active = true AND role IN ('teacher', 'lab_incharge')`. Remove fallback array. |
| `components/schedules/session-action-modal.tsx:52` | `TEACHER_NAME_MAP: Record<string, string> = { t1: '...', t2: '...' }` | Hardcoded dummy IDs `t1` through `t5`. | Remove mapping; resolve teacher names dynamically from `profiles` via UUID. |
| `hooks/use-infrastructure-state.ts:177` | `INITIAL_FACULTY: FacultyMemberItem[] = [...]` cached in `localStorage['lmr_admin_faculty_v2']` | Disconnected from real PostgreSQL accounts in `public.profiles`. | Deprecate `INITIAL_FACULTY`; pull faculty directly from `public.profiles`. |
| `app/(dashboard)/schedules/page.tsx:51` | Unions `infraFaculty` with `routines[].teacher` | Dummy routine strings (`COMP12-Teacher`, `CN12-Teacher`) pollute the dropdown. | Pull teacher filter options exclusively from active approved profiles. |

---

### B. Subjects & Curriculum (`public.subjects` & `public.class_subjects`)
| Location | Current Implementation | Flaw & Risk | Production Requirement |
| :--- | :--- | :--- | :--- |
| `lib/master-data.ts:975` | `DEFAULT_SUBJECTS: SubjectItem[] = [...]` (11 subjects) | Hardcoded static list; completely ignores the **29 real active curriculum subjects** in `public.subjects`. | Purge `DEFAULT_SUBJECTS`. |
| `components/records/practical-filter-bar.tsx:88` | Reads `useInfrastructureState().subjects` which falls back to `DEFAULT_SUBJECTS` | Filters in `/records` show only 11 subjects (`All Subjects (11)`). | Fetch active subjects directly from `public.subjects` via a dedicated server action (`getSubjects`). |
| `app/(dashboard)/admin/page.tsx:619` (`handleSaveSubject`) | Calls `addSubject()` in `useInfrastructureState` which writes to `institution_settings` (`infrastructure_subjects` JSON blob) and `localStorage` | Admin changes in Tab 02 "Subjects" **never insert or update `public.subjects`** or `public.class_subjects` in PostgreSQL! | Create `createSubject`, `updateSubject`, and `assignSubjectToClass` server actions writing to `public.subjects` and `public.class_subjects`. |
| `app/(dashboard)/records/new/log-form.tsx:78` | Falls back to `DEFAULT_SUBJECTS` | Logging practicals for unlisted subjects fails or shows fallback. | Bind subject selector to live `public.subjects` and `public.class_subjects`. |

---

### C. Classes & Cohort Batches (`public.classes`)
| Location | Current Implementation | Flaw & Risk | Production Requirement |
| :--- | :--- | :--- | :--- |
| `lib/master-data.ts:930` | `DEFAULT_CLASSES: ClassBatchItem[] = [...]` | Hardcoded array. Real classes live in `public.classes` (9 classes). | Purge `DEFAULT_CLASSES`. |
| `hooks/use-infrastructure-state.ts:780` (`addClass`) | Saves to `institution_settings` key `infrastructure_classes` (JSON blob) and `localStorage` | Changes in Admin Console do not mutate `public.classes` or `student_enrollments`. | Rewire `addClass`, `updateClass`, `deleteClass` to server actions modifying `public.classes`. |
| `app/(dashboard)/records/new/log-form.tsx:64` | Falls back to `DEFAULT_CLASSES` | Desynchronization between enrolled rosters and selectable classes. | Query `public.classes` directly. |

---

### D. Timetable & Weekly Routine (`public.schedules`)
| Location | Current Implementation | Flaw & Risk | Production Requirement |
| :--- | :--- | :--- | :--- |
| `lib/master-data.ts:1289` | `MASTER_ROUTINE` (~1,000 lines of mock schedule items with `COMP12-Teacher`, `PHY12-Teacher`) | Caches into `localStorage['lab_master_routine_2083_v6']`. | Deprecate `MASTER_ROUTINE` as runtime fallback; populate `/schedules` solely from PostgreSQL `public.schedules`. |
| `components/command-palette.tsx:55` | Filters `MASTER_ROUTINE` | Quick navigation returns mock classes instead of live sessions. | Query live schedules via server search action. |
| `app/actions/notifications.ts:85` | Filters `MASTER_ROUTINE` | Notification digest sends emails with mock routines. | Query `public.schedules` where `day_key = today`. |

---

### E. Facility Labs (`public.labs`)
| Location | Current Implementation | Flaw & Risk | Production Requirement |
| :--- | :--- | :--- | :--- |
| `lib/master-data.ts:13` | `LAB_ROOMS: LabRoomItem[] = [comp, phys, chem, bio, elec]` | Static array. In reality, `public.labs` has 3 active labs (`comp`, `chem`, `phys`). | Query `public.labs` where `is_active = true`. |
| `app/actions/schedules.ts:34` | `DEFAULT_LABS: LabRow[] = [...]` | Hardcoded fallback array on query failure. | Return empty array or throw graceful error instead of masking database outages with mock labs. |

---

## 3. Five Critical Production Hazards & Architectural Safeguards

### 1. Junction Table (`public.class_subjects`) in Phases 1 & 2
- **Hazard**: Creating a subject only in `public.subjects` does not associate it with any Grade/Class. When a teacher selects Class 11 in `/records/new` or `/schedules`, the subject dropdown will be empty.
- **Solution**:
  - Implement `assignSubjectToClass(classId, subjectId, teacherId, defaultLabId, academicYearId)` and `getClassSubjects(classId)`.
  - In Admin Console Tab 02, when creating/editing a subject, the modal must provide class checkboxes/selects and write the relational mapping into `public.class_subjects`.

### 2. Soft-Delete (`is_active = false`) vs Hard Foreign Key Crash
- **Hazard**: Executing `DELETE FROM public.subjects WHERE id = ...` or `DELETE FROM public.classes WHERE id = ...` throws PostgreSQL `23503 foreign_key_violation` because existing `practical_logs`, `schedules`, and `student_enrollments` reference those IDs. If `CASCADE` is enabled, historical attendance records are permanently erased!
- **Solution**:
  - Replace hard `DELETE` with **Soft-Deactivation**:
    `UPDATE public.subjects SET is_active = false WHERE id = $1`.
  - Only allow hard delete if `SELECT count(*) FROM practical_logs WHERE ...` and `schedules` reference counts equal 0.

### 3. Stale `localStorage` & JSON Blob Ghost Eviction
- **Hazard**: If browsers have already visited the app, their `localStorage` retains old keys (`lmr_admin_*`, `lab_master_routine_2083_v6`), causing stale prototype data to re-hydrate over fresh database state.
- **Solution**:
  - **Pre-Flight Data Check**: Confirm that PostgreSQL tables (`public.schedules`, `public.classes`, `public.subjects`) contain 100% of institutional data.
  - **One-Time Client Storage Purge**: Embed a migration script in `components/layout/` that evicts `localStorage.removeItem('lmr_admin_*')` and `localStorage.removeItem('lab_master_routine_*')`.

### 4. Server Action RBAC & Cache Revalidation
- **Hazard**: Next.js Server Actions are public HTTP POST endpoints. Mutating actions (`createSubject`, `createClass`, `assignSubjectToClass`) without role checks allow arbitrary callers to edit school infrastructure.
- **Solution**:
  - Every mutating server action must verify:
    ```typescript
    const scope = await getServerUserScope()
    if (!scope.isPrivileged || scope.approvalStatus !== 'approved') {
      return { success: false, error: 'Unauthorized: Administrative role required' }
    }
    ```
  - Call `revalidatePath('/admin')`, `revalidatePath('/records')`, and `revalidatePath('/schedules')` on every mutation to ensure instant cache invalidation.

### 5. Mobile UX Refinements (Incident Camera & Live Cockpit)
- **Incident Photo Upload**: Do NOT hardcode `capture="environment"`. Standard `<input type="file" accept="image/*" />` allows users to either snap a live photo or select an existing photo from their gallery.
- **Live Cockpit Mobile Cards**: Mobile workstation bench cards must feature 1-tap **Present / Absent toggle pills** and **Quick Relocate** directly on the card so instructors can conduct roll-call smoothly while walking down the lab aisle.

---

## 4. Step-by-Step Production Migration Roadmap

### Phase 1: Canonical Database Actions & Relational Mapping
1. **`app/actions/subjects.ts`**:
   - `getSubjects()`: Selects active subjects from `public.subjects`.
   - `createSubject()`: Inserts into `public.subjects` with RBAC guard.
   - `updateSubject()`: Updates subject fields with RBAC guard.
   - `deactivateSubject()`: Soft-deactivates (`is_active = false`) with reference count check.
   - `assignSubjectToClass()` & `getClassSubjects()`: Manages `public.class_subjects`.
2. **`app/actions/classes.ts`**:
   - `getClasses()`: Selects from `public.classes`.
   - `createClass()`: Inserts into `public.classes` with RBAC guard.
   - `updateClass()`: Updates class with RBAC guard.
   - `deactivateClass()`: Soft-deactivates with enrollment check.
3. **`app/actions/logs.ts`**:
   - Update `getTeachers()` to strictly query `WHERE approval_status = 'approved' AND is_active = true AND role IN ('teacher', 'lab_incharge')`.
4. **Client Eviction Utility**:
   - Add a storage cleaner to evict legacy `lmr_admin_*` and `lab_master_routine_*` keys.

### Phase 2: Admin Console Unification (`/admin`)
1. **Tab 02 Curriculum**:
   - Rewire Subject Management and Class Management to invoke the canonical server actions.
   - Eliminate writes to `infrastructure_subjects` and `infrastructure_classes` JSON blobs.
   - Include Class-to-Subject assignment selector in subject dialog.
2. **Routine Console (`routine-manager.tsx`)**:
   - Bind dropdowns strictly to PostgreSQL `classes`, `subjects`, and `profiles`.

### Phase 3: Client Hooks & Dropdown Purge
1. **`practical-filter-bar.tsx`**: Fetch subjects directly from `public.subjects` (unlocking all 29 subjects).
2. **`schedules/page.tsx`**: Fetch teacher options from approved profiles; purge `COMP12-Teacher` and other mock strings.
3. **`session-action-modal.tsx`**: Remove `TEACHER_NAME_MAP`; resolve teacher names dynamically by profile UUID.
4. **`log-form.tsx`**: Remove fallbacks to `DEFAULT_CLASSES` and `DEFAULT_SUBJECTS`.

### Phase 4: Mobile Responsiveness Pass
1. Add mobile-responsive card view for `/records` and `/schedules`.
2. Optimize `/records/new` with sticky thumb-navigation.
3. Provide camera & gallery options in `/incidents` photo upload.
4. Add 1-tap Present/Absent pills on mobile workstation cards in `/computer-lab`.

### Phase 5: Verification & Production Dry Run
1. End-to-end dry run across all 4 user roles (`teacher`, `lab_incharge`, `hod`, `super_admin`).
2. Run automated test suite: `npx tsc --noEmit` and `tests/*.test.mjs`.
3. Purge test seed scripts with hardcoded passwords.
