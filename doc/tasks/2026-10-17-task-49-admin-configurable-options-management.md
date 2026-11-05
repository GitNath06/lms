# Task 49: Admin Console Configurable Options Management (Maintenance Routine Templates & Workstation Fault Taxonomies)

**Date**: 2026-10-17  
**Status**: Completed  
**Type**: Architecture / Feature / System Administration  
**Scope**: Super Admin Console (`/admin`), Maintenance Workbench (`/maintenance`), Workstation Popover (`StationQuickPopover`), Database Schema & Seed Data, Server Actions, Automated Regression Suite

---

## 1. Executive Summary & Objective

Laboratory operations in academic institutions evolve over time: new equipment models require bespoke preventive maintenance checklists, and computer labs encounter new failure modes (e.g. GPU artifacting, OS boot halts, network socket faults) that require updated fault reporting categories.

Prior to Task 49, routine presets and workstation fault choices were statically hardcoded across the application:
1. `COMPUTER_ROUTINE_PRESETS` in `components/maintenance/create-plan-modal.tsx` and `PRESET_ROUTINES` in `components/admin/maintenance-routines-manager.tsx` were hardcoded JavaScript arrays. Adding, updating, or reordering routine presets required code modifications and manual redeployment.
2. `public.issue_categories` existed in the PostgreSQL database with 10 seed categories, but lacked a dedicated administrative console under `/admin` to add, update, reorder, or archive categories. Furthermore, `components/computer-lab/station-quick-popover.tsx` had a disconnected, hardcoded `FAULT_PRESETS` array.
3. Operations in `manageIssueCategory` relied on the Supabase PostgREST client (`createClient()`), which triggered Row-Level Security (RLS) denial under custom cookie authentication (`getServerUserScope()`).

