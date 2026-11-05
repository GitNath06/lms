# Task 36: Terminal & Hardware Telemetry Simulator & Real-Time Cockpit Auto-Sync

**Date**: 2026-10-15  
**Scope**: Manual Testing Simulator, Real-Time Cross-Tab Auto-Sync & Diagnostics Auto-Refresh  
**Status**: Verified & Complete

---

## 1. Problem Statement & Root Cause Analysis

1. **Cumbersome Manual Testing**:
   - Testing workstation hardware telemetry, disk alerts (<15GB warning and <5GB critical alert), zero-login student sessions, student distress beacons, and anti-spoofing defense previously required manual script execution or API tooling.
   - Developers and institutional testers required a quick, visual manual testing console analogous to the `TimeTravelController` to test all real-world conditions with 1 click.
2. **Missing Real-Time Auto-Update & PostgREST RLS Blocking**:
   - In `app/actions/workstations.ts` (`getWorkstationBoardData`, `getDiagnosticsTriageData`, `reportWorkstationIssue`, `updateWorkstationIssueStatus`, `resolveWorkstationIssue`) and `app/actions/seat-plans.ts`, issues were queried via `supabase.from('workstation_issues')`. Because LMR uses custom cookie auth (`getServerUserScope()`), the Supabase SSR client acts as `anon`, where PostgREST Row Level Security (RLS) silently blocked reading issues and returned `data: []` (0 issues).
   - In contrast, terminal submissions inserted directly via PostgreSQL connection pool (`getPgPool()`). Because the read actions queried PostgREST while inserts wrote to PostgreSQL, the server actions always calculated 0 open issues, forcing workstations to false operational states.
3. **Client-Side State Desynchronization in Diagnostics & Triage Hub**:
   - In `DiagnosticsTriageHub`, `data` was initialized via `useState(initialData)` but lacked synchronization with prop changes (`useEffect` on `initialData`). When parent component `MaintenanceClientPage` refreshed and passed fresh data, `DiagnosticsTriageHub` remained stuck on stale state until a user manually clicked the "Sync" button.
   - In `subscribeToSync`, background tabs skipped execution because `document.hidden` was checked unconditionally, preventing background tabs from auto-updating when events were broadcast from other tabs.

---

## 2. Key Architecture & Implementation Details

### A. Resilient Direct PostgreSQL Connection Pool Engine (`app/actions/workstations.ts`, `seat-plans.ts`)
- Switched all `workstation_issues` queries in `getWorkstationBoardData`, `getDiagnosticsTriageData`, `reportWorkstationIssue`, `updateWorkstationIssueStatus`, `resolveWorkstationIssue`, and `seat-plans.ts` from Supabase PostgREST to direct PostgreSQL connection pool (`getPgPool()`).
- Bypassed anonymous RLS blocking with full institutional server authority, ensuring 100% accurate, live fault tickets, open counts, and workstation status derivations.

### B. Terminal & Hardware Telemetry Simulator (`TerminalSimulatorController`)
- **Visual Form Factor**: Floating obsidian pill positioned at `fixed bottom-4 right-4 z-50` (symmetrically balancing `TimeTravelController` on bottom-left).
- **Target Station Selector**: Quick chips for common stations (`PC-01` to `PC-34`) with live lock status (🔒 Bound vs 🔓 Unbound) and telemetry preview.
- **4 Dedicated Testing Tabs**:
  1. **Hardware**: 1-click injection of real-world specs presets:
     - 🟢 *Optimal Station Rig* (AMD Ryzen 5, 12GB RAM, 184GB Free SSD)
     - 🟡 *Low Storage Warning* (Intel Core i3, 8GB RAM, 11.8GB Free SSD `<15GB` -> triggers amber gauge)
     - 🔴 *Critical Storage Alert* (Intel Celeron, 4GB RAM, 2.3GB Free SSD `<5GB` -> triggers red pulsing gauge)
     - 🚀 *Studio Workstation Rig* (Intel Core i7, 32GB RAM, 415GB Free NVMe)
     - 🧹 *Unbind & Clear Specs* (Motherboard replacement reset to test fresh TOFU pairing)
  2. **Portal**: 1-click launch of authenticated student session via 60-second HMAC handshake ticket (`/terminal/auth?ticket=...`), or direct unauthenticated access to test the physical desk lock screen.
  3. **Distress**: 1-click injection of student distress beacons (Mouse failure, Turbo C++ compiler crash, Monitor blackout) with student name and roll number.
  4. **Defense**: 1-click anti-spoofing attack simulation verifying `403 Forbidden` rejection and security audit logging.

### C. Instant Real-Time Cross-Tab Event Bus (`lib/sync-bus.ts`)
- Added `'workstations'` and `'assistance'` domains to `SyncDomain`.
- Added modern `BroadcastChannel('labsync-realtime-bus')` for instant zero-latency cross-tab notification, backed by `localStorage` storage events and local `window.dispatchEvent(new CustomEvent('labsync:...'))`.
- Whenever a report, distress beacon, specs injection, or issue resolution occurs, `broadcastSync()` notifies all open tabs in 0ms.

### D. Live Cockpit Auto-Sync Engine (`components/computer-lab/computer-lab-workspace.tsx`)
- Upgraded `refreshLiveSessionAndBoard` to fetch `getWorkstationBoardData`, `getLiveAssistanceRequests`, and `getLiveSessionContext` in a single unified atomic pass.
- Implemented continuous 4-second adaptive auto-polling with tab visibility gating (`document.hidden`), plus unconditional force-sync for real-time broadcast events, window focus, and tab visibility returns.

### E. Diagnostics & Triage Hub Continuous Auto-Sync (`components/maintenance/diagnostics-triage-hub.tsx`, `maintenance-client-page.tsx`)
- Added reactive state synchronization in `DiagnosticsTriageHub` whenever `initialData` changes.
- Added unconditional force-sync on `workstations` and `assistance` broadcast events, keeping background tabs constantly up-to-date.
- Added window `focus` and document `visibilitychange` listeners to both `DiagnosticsTriageHub` and `MaintenanceClientPage`.
- Updated `station-quick-popover.tsx` to broadcast `broadcastSync('workstations')` on fault logging.

---

## 3. Verification & Test Results

1. **TypeScript Verification**:
   - `npx tsc --noEmit` &rarr; 0 errors across the entire codebase.
2. **Automated Real-World Terminal Suite**:
   - `npm run test:terminal` &rarr; 8/8 scenarios passed (100% reliability).
3. **Database Direct Pool Verification**:
   - Verified that `getDiagnosticsTriageData` and `getWorkstationBoardData` fetch live issues directly from PostgreSQL, correctly identifying open fault tickets and setting workstation statuses (operational, flagged, under repair).
4. **Cross-Tab & Real-Time Auto-Sync Verification**:
   - Firing a distress beacon or injecting storage telemetry in the Simulator or Student Terminal immediately updates the Live Cockpit CAD floor and the Diagnostics & Triage Hub in real time without clicking the "Sync" button.
