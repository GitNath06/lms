# Task 35: Student Terminal Client Agent, Tamper-Proof TOFU Handshake & Hardware Telemetry

> **Task ID**: `2026-10-15-task-35-student-terminal-agent-and-hardware-telemetry`  
> **Date**: October 15, 2026  
> **Branch**: `feature/student-terminal-agent`  
> **Target Subsystems**: `/terminal`, `scripts/client-agent/`, `/api/terminal/handshake`, `/terminal/auth`, `workstation-issue-drawer.tsx`, `public.workstations`  
> **Status**: Completed & Verified (12/12 Tests Pass, `tsc` 0 Errors)  

---

## 1. Context & Objectives

In academic computer laboratories (Secondary Class 11, Class 12, and undergraduate labs), students need a friction-free way to report workstation faults (e.g., sticky keyboard keys, broken mouse clicks, missing Turbo C++ or Python, network dropouts) without requiring individual student account logins.

However, raw public URLs (e.g. `/terminal/PC-26`) expose serious spoofing risks:
- Students can alter URL parameters to submit prank reports for adjacent desks.
- Mobile phone users outside the lab could post invalid tickets.
- The Lab In-Charge had zero visibility into physical machine hardware telemetry (CPU, RAM, Drive C storage, OS build, MAC address) to verify whether reported software issues stem from low storage or uninstalled environments.

Following direct operational feedback, we also eliminated major sources of over-engineering:
- **Dropped "Raise Hand"**: In physical labs, students verbally ask questions; a digital button causes spam, requires audio chimes, and pollutes the system.
- **Dropped Mobile QR Scanning**: Phones are forbidden in Class 11/12 labs.
- **Dropped Dead-PC Categories**: Students cannot report from a machine with a black monitor or dead PSU; those belong exclusively to Teacher/In-Charge reporting.
- **Enforced 4 Production Guardrails**:
  1. *Composite Silicon GUID*: Combined Windows `MachineGuid` with physical network adapter MAC address (`$regGuid-$macAddr`) to guarantee 100% uniqueness even across cloned disk images without sysprep.
  2. *LAN Disconnected Fallback*: Local link diagnostic alert box in PowerShell console when Ethernet is unplugged.
  3. *TOFU Hardware Lock*: Trust-On-First-Use binding in `/api/terminal/handshake` to prevent open spoofing, with a "Reset Hardware Lock" button in the Cockpit Drawer.
  4. *Environment-Aware Secure Cookie*: `secure: isProd && isHttps` to prevent cookie drop over local LAN HTTP (`http://192.168.1.x:3000`).

---

## 2. Changes Made & Architecture Delivered

### 2.1 Database Schema Migration
- Added `machine_guid TEXT UNIQUE`, `hardware_specs JSONB DEFAULT NULL`, and `last_seen_at TIMESTAMPTZ DEFAULT NULL` to `public.workstations`.
- Created performance indexes: `idx_workstations_machine_guid` and `idx_workstations_label_lower`.
- Script: `supabase/migrations/20261015_add_workstation_machine_guid_and_specs.sql`.
- Updated TypeScript types in `types/database.ts` and `types/workstations.ts` (`WorkstationHardwareSpecs`).

### 2.2 Cryptographic Token Engine (`lib/security/terminal-token.ts`)
- Stateless HMAC-SHA256 signing for 60-second single-use handshake tickets with `iat` (issued-at ms) and `exp`.
- Signed HttpOnly workstation session tokens (`labsync_terminal_session`).
- Constant-time string and buffer comparisons via `crypto.timingSafeEqual` (`safeEqual`).

### 2.3 API Routes & Authentication Handshake
- **`/api/terminal/handshake` (`route.ts`)**:
  - Validates `computer_name`, `machine_guid`, and `hardware_specs`.
  - Enforces TOFU hardware lock: binds GUID on first enrollment; verifies exact match on subsequent runs; rejects mismatches with HTTP 403.
  - Updates `hardware_specs`, `lan_ip`, and `last_seen_at` in PostgreSQL.
  - Returns 60-second single-use redirect URL: `/terminal/auth?ticket=<token>`.
