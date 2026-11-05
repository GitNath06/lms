# Design Document: Terminal Cryptographic Hardware Binding & Auto-Deploy Agent

**Date**: 2026-11-02  
**Status**: Pending Review  
**Initiative**: Sprint 1 — Terminal Security & Hardware Pairing  
**Author**: Antigravity & Engineering Team  

---

## 1. Intent & The Why

Academic computer laboratories face a persistent security and integrity challenge: students routinely bypass seat accountability by opening direct terminal URLs (e.g. `/terminal/PC-23`) on unauthorized devices, phones, or neighboring workstations. This enables prank reporting, false attendance claims, and unverified hardware tickets.

The goal of this sprint is to lock down the student terminal interface so that **only physical lab PCs running an authenticated, hardware-bound agent can open `/terminal/[code]`**, with **zero background process spying**, **zero distraction/game heuristics**, and **zero continuous daemon overhead**.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Core Goals
1. **Immutable Hardware Binding (TOFU)**: Bind each workstation record in PostgreSQL to the physical computer's Windows Machine GUID and MAC address upon first boot/run.
2. **Boot-Once Hardware Spec Discovery**: Collect CPU, RAM, primary storage (total & free GB), OS version/build, LAN IP, and MAC address once per boot (under 2 seconds) and sync to `public.workstations.hardware_specs`.
3. **Cryptographic Launch & Cookie Exchange**: Issue a short-lived (60s) HMAC-SHA256 handshake ticket that exchanges into a persistent HttpOnly session cookie (`labsync_terminal_session`) locked to the workstation's `machine_guid` and code.
4. **Hardened `/terminal/[code]` Guard**: Strictly block unauthenticated or mismatched direct browser access to `/terminal/[code]`, rendering an informative "🔒 Unverified Terminal Hardware" guard screen.
5. **1-Click Agent Script Generator & Reset Control in `/admin`**: Provide an in-app button in `/admin` (and `/computer-lab`) to download a self-contained, pre-configured `Setup-LabTerminal.bat` installer, along with a "Reset Hardware Binding" action for each workstation.

### Non-Goals (Explicitly Shelved for Future)
- **NO Active Window or Title Bar Tracking**: The agent will not inspect foreground window handles or titles.
- **NO Distraction or Game Heuristics**: No heuristic engines, process blacklists, or heuristic scoring.
- **NO GPU / CPU Spike Telemetry**: Telemetry is strictly static configuration and storage capacity.
- **NO Focus Lock Curtain**: No desktop screen freezing or uncloseable browser overlays.

### Anti-Goals (What would make this a failure)
- **Antivirus Friction**: Using compiled third-party binaries that trigger Windows Defender / SmartScreen warnings.
- **Background CPU Drain**: Running a continuous polling loop or persistent memory-hogging daemon.
- **Fragile Web-Only Storage**: Relying on easily cleared browser `localStorage` to identify physical lab desks.

---

## 3. Codebase Reality: What Already Exists vs. What Is Missing

