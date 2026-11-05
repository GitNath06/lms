# Task 98: Terminal Cryptographic Hardware Binding & Auto-Deploy Agent

**Date**: 2026-11-02  
**Status**: Completed  
**Branch**: `feature/student-terminal-agent`  
**Target Subsystems**: `/terminal/[code]`, `/terminal`, `/api/terminal/handshake`, `/api/terminal/launch`, `scripts/client-agent/`, `/admin`  

---

## 1. Context & Operational Purpose

Prior to this task, student terminal URLs like `/terminal/PC-23` were open to direct browser access, allowing students on personal devices or neighboring desks to open any workstation terminal, claim false attendance, and submit unverified assistance requests. Furthermore, there was no downloadable setup installer in the administrative console to configure physical laboratory machines.

Task 98 establishes a hardware-anchored security perimeter:
1. **Zero Spying & Zero Background Overhead**: The client agent runs for only ~1.5 seconds on boot (or when clicking the Desktop shortcut), extracts hardware specs once, performs cryptographic enrollment, and exits.
2. **Immutable Silicon Binding (TOFU)**: Binds workstation records in PostgreSQL to physical computers via a composite silicon GUID (`Motherboard UUID + Registry MachineGuid + Physical Adapter MAC`), preventing disk clone collisions and virtual adapter spoofing.
3. **Hardened Route Guard**: `/terminal/[code]` strictly blocks unauthenticated or mismatched browsers, rendering an informative "Physical Workstation Authentication Required" guard screen.
4. **1-Click Admin Downloader & Hardware Reset**: Adds a "Download Lab Agent (.bat)" generator in `/admin` with a self-contained Base64-unpacked installer, alongside a "Reset Hardware Binding" control per workstation in the CAD Inspector Drawer.

---

## 2. Key Architecture & Implemented Files

### 1. Cryptographic Handshake Engine (`lib/security/terminal-handshake.ts` & `app/api/terminal/handshake/route.ts`)
- Implements `processTerminalHandshake(payload, clientIp, agentKeyHeader, origin)`.
- Scopes workstation lookups by `(lab_id, label)` to prevent multi-room collisions.
- Validates institutional pairing token / `x-labsync-agent-key` during initial TOFU enrollment and subsequent boots.
- Enforces TOFU hardware lock: unbound desks bind to the physical GUID; already-bound desks reject mismatched silicon identifiers with `403 Forbidden`.
- Writes boot-once hardware specs (`cpu`, `cpu_cores`, `ram_gb`, `disk_c_total_gb`, `disk_c_free_gb`, `disk_c_used_pct`, `os_caption`, `os_build`, `mac_address`, `lan_ip`) and records audit ledger events (`TOFU_HARDWARE_LOCK_ENROLLED`).
- Issues a 60-second single-use HMAC handshake ticket.

### 2. Launch Ticket Redemption Route (`app/api/terminal/launch/route.ts` & `app/terminal/auth/route.ts`)
- Redeems single-use handshake ticket and verifies against replay attacks in PostgreSQL `public.rate_limit_events`.
- Sets 12-hour HttpOnly session cookie `labsync_terminal_session` (`sameSite: 'strict'`, `path: '/'`, `maxAge: 43200`, `secure: isProd && isHttps`).
- Sets dual-compatibility alias cookie `labsync_terminal_auth`.
- Redirects 302 cleanly to `/terminal/[stationCode]`, removing tokens from the browser URL address bar.

### 3. Hardened Student Terminal Route Guard (`app/terminal/[code]/page.tsx` & `components/terminal/unverified-terminal-screen.tsx`)
- Server-side inspection of `getActiveTerminalSession()`.
- Verifies session is authenticated, verifies `session.stationCode === code`, and verifies `session.machineGuid === workstation.machine_guid`.
- Renders `<UnverifiedTerminalScreen />` if unverified, providing 3-step instructions to launch via the physical desktop shortcut.
- Updates root `/terminal/page.tsx` to redirect authenticated sessions directly to their bound station.