Task 49 implemented the end-to-end architecture outlined in [`doc/plans/REMINDER_ADMIN_CONSOLE_CONFIGURABLE_OPTIONS_MANAGEMENT.md`](file:///d:/Projects/LMR/doc/plans/REMINDER_ADMIN_CONSOLE_CONFIGURABLE_OPTIONS_MANAGEMENT.md):
- Created a database-backed **Maintenance Routine Template System** (`public.maintenance_routine_templates`).
- Deployed a full-featured **Maintenance Template Manager** (`components/admin/maintenance-template-manager.tsx`) with 1-click workbench deployment and checklist reordering.
- Deployed a dedicated **Workstation Fault Categories Manager** (`components/admin/workstation-fault-categories-manager.tsx`) with color swatches, severity controls, drag/step reordering, and referential-integrity soft-archiving.
- Migrated `manageIssueCategory` to direct PostgreSQL connection pool (`getPgPool()`).
- Refactored `StationQuickPopover` and `CreatePlanModal` to consume dynamic database templates and categories.
- Enforced zero literal `+` buttons (Rule #1), Precaution Active guards (Rule #3), strict TypeScript zero errors (Rule #8), and pure async Server Actions (Rule #13).
- Added an automated 14-point regression suite in `tests/admin-configurable-options.test.mjs` (100% pass rate).

---

## 2. Changes & Deliverables

### A. Database Model & Migration (`schema.sql`)
1. **New Table `public.maintenance_routine_templates`**:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `title VARCHAR(255) NOT NULL`
   - `lab_id VARCHAR(50) DEFAULT 'comp'` (supports `'comp'`, `'phys'`, `'chem'`, `'bio'`, or `'all'`)
   - `cadence VARCHAR(50) NOT NULL DEFAULT 'quarterly'`
   - `interval_days INT NOT NULL DEFAULT 90`
   - `severity VARCHAR(50) NOT NULL DEFAULT 'routine'`
   - `category VARCHAR(100) NOT NULL DEFAULT 'General Care'`
   - `checklist JSONB NOT NULL DEFAULT '[]'::jsonb`
   - `is_active BOOLEAN NOT NULL DEFAULT true`
   - `sort_order INT NOT NULL DEFAULT 0`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
2. **Row-Level Security (RLS)**:
   - Read access granted to all authenticated institutional roles (`super_admin`, `lab_incharge`, `hod`, `teacher`).
   - Write/delete/update mutations restricted to administrative roles (`super_admin`, `lab_incharge`, `hod`).
3. **Seeded Canonical Institutional Templates**:
   - BIOS & Firmware Update (Quarterly, 90 days)
   - Deep PC Interior & Thermal Paste Renewal (Semester, 180 days)
   - OS & Security Patch Audit (Monthly, 30 days)
   - Peripherals & Cable Management Inspection (Bi-Weekly, 14 days)
   - Network Socket & RJ45 Continuity Triage (Monthly, 30 days)
   - UPS & Power Strip Safety Inspection (Bi-Weekly, 14 days)
4. **Enhanced `public.issue_categories`**:
   - Added column `sort_order INT NOT NULL DEFAULT 0` for drag/step sequencing.

### B. TypeScript Definitions & Domain Types
- `types/database.ts`: Added table definitions for `maintenance_routine_templates` and exported `MaintenanceRoutineTemplateRow`, `MaintenanceRoutineTemplateInsert`, and `MaintenanceRoutineTemplateUpdate`.
- `lib/types/maintenance-templates.ts`: Created domain types:
  - `MaintenanceRoutineTemplateInput`
  - `MaintenanceRoutineTemplateOperationResult`

### C. Server Actions
1. **`app/actions/maintenance-templates.ts`**:
   - `getMaintenanceRoutineTemplates(labId?)`: Queries active routine templates, optionally filtered by lab code or `'all'`, ordered by `sort_order ASC, created_at ASC`.
   - `saveMaintenanceRoutineTemplate(payload)`: Inserts or updates templates with JSONB checklist parsing and revalidation.
   - `deleteMaintenanceRoutineTemplate(id)`: Soft-deletes template (`is_active = false`).
   - `reorderMaintenanceRoutineTemplates(orderList)`: Batch-updates sort ordering inside an atomic transaction.
2. **`app/actions/workstations.ts`**:
   - `getIssueCategories()`: Direct PostgreSQL pool query returning active issue categories ordered by `sort_order ASC, name ASC`.
   - `reorderIssueCategories(orderList)`: Batch-updates category sort ordering.
   - Refactored `manageIssueCategory`: Switched from Supabase PostgREST client to direct `getPgPool()` with referential integrity check (soft-archives if active issues link to the category).

### D. Frontend Administrative Consoles
1. **`components/admin/maintenance-template-manager.tsx`**:
   - Tabbed or standalone management view with search filter, cadence badges, and severity indicators.
   - Interactive Checklist Step Builder: add step, delete step, step reordering, and live validation.
   - One-Click Deploy: instantly instantiates a routine template as an active workbench routine plan for any laboratory.
   - Guarded by Precaution Active safety toggle.
2. **`components/admin/workstation-fault-categories-manager.tsx`**:
   - Dedicated administrative manager under Super Admin &rarr; Facilities &rarr; Workstation Faults.
   - 8-color preset swatch selector with custom hex code input.
   - Classification type selector (`Hardware`, `Software`, `Network`, `Peripheral`, `Other`).
   - Default severity selector (`Low`, `Medium`, `High`, `Critical`).
   - Step reordering (`Move Up`, `Move Down`).
   - Referential integrity safe-delete / soft-archive.
3. **`components/admin/maintenance-routines-manager.tsx`**:
   - Added view toggle: "Active Routines" vs "Preset Template Manager".
   - Integrated dynamic template loading from `getMaintenanceRoutineTemplates()`.
   - Eliminated static `PRESET_ROUTINES` array.
4. **`app/(dashboard)/admin/page.tsx`**:
   - Registered `'workstation-faults'` in `facilitiesSubTab` navigation.
   - Added dynamic lazy-loaded `<WorkstationFaultCategoriesManager />` component.

### E. Dynamic Consumer Integration
1. **`components/maintenance/create-plan-modal.tsx`**:
   - Replaced static `COMPUTER_ROUTINE_PRESETS` array with dynamic `getMaintenanceRoutineTemplates('comp')`.
   - Preset buttons populate title, description, cadence, category, and checklist automatically.
2. **`components/computer-lab/station-quick-popover.tsx`**:
   - Added optional `categories?: IssueCategoryRow[]` prop.
   - Computes dynamic fault options with fallback defaults.
   - Reports issues with selected `category_id` linked to `workstation_issues`.

---

## 3. Verification & Automated Test Suite

- **Test Suite**: `tests/admin-configurable-options.test.mjs`
- **Execution Command**:
  ```bash
  node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/admin-configurable-options.test.mjs
  ```
- **Results**: **14 passing, 0 failing (100% pass rate)**:
  1. `getMaintenanceRoutineTemplates`: Retrieves seeded institutional templates with parsed checklists (Pass)
  2. `getMaintenanceRoutineTemplates`: Filters templates by laboratory facility code (Pass)
  3. `saveMaintenanceRoutineTemplate`: Creates new template with jsonb checklist (Pass)
  4. `saveMaintenanceRoutineTemplate`: Updates existing template attributes (Pass)
  5. `reorderMaintenanceRoutineTemplates`: Updates sort order sequence (Pass)
  6. `deleteMaintenanceRoutineTemplate`: Soft-deletes template (`is_active = false`) (Pass)
  7. `getIssueCategories`: Retrieves active fault categories with `default_severity` (Pass)
  8. `manageIssueCategory`: Creates and updates issue category via PostgreSQL pool (Pass)
  9. `reorderIssueCategories`: Updates category sort ordering (Pass)
  10. `manageIssueCategory (deactivate)`: Soft-archives issue category (Pass)
  11. Rule #1 Compliance: Zero literal `+` in button text across managers (Pass)
  12. Rule #3 Compliance: Precaution Active safety lock guards mutations (Pass)
  13. Dynamic Options Architecture: Dynamic props & queries wired into UI components (Pass)

- **TypeScript Compilation**:
  ```bash
  npx tsc --noEmit
  ```
  Exited with code 0 and **0 errors** across the entire project.

---

## 4. Invariants & Repository Standards Preserved

1. **Rule #1 (No Literal `+` in Buttons)**:
   - All action buttons use `<Plus className="h-4 w-4" /> <span>Add Template</span>` or similar. Zero literal `+` in button text.
2. **Rule #3 (Precaution Active Guard)**:
   - Both `MaintenanceTemplateManager` and `WorkstationFaultCategoriesManager` verify `isEditModeUnlocked` before initiating writes or deletes.
3. **Rule #8 (Strict TypeScript)**:
   - All files, props, database rows, and actions are strictly typed. `npx tsc --noEmit` compiles with 0 errors.
4. **Rule #13 (RPC Export Rules)**:
   - `app/actions/maintenance-templates.ts` exports exclusively `async function`s. Types are isolated in `lib/types/maintenance-templates.ts`.
5. **Rule #15 (Referential Integrity)**:
   - Deleting an issue category checks `workstation_issues`. If past tickets reference the category, it is soft-archived (`is_active = false`) rather than hard-deleted.
6. **Rule #16 (Zero Shadow Databases)**:
   - All routine templates and fault categories query live PostgreSQL tables (`public.maintenance_routine_templates` and `public.issue_categories`).