| Component / Subsystem | Existing in Codebase | Missing / Broken / To Implement |
| :--- | :--- | :--- |
| **Database Schema** (`public.workstations`) | Columns `machine_guid`, `hardware_specs` (JSONB), `pairing_token`, `last_seen_at` already exist in PostgreSQL. | None (schema is already complete and verified). |
| **Handshake Endpoint** (`app/api/terminal/handshake/route.ts`) | TOFU logic, machine GUID check, spec storage, and HMAC ticket generation already exist. | Normalize payload parser to accept both `camelCase` and `snake_case`, and support optional `pairingToken`. |
| **Token Signing** (`lib/security/terminal-token.ts`) | `createHandshakeTicket`, `verifyHandshakeTicket`, `createTerminalSessionToken`, `verifyTerminalSessionToken` exist. | Verify consistent cookie name (`labsync_terminal_session`) and session duration (12 hours). |
| **Session Exchange** (`app/terminal/auth/route.ts`) | Converts ticket to HttpOnly cookie and redirects to `/terminal`. | Add `/api/terminal/launch` route and ensure clean redirect to `/terminal/[code]`. |
| **Terminal Route Guard** (`app/terminal/[code]/page.tsx`) | Renders `StudentTerminalView` directly. | **BROKEN**: Does NOT check session cookie. Anyone visiting `/terminal/PC-XX` bypasses auth. Needs strict hardware guard. |
| **Client Agent Script** (`scripts/client-agent/labsync-agent.ps1`) | Core WMI hardware extraction, composite GUID generation, and handshake exist in git repo. | Not packaged as a downloadable `.bat` installer; not accessible via `/admin`. |
| **Admin Download & Reset** (`app/(dashboard)/admin/`) | Admin console has tabs for users, timetable, maintenance. | **MISSING**: No "Download Lab Agent (.bat)" generator or "Reset Hardware Binding" button in UI. |

---

## 4. Approaches Considered

### Approach 1: Native Windows Script Agent (`.bat` / `.ps1`) with Hardware GUID & Desktop Launcher *(Selected)*
- **Architecture**: In `/admin`, admin clicks "Download Lab Agent (.bat)" which downloads a self-contained batch file containing a base64-encoded bootstrap PowerShell runner. Running it on a lab PC prompts for workstation code (if not auto-detected from hostname), completes the handshake, saves `launch-terminal.bat` to the Desktop/Startup folder, and launches the verified browser.
- **Trade-offs**: Native to Windows, zero external runtimes, 0% SmartScreen blocking, completely immune to student browser devtools.

### Approach 2: Browser-Only Admin Session Token (Zero Script) *(Rejected)*
- **Architecture**: Admin visits `/terminal/pair` in Chrome/Edge, logs in, and saves a persistent key to `localStorage`.
- **Why Rejected**: Fragile; easily erased when students clear browser history or use Incognito mode; permits students to copy tokens across devices via DevTools.

---

## 5. Technical Specifications & Architecture

### 5.1 POST `/api/terminal/handshake` Endpoint
- **Path**: `app/api/terminal/handshake/route.ts`
- **Method**: `POST`
- **Request Payload**:
  ```json
  {
    "labId": "comp",
    "workstationCode": "PC-04",
    "machineGuid": "d3b07384-d113-466f-b2b5-555555555555-00-15-5D-12-34-56",
    "pairingToken": "OPTIONAL_INSTITUTIONAL_TOKEN",
    "hardwareSpecs": {
      "cpu": "Intel Core i5-10400 @ 2.90GHz",
      "cpu_cores": 6,
      "ram_gb": 16.0,
      "disk_c_total_gb": 256.0,
      "disk_c_free_gb": 142.5,
      "disk_c_used_pct": 44.3,
      "os_caption": "Microsoft Windows 11 Pro",
      "os_build": "22631",
      "mac_address": "00-15-5D-12-34-56",
      "lan_ip": "192.168.1.104",
      "agent_version": "1.0.0",
      "last_synced_at": "2026-11-02T12:00:00Z"
    }
  }
  ```
- **Execution Flow**:
  1. Validate payload. Support both `labId` (defaulting to `'comp'`) and `workstationCode` (or `computer_name`).
  2. Verify institutional pairing secret (`x-labsync-agent-key` or `pairingToken`) if configured on the server, ensuring unauthorized devices on campus Wi-Fi cannot claim uninitialized stations.
  3. Query `public.workstations` where `lab_id = $1 AND (LOWER(label) = LOWER($2) OR id::text = $2)`.
  4. If workstation has existing `machine_guid`:
     - If `safeEqual(existingGuid, machineGuid)` matches: **SUCCESS** (subsequent boot). Update `hardware_specs`, `lan_ip`, `last_seen_at`.
     - If mismatch: Return `403 Forbidden` (`"Hardware Mismatch: Workstation already bound to another machine. Contact Lab In-Charge to reset binding."`).
  5. If workstation has `machine_guid IS NULL`: **SUCCESS (TOFU)**. Bind `machine_guid`, update specs, log audit ledger event.
  6. Issue 60s single-use handshake ticket using `createHandshakeTicket`.
  7. Return `{ success: true, station_code, workstation_id, redirect_url, is_new_pairing }`.