### 4. Clone-Safe & Virtual-NIC-Safe Windows Client Agent (`scripts/client-agent/labsync-agent.ps1`)
- Extracts `hwUuid` (motherboard UUID via `Win32_ComputerSystemProduct`), `regGuid` (registry `MachineGuid`), and physical adapter MAC (`Get-NetAdapter -Physical`).
- Reads configuration from `C:\ProgramData\LabSync\config.json`.
- Runs silently in under 2 seconds, connects to `/api/terminal/handshake`, launches the authenticated browser session, and terminates.
- Includes built-in network link diagnostics if the campus server is unreachable.

### 5. Self-Contained Batch Installer (`scripts/client-agent/Setup-LabTerminal.bat`)
- UAC self-elevation (`powershell -Verb runAs`).
- Auto-normalizes computer names (e.g. `PC01` -> `PC-01`) or prompts once for station number.
- Provisions `C:\ProgramData\LabSync\`, writes `config.json`, and installs shortcuts into `%PUBLIC%\Desktop` (All Users) and `%CommonStartup%` (Windows Startup).
- Target: `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\LabSync\labsync-agent.ps1"`.

### 6. Admin Downloader & Hardware Reset Controls (`/admin`)
- Route Handler `app/api/terminal/agent/download/route.ts`: Embeds Base64-encoded `labsync-agent.ps1` directly into `Setup-LabTerminal.bat` so it functions as a 100% self-contained file on standalone USB flash drives.
- Modal `components/admin/agent-download-modal.tsx`: Pre-fills LAN server URL, supports lab room selection, and includes 1-click PowerShell command copy.
- CAD Floor Architect Toolbar (`components/admin/admin-floor-architect.tsx`): Integrates "Download Lab Agent" button.
- CAD Inspector Drawer (`components/admin/cad-inspector-drawer.tsx`): Displays hardware binding status, masked GUID, CPU/RAM telemetry, and "Reset Hardware Binding" button calling `resetWorkstationHardwareLock(workstation.id)`.

---

## 3. Verification & Compliance Evidence

1. **Automated Unit & Integration Test Suite**:
   ```bash
   node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/terminal-agent-handshake.test.mjs
   ```
   **Output**:
   - `ok 1 - Handshake Ticket: Generates valid HMAC ticket and verifies within 60s`
   - `ok 2 - Handshake Ticket: Rejects tampered signature and expired tickets`
   - `ok 3 - Session Token: Generates and verifies HttpOnly workstation session token`
   - `ok 4 - Timing-Safe Comparison: Evaluates equality securely`
   - `ok 5 - Database TOFU Lifecycle: First pairing binds, match updates, mismatch rejected, reset clears`
   - `ok 6 - Handshake Processing: Enforces token requirement, TOFU binding, spec discovery, and mismatch rejection`
   - `ok 7 - Launch Redemption & Replay Defense: Single-use ticket converts to 12h session token and denies replay`
   - **Result**: `7 passed, 0 failed`.

2. **Regression Test Suite**:
   ```bash
   node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase1-student-terminal.test.mjs
   ```
   **Result**: `7 passed, 0 failed`.

3. **Strict TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   **Result**: `Exit code 0 (0 errors across entire repository)`.

4. **Institutional Invariants Verified**:
   - Rule #1: Zero literal `+` characters in UI button labels.
   - Rule #13: Server actions only export `async function`s.
   - Rule #19: Workstation status is dynamically derived from `workstation_issues`.

---

## 4. Post-Flight Addendum: Remote Download Authentication & Token Embedding

