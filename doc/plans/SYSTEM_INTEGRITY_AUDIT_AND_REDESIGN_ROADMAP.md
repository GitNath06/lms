# System Integrity Audit & Core Redesign Roadmap

> **Document**: `doc/plans/SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md`  
> **Status**: Approved Master Architectural Roadmap  
> **Target**: Unified Academic Year, Dynamic Classes, and Roster Lifecycle  

---

## 1. Audit Findings: The Disconnect Between Specs & Code

| Area | Stated Architecture | Actual Code State | Required Fix |
| :--- | :--- | :--- | :--- |
| **Academic Years UI** | Admins manage cycles & switch current year | Server actions exist in `academic-years.ts`, but are called 0 times in UI | Build dedicated Academic Year Hub in `/admin` (View, Create, Switch Active) |
| **Class Rosters** | Dynamic multi-grade classes from Postgres | `class-roster-view.tsx` uses hardcoded `AVAILABLE_CLASSES` array | Query `public.classes` dynamically via server action |
| **Cohort Promotion** | Interactive wizard with exceptions & rolls | `cohort-promotion-modal.tsx` was orphaned and never wired to tabs | Build full visual Wizard with A-Z rolls, repeat/transfer/graduate, and rollback |
| **Safety & Rollback** | Reversible batch transitions with audit trail | Partial database transactions, no UI rollback interface | Add `audit_ledger` batch tracking and 1-click Revert card |

---

## 2. The 3-Phase Redesign Execution Order

### Phase 1: Academic Year Management Hub (Foundation)
- **Location**: `/admin` &rarr; Tab "Curriculum" or "Operations" (Dedicated Sub-tab: **Academic Years**).
- **Features**:
  - List all academic cycles (e.g. `2081/82`, `2082/83`, `2083/84`).
  - Active cycle indicator (`is_current = true`).
  - 1-click action: **"Set as Active Academic Year"** (atomic switch).
  - Modal: **"Create New Academic Year"** with Nepali BS date range picker.

### Phase 2: Dynamic Classes & Curriculum Unification
- Purge static `AVAILABLE_CLASSES` from `components/roster/class-roster-view.tsx`.
- Connect all dropdowns across Roster, Routine, and Attendance directly to `public.classes`.

### Phase 3: Cohort Promotion Wizard & Disaster Recovery
- Build `components/admin/roster-lifecycle/cohort-promotion-wizard.tsx`.
- Wire into `/admin` both as a dedicated subtab and as an action button in Class Rosters.
- Terminal grade support: Class 12 &rarr; **Mark as Graduated**.
- Auto-assign rolls alphabetically (A-Z) with inline numeric edit overrides.
- Bottom card: **"Recent Promotions & Rollback"** (1-click revert within 24 hours).