- **`/terminal/auth` (`route.ts`)**:
  - Validates ticket signature and 60-second expiration.
  - Sets `labsync_terminal_session` HttpOnly cookie (`secure: isProd && isHttps`).
  - Issues HTTP 302 Redirect to clean URL: `/terminal` (ZERO parameters or tokens in address bar).
- **`app/actions/workstations.ts`**:
  - Added `resetWorkstationHardwareLock(workstationId)`: Privileged action allowing the Lab In-Charge to unlock a workstation when a motherboard or NIC is replaced.

### 2.4 Native Windows PowerShell Client Agent
- **`scripts/client-agent/labsync-agent.ps1`**:
  - Visible PowerShell console with color-coded diagnostic logs.
  - WMI/CIM queries for CPU, RAM, Drive C Free/Total, OS build, MAC address, and LAN IP.
  - Handles the offline network paradox: catches connection drops and renders a bold high-visibility alert box instructing the student to notify the teacher verbally.
  - Dispatches handshake and launches the default browser.
- **`scripts/client-agent/setup-labsync.bat`**:
  - 1-click batch installer that copies agent files to `C:\LabSync\` and creates the desktop shortcut **"LabSync Student Portal"**.
- **`scripts/client-agent/config.sample.json`**:
  - Configurable server URL, optional agent secret key, and debug switch.

### 2.5 Student Reporting Portal Redesign
- **`app/terminal/page.tsx`**:
  - Async Server Component reading `labsync_terminal_session` cookie.
  - If authenticated: loads workstation context and renders `StudentTerminalView`.
  - If unauthenticated: renders an institutional "Physical Workstation Authentication Required" card instructing the student to use the desktop shortcut, with a dev-mode simulation bypass.
- **`components/terminal/student-terminal-view.tsx`**:
  - 6 Alive-Only problem categories: Mouse / Keyboard, LAN / Network, Missing Lab Software, App Freeze / Crash, Audio / Headphone, Other.
  - Physical hardware telemetry badge (CPU, RAM, Free C: space, OS, IP).
  - High-density Obsidian UI (`.glass-card`).
  - Zero literal `+` buttons.

### 2.6 Live Cockpit Workstation Drawer Elevation (`workstation-issue-drawer.tsx`)
- High-density **"Hardware Specs & Diagnostics"** card:
  - Processor model & core count.
  - Total RAM installed.
  - Visual Storage gauge (GB Free / GB Total on Drive C:) with low-disk warnings (< 15GB amber, < 5GB rose).
  - OS Caption & Build number.
  - IP and MAC address.
  - Last agent sync timestamp with pulsing green badge.
- **"Reset Hardware Lock"** action button in the drawer footer for technicians replacing hardware.

---

## 3. Verification & Automated Test Results

- **TypeScript Compilation**: `npx tsc --noEmit` &rarr; **0 errors**.
- **Automated Integration Tests**:
  - `tests/terminal-agent-handshake.test.mjs` (5/5 tests pass):
    - Handshake ticket generation and 60s verification.
    - Rejection of tampered signatures and expired tickets.
    - Session token generation and verification.
    - Timing-safe comparisons.
    - Database TOFU lifecycle (initial binding, matching update, mismatch rejection, reset unbind).
  - `tests/phase1-student-terminal.test.mjs` (7/7 tests pass):
    - Schema integrity for `workstations` and `workstation_issues`.
    - 6 Alive-Only domain model issue chips.
    - Pure async server action RPC exports (Rule 13).
    - Anti-spoofing verification engine.
    - Student reporting and Live Cockpit beacon integration.
    - UI architecture verification.
- **Overall Suite**: **12 passed, 0 failed, 0 skipped**.
