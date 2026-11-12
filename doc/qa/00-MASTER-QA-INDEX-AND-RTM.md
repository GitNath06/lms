# LabSync LIMS — Master IEEE 29119 QA Specification Suite & RTM
## ISO/IEC/IEEE 29119-3 Compliant Software Test Documentation & Verification Matrix

> **Document Reference**: `LMR-QA-RTM-2026-V1`  
> **Standard**: ISO/IEC/IEEE 29119-3 (Test Documentation), IEEE 829 (Test Plans & Specifications)  
> **Target System**: LabSync LIMS (Institutional Laboratory Management & Practical Roll-Call System)  
> **Authoritative Baseline**: Next.js 16 (App Router), React 19, Supabase PostgreSQL, PWA Service Worker v2, IndexedDB SWR Engine  
> **Status**: ACTIVE & CANONICAL  
> **Last Updated**: 2026-11-12

---

## 1. Executive Standards & 4-Layer Engineering Proof Framework

This document and its companion volumes (`VOL-1` through `VOL-6`) define the authoritative, zero-fluff enterprise verification contract for the entire LabSync LIMS codebase. Surface-level QA checklists (e.g., *"Verify the button works"*) are strictly prohibited. 

Every single test case in this suite adheres to the **IEEE 29119 4-Layer Engineering Proof Framework**, requiring concrete mathematical, state, network, and database proofs:

