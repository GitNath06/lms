# Student Terminal Agent & Tamper-Proof Hardware Telemetry Architecture

> **Document**: `doc/plans/2026-10-14-student-terminal-agent-and-tamper-proof-architecture.md`  
> **Status**: Approved Master Implementation Blueprint  
> **Author**: Antigravity Pair Programming Agent & User  
> **Target Environment**: Academic Computer Labs (50+ Terminals), Windows 10/11 OS, Supabase Free Tier  
> **Current Branch**: `feature/student-terminal-agent`  
> **Date**: October 15, 2026  

---

## 1. Executive Summary & Institutional Mission

In academic computer laboratories (Secondary Class 11, Class 12, and undergraduate labs), students need a friction-free way to report workstation faults (e.g., sticky keyboard keys, broken mouse clicks, missing Turbo C++ or Python, network dropouts) without requiring individual student account logins.

However, generic web URLs (e.g. `/terminal/PC-26`) expose critical vulnerabilities:
1. **Prank URL Spoofing**: Students can alter URL parameters in browser tabs to submit false reports for other students' desks.
2. **Mobile Pranks**: Students could open the URL from mobile phones or outside the lab.
3. **No Hardware Visibility**: The Lab In-Charge has zero visibility into actual physical machine specifications (RAM, CPU, Drive C free space, OS version) to verify whether reported software issues stem from low storage or uninstalled environments.

### The Unified Solution
This blueprint establishes a **two-pillar architecture**:
1. **Lightweight Windows Native Client Agent (`labsync-agent.ps1` & `setup-labsync.bat`)**: A zero-dependency PowerShell script on lab PCs that extracts machine hardware specs (CPU, RAM, Drive C storage, OS build, MAC address, LAN IP) and binds to Windows `MachineGuid`.
2. **Cryptographic One-Time Handshake & HttpOnly Cookie Protocol**: When launched, the agent requests a single-use token from `/api/terminal/handshake`, opens the default browser to `/terminal/auth?ticket=<token>`, sets an `HttpOnly`, `SameSite=Strict` session cookie, and immediately redirects to a clean URL (`/terminal`) with **zero station parameters in the address bar**. Reports can only originate from that physical machine.

---

## 2. Explicit Scope Decisions & Boundaries

Based on institutional requirements and real-world high school lab constraints:

| Proposed Feature | Decision | Engineering & Operational Rationale |
| :--- | :--- | :--- |
| **"Raise Hand" / Digital Chime** | ❌ **DROPPED** | In physical computer labs, students and instructors are in the same physical room. Students verbally ask questions or wave their hands in person. A digital button causes spam, requires audio chime handling, and adds unnecessary complexity with zero benefit. |
| **Student Mobile QR Scanning** | ❌ **DROPPED** | Mobile phones are strictly prohibited for students in Class 11 & 12 academic labs in Nepal. Requiring phone QR scans is unrealistic and obsolete for students. Reporting is desktop-native only. |
| **Dead-PC Issue Categories** | ❌ **DROPPED from Student View** | Issues like *"Monitor Blackout"* or *"PSU Won't Boot / No Power"* cannot physically be reported by a student on a dead machine. Those categories belong exclusively to the Teacher / Lab In-Charge Cockpit Drawer. |
| **Student Reporting Categories** | 🟢 **ALIVE & IN-USE ONLY** | Limited strictly to problems encountered while the desktop is running: <br>1. *Mouse / Keyboard Fault* (keys jammed, button not clicking)<br>2. *No Internet / LAN Disconnected* (network drop)<br>3. *Missing Lab Software* (Turbo C++, Python, VS Code, MySQL)<br>4. *Application Freeze / Crash* (IDE frozen, compile crash)<br>5. *Audio / Headphone Issue* (no audio output)<br>6. *Other Workstation Problem* (with custom notes). |
| **100% Unique Hardware Identifier** | 🟢 **Composite Silicon ID: `$regGuid-$macAddr`** | MachineGuid in registry (`HKLM:\SOFTWARE\Microsoft\Cryptography\MachineGuid`) can be identical if lab drives are cloned without `sysprep /generalize`. Combining `$regGuid` with physical network adapter MAC address (`$macAddr`) + `$env:COMPUTERNAME` guarantees 100% uniqueness even across cloned disk images. |
| **The "LAN Disconnected" Trap** | 🟢 **Local PowerShell Diagnostic Alert** | If physical Ethernet cable is unplugged, HTTP handshake cannot reach the server. Agent catches network exceptions, tests local link, and displays a bold red/yellow console warning on the physical desktop. Web UI Category #2 is reserved for intermittent/slow connectivity or DNS issues. |
| **Strict IP Subnet Gating** | ❌ **REJECTED (Telemetry Only)** | School routers frequently reassign dynamic DHCP addresses. Enforcing strict IP whitelists breaks workstations upon DHCP lease renewal. LAN IP is collected purely as informational telemetry for the Lab In-Charge. |
| **Handshake Anti-Spoofing** | 🟢 **TOFU (Trust-On-First-Use) Lock** | Prevents student curl/Postman spoofing: Server checks if `workstation.machine_guid` is NULL on first enrollment and binds it; once set, subsequent handshakes MUST match the stored composite GUID or return `403 Forbidden`. Reset button provided in In-Charge drawer. |
| **Visible Agent Console** | 🟢 **KEPT VISIBLE FOR TESTING** | The PowerShell agent will run with a visible console window during initial development/testing so technicians can view live execution output (`[+] MachineGuid detected`, `[+] Telemetry posted`, `[+] Browser launched`). |

