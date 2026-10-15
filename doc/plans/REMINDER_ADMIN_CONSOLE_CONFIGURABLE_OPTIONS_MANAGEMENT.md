# Reminder Plan: Admin Console Dedicated Options & Template Management

> **Initiative Context**: Captured from user feedback on October 8, 2026.
> **Goal**: Replace hardcoded system options (such as quick maintenance templates in `Image 4` and fault categories in `Image 5`) with dedicated, dynamic configuration consoles in the Super Admin workbench (`/admin`). Administrators can add, edit, rename, archive, or re-order operational taxonomies without modifying TypeScript code or triggering migrations.
> **Execution Status**: Scheduled as a dedicated separate initiative after Computer Lab Floor Plan & Layout Editing completion.

---

## 1. Targeted Feature Areas Identified

### A. Quick Maintenance Routine Templates (`Image 4`)
* **Current Behavior**: Hardcoded template buttons:
  - `PC Thermal (180d)`
  - `BIOS Firmware (120d)`
  - `PC Deep (90d)`
  - `Lab Software (60d)`
* **Future Admin Console Capability**:
  - In `/admin` &rarr; **Tab 03 (Maintenance Routines)**, add a dedicated **"Preset Template Manager"** section.
  - Form fields: Template Title, Default Cadence (`daily`, `weekly`, `monthly`, `quarterly`, `semester`, `yearly`), Cadence Days (`30d`, `60d`, `90d`, `120d`, `180d`), Category, and Checklist Items.
  - Actions: **Add Template**, **Edit Template**, **Delete / Soft-Archive Template**.
  - Storage: Store in a new table `public.maintenance_routine_templates` (or JSONB in institution settings).
  - Rule #1 Guard: Never render literal `+` in template buttons (always use `<Plus className="..." />`).

### B. Hardware & Software Fault Categories (`Image 5`)
* **Current Behavior**: Categories rendered in the workstation issue drawer (`WorkstationIssueDrawer`) and station quick popover:
  - `Mouse / Keyboard unresponsive` (`medium`)
  - `No display / Monitor won't turn on` (`high`)
  - `OS Crash / Blue Screen` (`high`)
  - `Loose Network Cable / No Internet` (`medium`)
* **Future Admin Console Capability**:
  - In `/admin` &rarr; **Facility & Workstation Settings**, add a dedicated **"Fault Category Registry"** table.
  - Backed by live table `public.issue_categories` (id, name, default_severity, icon_name, is_active, display_order).
  - Actions:
    - **Add New Fault Category**: Name, default severity (`low`, `medium`, `high`, `critical`), suggested icon.
    - **Rename / Edit Existing**: Seamlessly update title and severity without breaking past incident links.
    - **Soft-Archive**: Disable obsolete categories (`is_active = false`) to preserve historical audit trail.
    - **Drag-to-Reorder**: Adjust display order shown to teachers in the quick popover.

### C. System-Wide Dropdown & Taxonomy Management
* **General Pattern**: Eliminate hardcoded select options across all administrative workflows:
  - Subject stream types and class grade levels.
  - Incident severity escalation rules and HOD notification triggers.
  - Lab facility room types and active lifecycle statuses.

---

## 2. Technical Implementation Architecture

1. **Database Schema**:
   - Verify `public.issue_categories` CRUD actions in `app/actions/workstations.ts` are wired to the UI.
   - Create `public.maintenance_routine_templates` table:
     ```sql
     CREATE TABLE IF NOT EXISTS public.maintenance_routine_templates (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       title text NOT NULL,
       cadence text NOT NULL,
       cadence_days integer NOT NULL DEFAULT 90,
       category text NOT NULL DEFAULT 'preventive',
       checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
       is_active boolean NOT NULL DEFAULT true,
       created_at timestamptz NOT NULL DEFAULT now()
     );
     ```
2. **Server Actions**:
   - `getMaintenanceTemplates()`, `createMaintenanceTemplate()`, `updateMaintenanceTemplate()`, `deleteMaintenanceTemplate()`.
   - `getIssueCategories()`, `createIssueCategory()`, `updateIssueCategory()`, `archiveIssueCategory()`.
3. **Admin Console Views**:
   - Sub-panel in `/admin` with modal dialogues for creating and editing templates and categories.
   - Live synchronization across client workspaces via `revalidatePath`.