```
+--------------------------------------------------------------------------------------------------+
|                     IEEE 29119 4-LAYER ENGINEERING PROOF ARCHITECTURE                            |
+--------------------------------------------------------------------------------------------------+
| LAYER 1: UI, ERGONOMICS & BOUNDING-BOX GEOMETRY PROOF                                            |
|   * DOM Rect Math: elA.getBoundingClientRect().right <= elB.getBoundingClientRect().left - delta |
|   * Mobile Clearance: submitBtn.bottom <= bottomNav.top - 16 (Safe area pb-28 clearance)         |
|   * Zero Horizontal Overflow: document.documentElement.scrollWidth <= window.innerWidth         |
|   * Touch Targets: min-h-[44px] / min-w-[44px] on all clickable interactive mobile nodes        |
+--------------------------------------------------------------------------------------------------+
| LAYER 2: CLIENT RAM CACHE & INDEXEDDB SWR PROOF                                                  |
|   * Frame-1 Synchronous Hydration: getCachedQuery() returns synchronously with 0 skeleton flicker|
|   * Storage Isolation: UID-scoped IndexedDB (labsync_enterprise_idb.query_snapshots)             |
|   * Outbox Guarantees: Mutation queue persistence across page reloads and tab closures           |
+--------------------------------------------------------------------------------------------------+
| LAYER 3: NETWORK & SERVER ACTION REVALIDATION PROOF                                              |
|   * Service Worker Routing: sw.js guarantees text/html fallback, strictly isolated from RSC      |
|   * Idempotency Defense: Unique UUID v4 idempotency_key prevents duplicate writes on replay      |
|   * RBAC Protocol: Cryptographic HMAC session claims rejected instantly on role mismatch         |
+--------------------------------------------------------------------------------------------------+
| LAYER 4: POSTGRESQL DATABASE & AUDIT INVARIANT PROOF                                             |
|   * Atomic PostgreSQL Transactions: Live table rows, foreign key cascade, check constraint checks|
|   * Double-Entry Audit Ledger: public.audit_ledger JSONB before_state / after_state diff proofs  |
|   * Concurrency Lock: Database-level exclusion of conflicting timetable and session reservations |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Mandatory 8-Field Test Case Schema

Every test case throughout Volumes 1 through 6 enforces the following 8 fields without exception:

| Field # | Field Name | Engineering Definition & Verification Requirement |
| :---: | :--- | :--- |
| **1** | **Test ID & Classification Tag** | Unique hierarchical ID (e.g., `TC-VOL1-001`) tagged strictly as `[MANUAL-DEVICE]` (Vivo V23 5G / Physical Phone), `[AUTO-E2E-GEOMETRY]` (Playwright / Cypress DOM math), or `[AUTO-DB-INTEGRATION]` (Node / SQL pipeline). |
| **2** | **Exact Target Files** | Specific file paths: Route (`app/**/page.tsx`), Component (`components/**/*.tsx`), Hook (`hooks/*.ts`), Library (`lib/**/*.ts`), and Server Action function name (`app/actions/*.ts`). |
| **3** | **Preconditions & RBAC Matrix** | User role required (`super_admin`, `hod`, `lab_incharge`, `teacher` [assigned vs unassigned], `unauthenticated`), approval status (`approved`, `pending`, `rejected`), network state (Online 4G, Slow 3G, Offline Airplane), and viewport width (393px, 768px, 842px, 1106px, 1280px, 1686px). |
| **4** | **Sequential Step-by-Step Path** | Exact sequence of clicks, form entries, keyboard hotkeys (`Ctrl+K`, `Enter`, `Escape`), swipe gestures, and transitions. |
| **5** | **Combinatorial & Edge Permutations** | Validation under invalid payloads, boundary values, rapid double-clicks (50ms gap), offline disconnection mid-action, empty datasets, and concurrent conflict triggers. |
| **6** | **Layer 1: UI & Geometry Proof** | Explicit DOM coordinate math (`getBoundingClientRect()`), computed CSS values, element presence/absence, color contrast, and zero horizontal scrollbar assertions. |
| **7** | **Layer 2 & 3: Cache & Network Proof** | SWR cache hit confirmation, Frame-1 hydration assertions, Service Worker fetch intercept verification, HTTP response status codes, and Server Action return contracts. |
| **8** | **Layer 4: PostgreSQL & Audit Invariant** | Explicit SQL queries, expected row counts, column assertions, check constraint validations, and `public.audit_ledger` JSONB diff records. |

---

## 3. System Architecture & Inventory Mapping

The LabSync LIMS production codebase consists of **31 Page & API Routes**, **31 Server Action Modules (230 Exported Functions)**, **121 UI Components**, **13 Custom Hooks**, and **64 Core Libraries**.

### 3.1 Volume Scope Allocation

```
+---------------------------------------------------------------------------------------------------+
| VOL-1: Auth, Security Proxy, Shell Layout, Navigation & Executive Dashboard                       |
|   File: doc/qa/VOL-1-AUTH-SHELL-NAVIGATION.md (30 Test Cases: TC-VOL1-001 - TC-VOL1-030)         |
|   Routes: /login, /, layout.tsx                                                                   |
|   Actions: auth.ts, otp.ts, profile-credentials.ts, profile.ts, notifications.ts, incidents.ts    |
|   Components: layout/*, dashboard/*, profile/*, pwa/*, ui/*                                       |
+---------------------------------------------------------------------------------------------------+
| VOL-2: Live Lab Cockpit, CAD Floor Engine, Seat Planning & Student Workstation Terminals          |
|   File: doc/qa/VOL-2-LIVE-LAB-AND-TERMINALS.md (30 Test Cases: TC-VOL2-001 - TC-VOL2-030)         |
|   Routes: /computer-lab, /computer-lab/projector, /terminal, /terminal/pair, /terminal/[code]    |
|   Actions: live-session.ts, seat-plans.ts, terminal.ts, terminal-simulator.ts, floor-elements.ts  |
|   Components: computer-lab/*, terminal/*, dev/*                                                   |
+---------------------------------------------------------------------------------------------------+
| VOL-3: Master Timetable Routine, 3-Way Conflict Engine, Faculty Substitutions & Lab Facilities    |
|   File: doc/qa/VOL-3-SCHEDULES-AND-SUBSTITUTIONS.md (25 Test Cases: TC-VOL3-001 - TC-VOL3-025)    |
|   Routes: /schedules                                                                              |
|   Actions: schedules.ts, substitutions.ts, holidays.ts, settings.ts, labs.ts, notifications.ts    |
|   Components: schedules/*, calendar/*                                                             |
+---------------------------------------------------------------------------------------------------+
| VOL-4: Practical Logbook, Equipment Incidents, Preventive Maintenance & Print Engines             |
|   File: doc/qa/VOL-4-RECORDS-INCIDENTS-MAINTENANCE-PRINT.md (35 Test Cases: TC-VOL4-001 - 035)    |
|   Routes: /records, /records/new, /records/incidents, /incidents, /maintenance/*, /print/* (5)    |
|   Actions: logs.ts, records.ts, incidents.ts, maintenance.ts, maintenance-fleet.ts, workstations.ts|
|   Components: records/*, incidents/*, maintenance/*, print/*                                      |
+---------------------------------------------------------------------------------------------------+
| VOL-5: Institutional Administration, Rosters, Analytics Suite & Profile Security                  |
|   File: doc/qa/VOL-5-ADMIN-ROSTERS-ANALYTICS-PROFILE.md (35 Test Cases: TC-VOL5-001 - TC-VOL5-035)  |
|   Routes: /admin, /analytics, /profile                                                            |
|   Actions: academic-years.ts, students.ts, classes.ts, subjects.ts, roster-ingestion.ts,          |
|            archive-hub.ts, audit.ts, institutional-reports.ts, profile.ts, profile-credentials.ts |
|   Components: admin/*, analytics/*, profile/*                                                     |
+---------------------------------------------------------------------------------------------------+
| VOL-6: PWA Engine, Service Worker Isolation, Offline Outbox & Sub-50ms Performance                |
|   File: doc/qa/VOL-6-PWA-OFFLINE-CACHE-PERFORMANCE.md (25 Test Cases: TC-VOL6-001 - TC-VOL6-025)  |
|   Infrastructure: public/sw.js, public/offline.html, app/manifest.ts, lib/offline/*               |
|   Actions: bootstrap.ts, lib/cache/client-query-cache.ts, lib/db.ts, lib/security/session-claim.ts|
|   Components: pwa/*, dev/*                                                                        |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Master Requirements Traceability Matrix (RTM)

### 4.1 Route & Volume Traceability

| Route Path | Type | Primary Controller / Component | Volume | Test Case Range | Primary Verification Focus |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `app/(auth)/login/page.tsx` | Route | `LoginPageContent` | VOL-1 | `TC-VOL1-001` - `008` | Email/password, 6-digit OTP, demo login, rate limit, offline rejection |
| `app/(dashboard)/layout.tsx` | Layout | `DashboardLayout`, `MobileNav` | VOL-1 | `TC-VOL1-009` - `024` | Responsive shell, 2-group header, zero invisible wall, bottom dock |
| `app/(dashboard)/page.tsx` | Route | `DashboardExecutiveView` | VOL-1 | `TC-VOL1-025` - `030` | KPI summary cards, live pod telemetry, quick actions, incident cards |
| `app/(dashboard)/computer-lab/page.tsx` | Route | `ComputerLabWorkspace` | VOL-2 | `TC-VOL2-001` - `015` | Live session cockpit, 2D floor CAD, tactical aisle deck, wake lock |
| `app/(dashboard)/computer-lab/projector/page.tsx` | Route | `ProjectorView` | VOL-2 | `TC-VOL2-016` - `018` | Fullscreen wall projector mode, high-contrast roll-call, anonymized names |
| `app/terminal/page.tsx` | Route | `TerminalStudentPortal` | VOL-2 | `TC-VOL2-019` - `021` | Student workstation node, active practical topic, distress beacon |
| `app/terminal/pair/page.tsx` | Route | `WorkstationPairingScreen` | VOL-2 | `TC-VOL2-022` - `025` | Hardware MAC/UUID anti-spoof handshake, pairing key authorization |
| `app/terminal/[code]/page.tsx` | Route | `DirectTerminalScreen` | VOL-2 | `TC-VOL2-026` - `030` | Station kiosk pairing, time-travel simulator, student hand-raise queue |
| `app/(dashboard)/schedules/page.tsx` | Route | `ScheduleGridClient` | VOL-3 | `TC-VOL3-001` - `010` | Sunday-Friday academic timetable, drag-drop, slot conflict detector |
| `app/api/cron/reminders/route.ts` | Route | Daily Reminder Cron | VOL-3 | `TC-VOL3-024` - `025` | Automated teacher reminder cron execution and holiday notice broadcasts |
| `app/(dashboard)/records/page.tsx` | Route | `PracticalRecordsPage` | VOL-4 | `TC-VOL4-001` - `003` | Filterable logbook, SWR hydration, pagination, grouping, XLSX export |
| `app/(dashboard)/records/new/page.tsx` | Route | `NewPracticalLogForm` | VOL-4 | `TC-VOL4-004` - `006` | Attendance tally, absent roll pills, sticky footer dock clearance |
| `app/(dashboard)/records/incidents/page.tsx` | Route | `IncidentRecordsPage` | VOL-4 | `TC-VOL4-011` - `012` | Incident register table, severity filters, fine assessment, detail drawer |
| `app/(dashboard)/incidents/page.tsx` | Route | `IncidentsPageClient` | VOL-4 | `TC-VOL4-013` - `018` | HOD escalation workflow, repair status tracker, resolution notes |
| `app/(dashboard)/maintenance/page.tsx` | Route | `MaintenanceWorkbench` | VOL-4 | `TC-VOL4-019` - `023` | Preventive routine checklist, certified servicing logbook, snooze alerts |
| `app/(dashboard)/maintenance/workstations/page.tsx` | Route | `WorkstationsDiagnostics` | VOL-4 | `TC-VOL4-024` - `028` | CAD layout editor, fleet status triage, MTBF/MTTR tracking |
| `app/(dashboard)/print/daily-log/page.tsx` | Route | `DailyLogPrintPage` | VOL-4 | `TC-VOL4-030` - `030` | NEB A4 landscape daily practical attendance register |
| `app/(dashboard)/print/records/page.tsx` | Route | `RecordsPrintPage` | VOL-4 | `TC-VOL4-031` - `031` | Filtered batch practical records ledger with 3-tier signature block |
| `app/(dashboard)/print/incidents/page.tsx` | Route | `IncidentsPrintPage` | VOL-4 | `TC-VOL4-032` - `032` | Equipment breakage damage ledger with legal witness sign-offs |
| `app/(dashboard)/print/maintenance/page.tsx` | Route | `MaintenancePrintPage` | VOL-4 | `TC-VOL4-033` - `033` | Certified technical service logbook sheet |
| `app/(dashboard)/print/seating-chart/page.tsx` | Route | `SeatingChartPrintPage` | VOL-4 | `TC-VOL4-034` - `034` | Official classroom wall seating plan with student registration numbers |
| `app/api/export/[type]/route.ts` | Route | Export Stream Endpoint | VOL-4 | `TC-VOL4-035` - `035` | Streaming XLSX workbook & CSV binary downloads |
| `app/(dashboard)/admin/page.tsx` | Route | `SuperAdminCenter` | VOL-5 | `TC-VOL5-001` - `025` | Multi-year cohort promotion, roster parser, trash bin purge, user RBAC |
| `app/(dashboard)/analytics/page.tsx` | Route | `InstitutionalAnalytics` | VOL-5 | `TC-VOL5-026` - `030` | NEB 75% board exam compliance, faculty sign-off ledger, syllabus quota |
| `app/(dashboard)/profile/page.tsx` | Route | `ProfileClientView` | VOL-5 | `TC-VOL5-031` - `035` | Avatar upload/crop, password change, dual-OTP email update |
| `public/sw.js` | Service Worker | Next.js 16 SW v2 | VOL-6 | `TC-VOL6-006` - `010` | HTML vs RSC flight cache isolation, server action bypass |
| `app/manifest.ts` | PWA Manifest | WebAPK Manifest | VOL-6 | `TC-VOL6-001` - `005` | Standalone display mode, status bar theme, home screen shortcuts |

---

### 4.2 Server Action & Volume Allocation

| Action File (`app/actions/*.ts`) | Exported Functions | Volume | Verification Coverage Scope |
| :--- | :---: | :---: | :--- |
| `auth.ts` | 16 | VOL-1, VOL-6 | Authentication, session invalidation, user administration, photo upload |
| `otp.ts` | 4 | VOL-1 | 6-digit cryptographic OTP generation, SMS/Email delivery, verification |
| `profile-credentials.ts` | 3 | VOL-1 | Current password verification, dual-OTP email change transaction |
| `profile.ts` | 2 | VOL-1 | Faculty biographical update, avatar compression pipeline |
| `notifications.ts` | 8 | VOL-1 | Automated cron dispatchers for reminders, skipped classes, email engine |
| `incidents.ts` | 8 | VOL-1, VOL-3 | Incident reporting, HOD escalation, notification mark-as-read/clear |
| `live-session.ts` | 4 | VOL-2 | Live cockpit context, ad-hoc class creation, submission, seat override |
| `seat-plans.ts` | 10 | VOL-2 | Class seat mapping, 1-tap swap, auto-arrange, session seat overrides |
| `terminal.ts` | 9 | VOL-2 | Kiosk pairing, unpairing, student assistance queue, issue tickets |
| `terminal-simulator.ts` | 10 | VOL-2 | Hardware anti-spoof handshake, mass swarm boot, distress beacons |
| `floor-elements.ts` | 3 | VOL-2, VOL-5 | CAD floor elements (doors, windows, boards, pillars, teacher podium) |
| `logs.ts` | 8 | VOL-3 | Practical log submission, roll attendance tally, idempotency key defense |
| `records.ts` | 9 | VOL-3 | SWR cached records queries, print selection sessions, XLSX exports |
| `institutional-reports.ts` | 8 | VOL-3, VOL-5 | NEB board compliance ledger, syllabus progress, faculty audit trail |
| `schedules.ts` | 9 | VOL-4 | Timetable slot creation, merge/split routine periods, timetable reset |
| `substitutions.ts` | 3 | VOL-4 | Faculty absence substitution dispatch, timetable overlay updates |
| `holidays.ts` | 4 | VOL-4 | Academic calendar holidays, Bikram Sambat festival recess policies |
| `settings.ts` | 5 | VOL-4 | Institutional operational settings, bell schedule time slot editor |
| `maintenance.ts` | 8 | VOL-5 | Preventive routine plans, technical service logs, overdue alert snooze |
| `maintenance-fleet.ts` | 6 | VOL-5 | Machine fleet servicing checklist, batch terminal state update |
| `maintenance-templates.ts` | 4 | VOL-5 | Routine maintenance presets (BIOS, Thermal Paste, OS Imaging) |
| `workstations.ts` | 21 | VOL-5 | Hardware layout coordinates, issue ticket lifecycle, pairing keys |
| `academic-years.ts` | 12 | VOL-6 | Multi-year cohort promotion, atomic batch rollback, academic year CRUD |
| `students.ts` | 16 | VOL-6 | Student enrollments, roll resequencing, bulk archive, avatar batching |
| `classes.ts` | 5 | VOL-6 | Class grade & stream management, weekly practical quota definitions |
| `subjects.ts` | 7 | VOL-6 | Curricular subjects, class-subject allocation, weekly quota checks |
| `roster-ingestion.ts` | 5 | VOL-6 | Multi-stream CSV/XLSX parser, newcomer dry-run validation, commit |
| `archive-hub.ts` | 7 | VOL-6 | Unified trash recovery bin, permanent purge guard, item restoration |
| `labs.ts` | 4 | VOL-6 | Laboratory facility lifecycle, status check constraints (`Operational`) |
| `audit.ts` | 2 | VOL-6 | Immutable audit ledger query, client-side sensitive action logging |
| `bootstrap.ts` | 1 | VOL-1, VOL-6 | Initial institutional data bootstrap, seed validation |

---

## 5. Master QA Execution & Device Compatibility Matrix

All test cases must be verified across the following authoritative hardware matrix before signing off on any production deployment:

```
+---------------------------------------------------------------------------------------------------------+
|                               DEVICE & VIEWPORT VERIFICATION TIERS                                      |
+-------------------+----------------+----------------+---------------------+-----------------------------+
| Device Category   | Viewport (CSS) | Screen Mode    | Browser Engine      | Critical Architecture Guard |
+-------------------+----------------+----------------+---------------------+-----------------------------+
| Tier 1: Smartphone| 393 × 873 px   | Standalone PWA | Chromium / WebKit   | * Zero horizontal overflow  |
| (Vivo V23 5G)     |                | & Mobile Chrome| (Android 14)        | * pb-28 bottom dock spacing |
|                   |                |                |                     | * 48px touch targets        |
+-------------------+----------------+----------------+---------------------+-----------------------------+
| Tier 2: Small     | 768 × 858 px   | Standard / Split| Chromium / iPadOS  | * Left sidebar takes 256px  |
| Tablet (iPad Mini)|                | Desktop        | WebKit (Safari)     | * Header has only 512px     |
|                   |                |                |                     | * User text hidden xl:flex  |
+-------------------+----------------+----------------+---------------------+-----------------------------+
| Tier 3: Mid-Tier  | 842 × 858 px & | Windowed / Split| Chromium / Firefox | * Date pill hides live sec  |
| Laptop / Tablet   | 1106 × 858 px  | Screen         | (Windows 11 / macOS)| * Zero invisible wall cut   |
|                   |                |                |                     | * Status badge compact BREAK|
+-------------------+----------------+----------------+---------------------+-----------------------------+
| Tier 4: Desktop   | 1280 × 800 px  | Fullscreen     | Chromium / Gecko    | * Shows user name + role    |
| Workspace         | to 1920 × 1080 | Desktop        | (Windows 11 / Linux)| * Inline live status dot    |
|                   |                |                |                     | * Full CAD workstation map  |
+-------------------+----------------+----------------+---------------------+-----------------------------+
```

---

## 6. Execution Status & Traceability Sign-Off Tracker

| Volume | Title | Total TCs | Automated | Manual | Status | Sign-off Date |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **VOL-1** | Authentication, Shell, Navigation & Executive Dashboard | 30 | 22 | 8 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **VOL-2** | Live Lab Cockpit, CAD 2D/3D Floor, Seat Planner & Terminals | 30 | 20 | 10 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **VOL-3** | Master Timetable Grid, Triple-Collision Defense & Substitutions | 25 | 19 | 6 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **VOL-4** | Practical Records, Damage Incident Register, Maintenance & High-Fidelity Print | 35 | 25 | 10 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **VOL-5** | Super-Admin Console, Cohort Rosters, Analytics & Technical Biographies | 35 | 27 | 8 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **VOL-6** | Progressive Web App, Service Worker, Offline Engine & Performance SLAs | 25 | 18 | 7 | **COMPLETE & SIGNED OFF** | 2026-11-12 |
| **TOTAL** | **Comprehensive Institutional System Coverage** | **180** | **131** | **49** | **COMPLETE & SIGNED OFF** | **2026-11-12** |