---

## 3. Feasibility Analysis: Running 50+ Terminals on Supabase Free Tier

A critical constraint is ensuring 50+ lab workstations run smoothly without exhausting the **Supabase Free Tier**.

### 3.1 Quota vs. Demand Comparison

| Resource Metric | Supabase Free Limit | 50+ Terminals Demand | Status |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Database Storage** | 500 MB | ~12 MB total for 50 workstations + hardware specs JSONB + 1 full academic year of issue tickets | 🟢 **< 3% used** |
| **Direct Connections Pool** | ~15–60 connections | **0 direct connections from client PCs**. All client requests hit Next.js server actions / API routes using connection pooler | 🟢 **Zero connection contention** |
| **Egress Bandwidth** | 5 GB / month | Handshake payload is ~800 bytes; terminal view bundle cached via Next.js; monthly usage ~180 MB | 🟢 **< 4% used** |
| **Realtime WebSockets** | 200 concurrent | Workstations load static context with standard HTTP; only live faculty cockpits connect to Realtime | 🟢 **Zero WebSocket saturation** |

### 3.2 Cardinal Rule: Zero High-Frequency Write Churn
- Many naive RMM agents write a "heartbeat ping" row to PostgreSQL every 30 seconds ($50 \times 120 \text{ writes/hr} = 144,000 \text{ rows/day} = 4.32 \text{ million rows/month}$). This would instantly exhaust disk quotas and trigger auto-pause.
- **Our Architecture**:
  - Telemetry is sent **only on agent launch** (Windows boot or desktop shortcut click).
  - PostgreSQL `INSERT` is executed **only when an actual ticket is submitted**.
  - Total writes per class session: **2 to 8 rows**.

---

