# LMR Documentation & Execution Tracking Registry

This folder serves as the persistent context memory and execution tracking system for the **LabSync LIMS (LMR)** project. 

Due to session resets or context limits, all tasks, architectural decisions, completed work, and pending items are systematically documented here. When resuming work in any new or truncated conversation, you can reference any file here with `@doc/<filename>.md` to instantly restore context.

---

## 📁 Standard Documentation Structure

```
doc/
├── README.md                 # This guide & protocol index
├── CURRENT_STATUS.md         # Living ledger: active goal, completed milestones, immediate next steps
├── plans/                    # Master architecture specifications & multi-phase engineering plans
│   ├── README.md             # Plan index and standard template
│   └── ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md
└── tasks/                    # Detailed task-by-task execution journals
    └── YYYY-MM-DD-<task>.md  # Specific feature/bugfix execution log
```

---

## 🏛️ Master Architecture & Implementation Plans
All blueprints and implementation plans live in [`doc/plans/`](file:///d:/Projects/LMR/doc/plans/):
- [SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md](file:///d:/Projects/LMR/doc/plans/SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md) — 3-Layer System Integrity Roadmap (Academic Years Hub, Dynamic DB Classes, Cohort Promotion Wizard).
- [SCHOOL_ERP_DATABASE_ARCHITECTURE_GUIDE.md](file:///d:/Projects/LMR/doc/plans/SCHOOL_ERP_DATABASE_ARCHITECTURE_GUIDE.md) — School ERP database architecture, entity relational web, immutable history, soft-delete, and promotion lifecycle.
- [ROSTER_PROMOTION_WIZARD_SPEC.md](file:///d:/Projects/LMR/doc/plans/ROSTER_PROMOTION_WIZARD_SPEC.md) — Cohort Promotion Wizard UI specification with A-Z roll sort, repeater retention, Class 12 graduation, and 24-hr rollback.
- [ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md](file:///d:/Projects/LMR/doc/plans/ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md) — Student Roster Lifecycle, SIS/ERP integration, Cohort Promotion, and Status Check Constraints.
- [AGENTS.md](file:///d:/Projects/LMR/AGENTS.md) — Institutional Blueprint, Phase 6 Tracks (CAD Workstation Floor, Minimap, Collision Engine, Governance, Dual Sign-off), and System Invariants.
- [PRD.md](file:///d:/Projects/LMR/PRD.md) — Full Master Product Requirements Document.
- [SYSTEM_OVERVIEW.md](file:///d:/Projects/LMR/SYSTEM_OVERVIEW.md) — Database schema summary and architectural overview.

---

## 🛠️ The 2-Step Operating Protocol

### 1. Goal Scoping & Detailed Requirement Probing
Before executing any major change:
- Clarify exact user expectations, workflows, edge cases, permissions, and institutional constraints.
- Ask targeted questions to align on UI/UX, database schema impacts, and testing criteria.

### 2. Living Execution Logging
During and after every execution:
- Update `doc/CURRENT_STATUS.md` with:
  - **Current Goal**: What we are solving.
  - **What Was Done**: Specific files touched, database migrations, functions created, test results.
  - **What Is Left**: Pending items, edge cases, or upcoming phases.
- Create or update dedicated task logs in `doc/tasks/` for complex features so anyone can run `@doc/tasks/<file>.md` to resume without context loss.