- **Diagnostic / Root Cause**: Direct PowerShell commands (`Invoke-WebRequest -Uri "http://localhost:3000/api/terminal/agent/download?labId=comp"`) do not carry browser cookies. When `/api/terminal/agent/download` strictly evaluated `getServerUserScope()`, unauthenticated CLI downloads were rejected with `403 Forbidden`, causing `Start-Process "$env:TEMP\Setup-LabTerminal.bat"` to fail with `"The system cannot find the file specified"`.
- **Remediation**:
  1. Updated `/api/terminal/agent/download/route.ts` to support dual-channel authentication:
     - Institutional token verification via query string (`?token=...` / `?pairingToken=...`) or `X-LabSync-Agent-Key` header (using `safeEqual`).
     - Localhost development loopback bypass (`process.env.NODE_ENV !== 'production' && hostname === 'localhost'`).
     - Standard authenticated admin cookie fallback for in-browser downloads.
  2. Added `getInstitutionalPairingKey` server action in `app/actions/workstations.ts` (strictly compliant with Rule #13).
  3. Updated `components/admin/agent-download-modal.tsx` to automatically retrieve the institutional pairing token on open and append `&token=...` to the generated 1-liner command.
  4. Added Subtest 8 to `tests/terminal-agent-handshake.test.mjs` verifying agent installer script integrity and institutional secret resolution (`8 passed, 0 failed`).

---

## 5. Live Physical Machine Enrollment Verification (PC-30)

- **Test Machine**: Hostname `DESKTOP-A7L8LKQ`, OS Windows 11 Pro (Build 26200).
- **Physical Silicon Fingerprint**: `7A860FB7-7DC9-6049-9EC8-D997F4EAF94B-ce723115-5c2c-40bb-8545-a7616d2d6f5b-20-4E-F6-BC-E8-37` (Motherboard UUID + Registry MachineGuid + Physical Adapter MAC `20-4E-F6-BC-E8-37`).
- **Telemetry Enrolled**: AMD Ryzen 5 3500U (4 Cores), 12 GB RAM, 168.1 GB free of 375.1 GB on C:, LAN IP `192.168.1.8`.
- **Database Status**: Successfully bound in `public.workstations` under label `PC-30`. Verified single-use ticket conversion to 12-hour `HttpOnly` session cookie (`labsync_terminal_session`) and clean launch into `/terminal/PC-30`.

---

## 6. Student Terminal UI Refinements, Desktop Ergonomics & Self-Healing Shortcuts

1. **Theme Switcher**: Integrated `ThemeToggle` (`next-themes`) in the sticky headers of `StudentTerminalView` and `UnverifiedTerminalScreen` for immediate dark/light canvas switching.
2. **Hardware Telemetry Purged from Student View**: The raw specs bar (CPU, RAM, free storage, local IP) was removed from the student view. Technical metrics remain safely queryable by administrators in the CAD Inspector Drawer.
3. **Widescreen Desktop Ergonomics**: Transformed `/terminal/[code]` into a balanced two-column dashboard (`lg:grid-cols-12`):
   - **Left Column (Desk Identity & Active Tickets)**: Desk identifier `PC-30`, enrolled student avatar and details (name, roll, class), active routine with remaining minutes countdown, and active defect tickets with inline cancellation.
   - **Right Column (Reporting Console)**: 6 specific problem cards, required detailed observations textarea (minimum 10 characters), anti-spam cooldown indicator (`Please wait {cooldown}s before submitting another request`), and dispatch action.
4. **Sharp Problem Categories**: Replaced `audio_issue` with `display_issue` ("Monitor / Display Glitch") across types, UI, actions, and regression tests.
5. **Clean Unverified Screen**: Stripped dev environment bypass and faculty view button; anchored institutional footer with `INSTITUTION_NAME` (`Ratna Rajya Laxmi Secondary School`).
6. **Distinct Shortcut Icon & Dual-Desktop Self-Healing**: Updated shortcut icon from generic computer monitor (`shell32.dll,23`) to distinctive Windows Help orb (`imageres.dll,99`). Shortcuts are provisioned to both Public Desktop and User Desktop, with automatic boot-time self-healing from Windows Startup.