## 4. End-to-End Authentication & Cryptographic Handshake Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   END-TO-END HANDSHAKE WORKFLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ Physical Lab PC (Desktop) ]
        │
        │ 1. Student double-clicks "LabSync Student Portal" shortcut (or runs on boot)
        ▼
   [ labsync-agent.ps1 ]
        │
        │ 2. Queries WMI/CIM: $regGuid + $macAddr (compositeGuid), ComputerName, CPU, RAM, Disk C, OS
        │ 3. HTTP POST /api/terminal/handshake (Header: X-LabSync-Agent-Key)
        ▼
 [ Next.js API Gateway (/api/terminal/handshake) ]
        │
        │ 4. Validates institutional key & enforces TOFU (Trust-On-First-Use) lock:
        │    - Looks up workstation by ComputerName/label.
        │    - If workstation.machine_guid IS NULL: Binds incoming compositeGuid!
        │    - If workstation.machine_guid IS ALREADY SET: Requires exact match; if mismatch, returns 403 Forbidden!
        │    - Updates `hardware_specs` (JSONB), `lan_ip`, and `last_seen_at`.
        │    - Generates 60-second single-use ticket: HMAC-SHA256(station_id + timestamp + iat)
        │ 5. Returns: { redirect_url: "http://<server>:3000/terminal/auth?ticket=<token>" }
        ▼
   [ labsync-agent.ps1 ]
        │
        │ 6. Executes: Start-Process "http://<server>:3000/terminal/auth?ticket=<token>"
        │    (If network exception occurs, executes local diagnostic & prints offline alert box)
        ▼
 [ Default Web Browser (Edge / Chrome) ]
        │
        │ 7. GET /terminal/auth?ticket=<token>
        ▼
 [ Next.js Server Route (/terminal/auth) ]
        │
        │ 8. Verifies 1-time ticket token (checks expiry & HMAC signature)
        │ 9. Sets cryptographically signed HttpOnly Cookie:
        │    `Set-Cookie: labsync_terminal_session=<signed_jwt>; HttpOnly; SameSite=Strict; Path=/; (Secure only on HTTPS/prod)`
        │ 10. HTTP 302 Redirect to clean URL: `/terminal` (ZERO tokens/parameters in address bar!)
        ▼
 [ Student Terminal View (/terminal) ]
        │
        │ 11. Server component verifies `labsync_terminal_session` cookie.
        │     - Loads workstation info (e.g. PC-14, Row B).
        │     - Loads currently scheduled practical & enrolled student (or session relocation).
        │     - Displays Alive-Only issue reporting tiles.
        │ 12. Student clicks "Mouse / Keyboard Fault" & submits:
        │     - Request includes HttpOnly cookie.
        │     - Server guarantees report is recorded for PC-14. No student can spoof another desk!
