# Implementation Plans Registry (`doc/plans/`)

This directory houses all architectural specifications, multi-phase engineering plans, and feature blueprints for **LabSync LIMS (LMR)**.

---

## 📑 Active & Historical Plans Index

| Plan File | Scope / Purpose | Status | Target Area |
| :--- | :--- | :--- | :--- |
| [2026-10-05-computer-lab-progress-and-verification-report.md](file:///d:/Projects/LMR/doc/plans/2026-10-05-computer-lab-progress-and-verification-report.md) | Comprehensive Progress, Verification Guide & Remaining Blueprint (Phases 1–4) | Canonical Verification Guide | Floor Plan, Live Cockpit, Projector & Terminal |
| [2026-10-05-computer-lab-floor-plan-and-projection-elevation.md](file:///d:/Projects/LMR/doc/plans/2026-10-05-computer-lab-floor-plan-and-projection-elevation.md) | Computer Lab Floor Plan, Live Cockpit & Projection Elevation Master Spec | In Active Execution | `/computer-lab`, `/computer-lab/projector` |
| [SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md](file:///d:/Projects/LMR/doc/plans/SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md) | 3-Layer System Integrity Roadmap: Academic Years UI, Dynamic Classes, and Cohort Promotion | Active Roadmap | System Architecture |
| [ROSTER_PROMOTION_WIZARD_SPEC.md](file:///d:/Projects/LMR/doc/plans/ROSTER_PROMOTION_WIZARD_SPEC.md) | Admin Promotion Wizard UI, roll allocation, lateral entries, and rollback engine | Approved Specification | `/admin` Tab: Curriculum & Promotion |
| [SCHOOL_ERP_DATABASE_ARCHITECTURE_GUIDE.md](file:///d:/Projects/LMR/doc/plans/SCHOOL_ERP_DATABASE_ARCHITECTURE_GUIDE.md) | School ERP database architecture, entity relational web, and promotion lifecycle | Canonical Guide | Architectural Foundation |
| [ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md](file:///d:/Projects/LMR/doc/plans/ROSTER_LIFECYCLE_IMPLEMENTATION_PLAN.md) | Multi-year student rosters, SIS/ERP decoupling, cohort promotion, and check constraints | Active Production Blueprint | `students`, `student_enrollments`, `academic_years` |
| [REMINDER_UI_REDESIGN_WITH_STITCH_GOOGLE.md](file:///d:/Projects/LMR/doc/plans/REMINDER_UI_REDESIGN_WITH_STITCH_GOOGLE.md) | Full application UI redesign via **stitch.google.com** and code reapplication | 📝 Queued for Implementation | Full Application UI |
| [2026-10-14-student-terminal-agent-and-tamper-proof-architecture.md](file:///d:/Projects/LMR/doc/plans/2026-10-14-student-terminal-agent-and-tamper-proof-architecture.md) | Student terminal client agent, tamper-proof cryptographic link system & dashboard specification | 🚀 Ready for Implementation | `/terminal`, PowerShell Agent, Live Cockpit |

---

## 📝 Standard Template for New Plans

When creating a new implementation plan in `doc/plans/<feature-name>.md`, structure it as follows:

```markdown
# [Feature Name] — Implementation Plan & Architecture Specification

> **Author**: Antigravity Assistant & User  
> **Status**: Draft | Approved | In Progress | Completed  
> **Date**: YYYY-MM-DD  
> **Target Modules**: (e.g. `app/(dashboard)/...`, `lib/...`, `schema.sql`)

---

## 1. Goal & Context
Brief explanation of the objective, user persona, and institutional context.

## 2. Requirements & Clarifications
Explicit answers gathered from detailed questioning before coding.

## 3. Database & Schema Invariants
Any table modifications, foreign keys, or check constraints required.

## 4. Architecture & UX Flow
Component hierarchy, state flow, server actions, and layout diagrams.

## 5. Phased Execution Steps
- [ ] Phase 1: ...
- [ ] Phase 2: ...
- [ ] Phase 3: ...

## 6. Verification & Testing Checklist
Criteria to verify before marking complete (e.g. `npx tsc --noEmit`, test script).
```