### 5.2 Session Exchange & `/terminal/[code]` Hardening
- **Ticket Redemption**: `GET /api/terminal/launch?code=...&ticket=...` (and `/terminal/auth?ticket=...`):
  - Validates HMAC signature and single-use DB replay prevention.
  - Sets HttpOnly cookie `labsync_terminal_session` (`maxAge: 43200` [12 hours], `path: '/'`, `sameSite: 'strict'`, `secure: isProd && isHttps`).
  - Redirects 302 cleanly to `/terminal/[code]` (stripping the ticket from the browser address bar).
- **Route Guard in `app/terminal/[code]/page.tsx`**:
  ```ts
  const session = await getActiveTerminalSession()
  const decodedCode = decodeURIComponent(code || '').trim()

  const isAuthorized =
    session.authenticated &&
    session.stationCode?.toLowerCase() === decodedCode.toLowerCase()

  if (!isAuthorized) {
    return <UnverifiedTerminalHardwareScreen requestedCode={decodedCode} />
  }

  return <StudentTerminalView initialData={res.data} isSessionAuthenticated={true} />
  ```
- **Direct `/terminal` Routing**: If a user navigates to root `/terminal`, check active session cookie:
  - If authenticated with valid station code: 302 redirect to `/terminal/[session.stationCode]`.
  - If unauthenticated: Render standard Physical Authentication Required guidance screen.

### 5.3 1-Click Agent Generator in `/admin` & Client Persistence
- **Route & UI**:
  - In `/admin` &rarr; Workstations Tab, clicking **"Download Lab Agent (.bat)"** opens a setup modal.
  - The modal detects and displays the server address (pre-filled with the current LAN origin, e.g. `http://192.168.1.100:3000`) and target lab (`Computer Lab`), allowing the admin to confirm before downloading.
  - Generates `Setup-LabTerminal.bat`.
- **Client Provisioning Workflow**:
  1. The batch file is executed once on the lab PC.
  2. Provisions client files in `%ProgramData%\LabSync\` (`labsync-agent.ps1` and `config.json`), granting read/execute rights to all standard student accounts.
  3. Creates a Desktop and Startup folder shortcut: `"LabSync Student Portal"`.
  4. Shortcut target:
     `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\LabSync\labsync-agent.ps1"`
  5. Runs the agent immediately to register hardware and launch the student portal. On subsequent boots or icon clicks, the 1.5s script refreshes hardware telemetry, requests a fresh ticket, and renews the 12-hour session seamlessly.

### 5.4 Hardware Reset Control in `/admin`
- **Server Action**: `resetWorkstationHardwareBinding(workstationId: string)` in `app/actions/workstations.ts` (or `app/actions/terminal.ts`).
- **Authorization**: Super Admin or Lab In-Charge only.
- **Action**: Sets `machine_guid = NULL`, `hardware_specs = NULL`, `last_seen_at = NULL` in `public.workstations`.
- **UI**: Added to workstation table/card in `/admin` alongside "Unpair" and "View Details".

---

## 6. What Is Left to the Builder
- Visual styling of the `UnverifiedTerminalHardwareScreen` using existing brand tokens (`glass-card`, `Plus Jakarta Sans`, Lucide icons).
- Batch script file naming and fallback prompts when `$env:COMPUTERNAME` does not match standard `PC-XX` naming conventions.
- Test suites in `tests/terminal-agent-handshake.test.mjs` verifying TOFU binding, invalid ticket rejection, and mismatched cookie denial.