```

---

## 5. Hardware Telemetry Extraction Specification

The PowerShell agent (`scripts/client-agent/labsync-agent.ps1`) runs natively on Windows 10 & 11 without requiring any extra runtimes, Python, or npm modules.

### 5.1 Native WMI/CIM Commands

| Telemetry Field | Source Command | Example Extracted Value |
| :--- | :--- | :--- |
| **`machine_guid`** | `(Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Cryptography").MachineGuid` | `"a1b2c3d4-e5f6-7890-abcd-ef0123456789"` |
| **`computer_name`** | `$env:COMPUTERNAME` | `"PC-14"` |
| **`cpu`** | `(Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()` | `"Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz"` |
| **`cpu_cores`** | `(Get-CimInstance Win32_Processor | Select-Object -First 1).NumberOfCores` | `6` |
| **`ram_gb`** | `[math]::Round(((Get-CimInstance Win32_PhysicalMemory \| Measure-Object -Property Capacity -Sum).Sum / 1GB), 1)` | `16.0` |
| **`disk_c_total_gb`**| `[math]::Round(((Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'").Size / 1GB), 1)` | `476.9` |
| **`disk_c_free_gb`** | `[math]::Round(((Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB), 1)` | `184.2` |
| **`os_caption`** | `(Get-CimInstance Win32_OperatingSystem).Caption` | `"Microsoft Windows 11 Pro"` |
| **`os_build`** | `(Get-CimInstance Win32_OperatingSystem).BuildNumber` | `"22631"` |
| **`mac_address`** | `(Get-NetAdapter \| Where-Object { $_.Status -eq 'Up' -and $_.PhysicalMediaType -ne 'Unspecified' } \| Select-Object -First 1).MacAddress` | `"E4-54-E8-12-34-56"` |
| **`lan_ip`** | `(Get-NetIPAddress -AddressFamily IPv4 \| Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } \| Select-Object -First 1).IPAddress` | `"192.168.1.114"` |

### 5.2 JSONB Storage Schema (`public.workstations.hardware_specs`)

```json
{
  "cpu": "Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz",
  "cpu_cores": 6,
  "ram_gb": 16.0,
  "disk_c_total_gb": 476.9,
  "disk_c_free_gb": 184.2,
  "disk_c_used_pct": 61.4,
  "os_caption": "Microsoft Windows 11 Pro",
  "os_build": "22631",
  "mac_address": "E4-54-E8-12-34-56",
  "lan_ip": "192.168.1.114",
  "agent_version": "1.0.0",
  "last_synced_at": "2026-10-15T10:30:00Z"
}
```

---

## 6. Database Schema Invariants & Migration

We add three columns to `public.workstations`:

```sql
-- Migration: Add hardware telemetry and machine GUID binding to workstations
ALTER TABLE public.workstations 
  ADD COLUMN IF NOT EXISTS machine_guid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS hardware_specs JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- Index for instant lookup during agent handshake
CREATE INDEX IF NOT EXISTS idx_workstations_machine_guid ON public.workstations(machine_guid);
CREATE INDEX IF NOT EXISTS idx_workstations_label_lower ON public.workstations(LOWER(label));
```

### TypeScript Model Updates (`types/database.ts` & `types/workstations.ts`)
```typescript
export interface WorkstationHardwareSpecs {
  cpu: string
  cpu_cores: number
  ram_gb: number
  disk_c_total_gb: number
  disk_c_free_gb: number
  disk_c_used_pct: number
  os_caption: string
  os_build: string
  mac_address: string
  lan_ip: string
  agent_version: string
  last_synced_at: string
}

// In WorkstationRow:
machine_guid: string | null
hardware_specs: WorkstationHardwareSpecs | null
last_seen_at: string | null
```

---

## 7. Cryptographic Security Engine (`lib/security/terminal-token.ts`)

A stateless HMAC-SHA256 token engine using `process.env.TERMINAL_SIGNING_SECRET` (falling back to institutional instance key):

```typescript
// Token payload signed with HMAC-SHA256:
interface HandshakeTicketPayload {
  stationId: string
  stationCode: string
  machineGuid: string
  expiresAt: number // epoch ms (60 seconds lifetime)
}

interface TerminalSessionPayload {
  stationId: string
  stationCode: string
  machineGuid: string
  issuedAt: number
}
```

1. **`createHandshakeTicket(workstation)`**: Generates a 60-second single-use URL token `ticket=<payload_b64>.<hmac>`.
2. **`verifyHandshakeTicket(ticket)`**: Validates HMAC signature and verifies `Date.now() < expiresAt`.
3. **`createTerminalSessionCookie(workstation)`**: Generates a tamper-proof session JWT cookie.
4. **`verifyTerminalSessionCookie(cookieValue)`**: Extracts validated workstation identity on server requests.

---

## 8. Client Agent Scripts Specification

### 8.1 `scripts/client-agent/labsync-agent.ps1`
- Runs in a visible PowerShell window.
- Displays colored terminal logs:
  - `[+] Reading Windows Hardware Telemetry...`
  - `[+] Identified Station: PC-14 (Guid: a1b2c3d4-...)`
  - `[+] Hardware: Core i5-10400, 16GB RAM, 184GB SSD Free, Windows 11 Pro`
  - `[+] Sending handshake to http://192.168.1.50:3000/api/terminal/handshake...`
  - `[+] Handshake authorized! Launching secure browser session...`
- Opens default browser using `Start-Process $redirectUrl`.
- Closes console cleanly after 3-second countdown (or leaves open if errors occur so technician can diagnose).

### 8.2 `scripts/client-agent/setup-labsync.bat`
- 1-click batch setup script executed from a USB flash drive or network share by the Lab In-Charge:
  1. Creates directory `C:\LabSync\`
  2. Copies `labsync-agent.ps1` into `C:\LabSync\`
  3. Creates a Windows Desktop Shortcut **"LabSync Student Portal"** with icon targeting `powershell.exe -ExecutionPolicy Bypass -File C:\LabSync\labsync-agent.ps1`
  4. Optionally creates a Run entry in `HKLM:\Software\Microsoft\Windows\CurrentVersion\Run` to launch on student login.

---

## 9. Student Reporting Portal Redesign (`/terminal`)

### 9.1 Clean Route Structure
- **`/terminal`**: The primary student interface. Automatically reads `labsync_terminal_session` cookie. If no valid session exists, displays a high-clarity **"Terminal Unauthorized"** institutional screen directing the student to launch the desktop shortcut on their lab PC.
- **`/terminal/auth`**: Internal redirect endpoint that converts a valid 1-time handshake ticket into the HttpOnly session cookie and redirects to `/terminal`.
- **`/terminal/[code]`**: Preserved exclusively for staff preview or authorized override with teacher login.

### 9.2 Alive-Only Problem Categories (`lib/types/terminal.ts`)

```typescript
export const STUDENT_TERMINAL_ISSUES = [
  {
    id: 'peripherals',
    label: 'Mouse / Keyboard Fault',
    iconName: 'MousePointer',
    severity: 'low',
    description: 'Keys jamming, mouse clicker broken, or wheel not scrolling properly.',
  },
  {
    id: 'no_internet',
    label: 'No Internet / LAN Disconnected',
    iconName: 'WifiOff',
    severity: 'high',
    description: 'Local area network unplugged or web browser shows connection timed out.',
  },
  {
    id: 'missing_software',
    label: 'Missing Lab Software',
    iconName: 'PackageX',
    severity: 'high',
    description: 'Required subject software not installed (Turbo C++, Python, VS Code, MySQL).',
  },
  {
    id: 'app_freeze',
    label: 'Application Freeze / Crash',
    iconName: 'ZapOff',
    severity: 'medium',
    description: 'Program not responding, compiler crashing, or code editor completely frozen.',
  },
  {
    id: 'audio_issue',
    label: 'Audio / Headphone Issue',
    iconName: 'VolumeX',
    severity: 'low',
    description: 'No sound output or headphone jack not recognized during audio practical.',
  },
  {
    id: 'other',
    label: 'Other Workstation Problem',
    iconName: 'HelpCircle',
    severity: 'medium',
    description: 'Custom problem encountered on this workstation.',
  },
] as const
```

### 9.3 UI Layout & Aesthetics (`StudentTerminalView`)
- Obsidian glass theme (`#0B0F19`, `.glass-card`).
- **Station Header**: `🖥️ PC-14 • Row B` | `🟢 Hardware Verified (Win 11 Pro • 16GB RAM)`.
- **Active Session Card**: Subject title, instructor name, and assigned student name (honoring Tier 2 session relocations).
- **Issue Tiles Grid**: High-density 2x3 responsive cards with micro-animations on hover and active select ring.
- **Custom Notes**: Optional textarea for specific details.
- **Submit Action**: `<Send className="h-4 w-4" /> <span>Submit Issue Report</span>` (Strictly zero literal `+`).
- **Active Tickets List**: Shows existing open tickets on this PC so student sees their ticket is recorded.

---

## 10. Live Cockpit Workstation Drawer Elevation (`workstation-issue-drawer.tsx`)

In the Lab In-Charge Cockpit (`/computer-lab`), clicking any workstation node opens the sidebar drawer. We enhance it with a **"Hardware Telemetry & Node Diagnostics"** card:

```
┌────────────────────────────────────────────────────────────────────────┐
│  🖥️ HARDWARE TELEMETRY & DIAGNOSTICS            🟢 Agent Online (2m ago)│
├────────────────────────────────────────────────────────────────────────┤
│  • Processor: Intel Core i5-10400 (6 Cores @ 2.90GHz)                  │
│  • Memory:    16.0 GB RAM Installed                                    │
│  • Storage:   184.2 GB Free of 476.9 GB (Drive C:) [███████░░░] 39%    │
│  • System:    Windows 11 Pro (Build 22631)                             │
│  • Network:   192.168.1.114  •  MAC: E4-54-E8-12-34-56                 │
│  • Machine:   GUID: a1b2c3d4-e5f6-7890-abcd-ef0123456789               │
└────────────────────────────────────────────────────────────────────────┘
```

- If `disk_c_free_gb < 15.0`, displays an amber storage badge (`⚠️ Low Disk Space`).
- If `disk_c_free_gb < 5.0`, displays a rose critical badge (`🚨 Storage Critical`).
- Directly empowers the Lab In-Charge to diagnose whether software faults (e.g. VS Code crashing, compilation failing) are caused by full disk drives or insufficient memory.

---

## 11. Phased Execution Roadmap

```
├── Phase 1: Database Migration & Model Extensions
│   ├── Run SQL migration to add `machine_guid`, `hardware_specs`, and `last_seen_at` to `workstations`
│   ├── Update `types/database.ts` and `types/workstations.ts` with typed interfaces
│   └── Verify TypeScript compilation (`npx tsc --noEmit`)
│
├── Phase 2: Cryptographic Token & Session Handshake
│   ├── Create `lib/security/terminal-token.ts` for HMAC-SHA256 ticket & JWT cookie operations
│   ├── Implement `app/api/terminal/handshake/route.ts` (validates machine GUID, saves telemetry, issues ticket)
│   ├── Implement `app/terminal/auth/route.ts` (exchanges ticket for HttpOnly session cookie, 302 redirect)
│   └── Update `app/actions/terminal.ts` to read session cookie for tamper-proof report submissions
│
├── Phase 3: Native Windows PowerShell Client Agent
│   ├── Author `scripts/client-agent/labsync-agent.ps1` with WMI telemetry extraction & visible console
│   ├── Author `scripts/client-agent/setup-labsync.bat` for 1-click lab technician deployment
│   └── Add configuration sample (`scripts/client-agent/config.sample.json`)
│
├── Phase 4: Student Reporting Portal Redesign
│   ├── Update `app/terminal/page.tsx` to read session cookie (or show unauthorized guidance if opened directly)
│   ├── Refactor `components/terminal/student-terminal-view.tsx` with alive-only categories & telemetry banner
│   └── Ensure zero literal `+` buttons and strict responsive obsidian styling
│
├── Phase 5: Live Cockpit Workstation Drawer Elevation
│   ├── Update `components/maintenance/workstations/workstation-issue-drawer.tsx` with hardware telemetry card
│   ├── Add visual storage bar (Free / Total GB) with low-disk warning thresholds
│   └── Display live MAC, IP, and last synced timestamp
│
└── Phase 6: Automated Verification & Documentation
    ├── Author integration tests in `tests/terminal-agent-handshake.test.mjs`
    ├── Verify 0 errors with `npx tsc --noEmit`
    ├── Execute full Node test suite
    └── Create sequential task log in `doc/tasks/` and update master index in `doc/tasks/README.md`
```

---

## 12. Verification & Testing Checklist

- [ ] **Type Integrity**: `npx tsc --noEmit` passes with 0 errors.
- [ ] **Handshake Security**:
  - Request with valid `machine_guid` generates valid ticket and updates `hardware_specs` in database.
  - Expired or tampered ticket at `/terminal/auth` is rejected with HTTP 401.
  - Successful ticket exchange sets `HttpOnly`, `SameSite=Strict` cookie and redirects to `/terminal`.
- [ ] **Anti-Spoofing Guarantee**:
  - Visiting `/terminal` from an unauthenticated browser displays the unauthorized guidance card.
  - Submitting an issue report uses the authenticated workstation ID from the cookie, ignoring any tampered payload codes.
- [ ] **PowerShell Agent Execution**:
  - `labsync-agent.ps1` runs without errors on Windows 10/11.
  - Extracts CPU, RAM, Disk C free/total, OS, MAC, and LAN IP accurately.
- [ ] **Cockpit Workstation Drawer**:
  - Clicking a workstation in `/computer-lab` renders the Hardware Telemetry card with live specs.
- [ ] **Compliance with AGENTS.md**:
  - Rule 1: No literal `+` in any button labels.
  - Rule 3: `Precaution Active` safety lock intact.
  - Rule 8: Strict TypeScript compilation passing.
  - Rule 13: Next.js `'use server'` files export only async functions.
  - Rule 14: Non-operational labs cannot be booked.
  - Rule 22: Sequentially numbered task log documented upon completion.
