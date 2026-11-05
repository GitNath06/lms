# Terminal Cryptographic Hardware Binding & Auto-Deploy Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tamper-proof student terminal hardware binding engine, boot-once hardware spec discovery, cryptographic `/terminal/[code]` route guard, and a 1-click Windows installer generator with hardware reset controls in `/admin`.

**Architecture:** A native Windows batch/PowerShell installer (`Setup-LabTerminal.bat`) provisions `%ProgramData%\LabSync\` on physical lab PCs and registers a composite silicon GUID (`Motherboard UUID + Registry MachineGuid + Physical NIC MAC`) via `POST /api/terminal/handshake` guarded by an institutional pairing token. The server issues a 60-second single-use HMAC handshake ticket exchanged at `/api/terminal/launch` for an HttpOnly session cookie, which is strictly verified by `/terminal/[code]` to block any unauthorized devices or direct URL manipulation.

**Tech Stack:** Next.js 16 (App Router), TypeScript, PostgreSQL (pg pool), Supabase Auth/DB, Node.js `crypto` (HMAC-SHA256), Windows PowerShell / Batch, Tailwind CSS, Lucide React.

**Spec:** [`doc/plans/2026-11-02-terminal-cryptographic-binding-and-auto-deploy-agent-design.md`](file:///d:/Projects/LMR/doc/plans/2026-11-02-terminal-cryptographic-binding-and-auto-deploy-agent-design.md)

## Global Constraints

- Never implement live foreground window tracking, game/distraction heuristics, GPU telemetry, or Focus Lock desktop curtains in this sprint.
- No literal `+` inside button or action labels (use `<Plus className="h-4 w-4" />` instead).
- Use standardized academic terminology: "Attendance", "Timetable", "Logbook", "Equipment Breakage".
- Zero unauthenticated access to `/terminal/[code]` (strict session cookie check against DB `machine_guid`).
- Zero background daemon CPU overhead (agent runs for 1.5 seconds on boot or desktop icon double-click).
- Every task must pass `npx tsc --noEmit` with 0 errors.

## Review Focus

1. **Rogue LAN Device Attempting Open TOFU**: An attacker on campus Wi-Fi attempts to claim an unbound workstation (e.g. `PC-01`) without the institutional pairing token. The server must reject with `401 Unauthorized`.
2. **Cloned Disk Image Collision**: Two identical PCs imaged with Clonezilla share the same Windows Registry `MachineGuid`. The composite silicon GUID must differentiate them via physical motherboard UUID and physical adapter MAC.
3. **Session Cookie Expiration**: A student double-clicks the desktop shortcut after the 12-hour session cookie expires. The agent must re-handshake in ~1.5s, retrieve a fresh ticket, and renew the session cookie seamlessly.
4. **Direct URL Spoofing**: A student on `PC-02` types `http://.../terminal/PC-15` in Chrome. The page must detect the cookie mismatch (`session.stationCode !== 'PC-15'`) and render the `UnverifiedTerminalHardwareScreen`.
5. **Multi-Lab Label Collision**: An institution with `comp` and `comp2` both having `PC-01`. Handshake and launch lookups must strictly scope queries with `lab_id` to prevent cross-room hijacking.

---

### Task 1: Hardened Handshake & Hardware Spec Discovery Endpoint

**Files:**
- Modify: `app/api/terminal/handshake/route.ts`
- Modify: `tests/terminal-agent-handshake.test.mjs`

**Interfaces:**
- Consumes: `createHandshakeTicket`, `safeEqual` from `lib/security/terminal-token.ts`, `getPgPool` from `lib/db.ts`.
- Produces: `POST /api/terminal/handshake` accepting `{ labId, workstationCode, machineGuid, pairingToken, hardwareSpecs }` and returning `{ success: boolean, station_code: string, workstation_id: string, redirect_url: string, is_new_pairing: boolean }`.

- [ ] **Step 1: Write the failing tests in `tests/terminal-agent-handshake.test.mjs`**

Add tests exercising:
1. Rejection of initial TOFU pairing when `pairingToken` does not match server institutional key.
2. Successful TOFU pairing when valid `pairingToken` is supplied, verifying `machine_guid` and `hardware_specs` are saved to DB.
3. Subsequent boot handshake with matching `machine_guid`, verifying `last_seen_at` updates.
4. Rejection of mismatched `machine_guid` with `403 Forbidden`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Expected: FAIL on new pairing token requirements.

- [ ] **Step 3: Implement updated `POST /api/terminal/handshake` in `app/api/terminal/handshake/route.ts`**

Update route handler to:
- Normalize payload fields: `labId` (default `'comp'`), `workstationCode` (or `computer_name`), `machineGuid` (or `machine_guid`), `pairingToken`, `hardwareSpecs` (or `hardware_specs`).
- Resolve institutional agent key from `process.env.LABSYNC_AGENT_KEY || process.env.TERMINAL_SIGNING_SECRET`.
- Require valid `pairingToken` (matching institutional key or station's `pairing_token`) on both initial TOFU binding (`machine_guid IS NULL`) and subsequent handshakes.
- Scope SQL query to `WHERE lab_id = $1 AND (LOWER(label) = LOWER($2) OR id::text = $2)`.
- Update `machine_guid`, `hardware_specs`, `lan_ip`, and `last_seen_at = NOW()`.
- Return redirect URL pointing to `/api/terminal/launch?code=${encodedCode}&ticket=${encodedTicket}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Expected: PASS all test cases.

- [ ] **Step 5: Type check and commit**

Run: `npx tsc --noEmit`
Commit: `git commit -m "feat(terminal): harden handshake endpoint with lab scoping and token verification"`

---

### Task 2: Session Exchange Route `/api/terminal/launch` & `/terminal/auth`

**Files:**
- Create: `app/api/terminal/launch/route.ts`
- Modify: `app/terminal/auth/route.ts`
- Test: `tests/terminal-agent-handshake.test.mjs`

**Interfaces:**
- Consumes: `verifyHandshakeTicket`, `createTerminalSessionToken`, `isHandshakeSignatureRedeemedInDb` from `lib/security/terminal-token.ts`.
- Produces: `GET /api/terminal/launch?code=PC-XX&ticket=...` setting HttpOnly `labsync_terminal_session` cookie and 302-redirecting to `/terminal/[code]`.

- [ ] **Step 1: Write the failing tests for launch redemption**

Add tests in `tests/terminal-agent-handshake.test.mjs` asserting:
1. Missing or invalid ticket redirects to `/terminal?auth_error=...`.
2. Valid ticket creates signed session token cookie with `maxAge = 43200` (12h).
3. 302 redirect points cleanly to `/terminal/PC-XX` without ticket in URL query.
4. Single-use ticket cannot be replayed twice.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Expected: FAIL with missing `/api/terminal/launch` route.

- [ ] **Step 3: Implement `app/api/terminal/launch/route.ts` and sync `app/terminal/auth/route.ts`**

Implement `GET` handler:
- Extract `code` and `ticket` from `req.nextUrl.searchParams`.
- Verify ticket signature and single-use DB record.
- Create session token with `{ id: stationId, label: stationCode, machine_guid: machineGuid }`.
- Set cookie `labsync_terminal_session` (`httpOnly: true`, `sameSite: 'strict'`, `path: '/'`, `maxAge: 43200`, `secure: isProd && isHttps`).
- Redirect 302 to `/terminal/${encodeURIComponent(stationCode)}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Expected: PASS.

- [ ] **Step 5: Type check and commit**

Run: `npx tsc --noEmit`
Commit: `git commit -m "feat(terminal): implement ticket exchange launch route with 12h session cookie"`

---

### Task 3: Hardened Hardware Route Guard on `/terminal/[code]` & `/terminal`

**Files:**
- Modify: `app/terminal/[code]/page.tsx`
- Modify: `app/terminal/page.tsx`
- Create: `components/terminal/unverified-terminal-screen.tsx`
- Test: `tests/terminal-agent-handshake.test.mjs`

**Interfaces:**
- Consumes: `getActiveTerminalSession`, `getTerminalContext` from `app/actions/terminal.ts`.
- Produces: Hardened student terminal route rendering `<StudentTerminalView />` only when authenticated session matches both URL `code` and DB `machine_guid`.

- [ ] **Step 1: Create `components/terminal/unverified-terminal-screen.tsx`**

Build brand-consistent UI displaying:
- Icon: `<ShieldAlert className="h-8 w-8 text-amber-500" />`.
- Title: "🔒 Physical Workstation Authentication Required".
- Requested code badge: `e.g. PC-23`.
- Clear, student-friendly explanation: "This terminal portal must be launched directly from your physical lab desk via the 'LabSync Student Portal' desktop shortcut."
- Faculty & In-Charge guidance link.

- [ ] **Step 2: Update `app/terminal/[code]/page.tsx` with hardware security guard**

Implement server-side verification:
- Call `getActiveTerminalSession()`.
- If `!session.authenticated`, render `<UnverifiedTerminalScreen requestedCode={decodedCode} />`.
- If `session.stationCode?.toLowerCase() !== decodedCode.toLowerCase()`, render `<UnverifiedTerminalScreen requestedCode={decodedCode} reason="Terminal Mismatch" />`.
- Fetch `getTerminalContext(decodedCode)` and verify `res.data.machineGuid === session.machineGuid`.
- If all checks pass, render `<StudentTerminalView initialData={res.data} isSessionAuthenticated={true} />`.

- [ ] **Step 3: Update `app/terminal/page.tsx` to redirect authenticated sessions**

- If `session.authenticated && session.stationCode`, redirect 302 to `/terminal/${encodeURIComponent(session.stationCode)}`.
- If unauthenticated, render the existing Desktop Shortcut Instructions gateway screen.

- [ ] **Step 4: Run tests and type check**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

Commit: `git commit -m "feat(terminal): guard /terminal/[code] with cryptographic hardware session verification"`

---

### Task 4: Windows Lab Hardening in Client Agent Scripts

**Files:**
- Modify: `scripts/client-agent/labsync-agent.ps1`
- Create: `scripts/client-agent/Setup-LabTerminal.bat`

**Interfaces:**
- Consumes: Windows WMI / CIM (`Win32_ComputerSystemProduct`, `Win32_NetworkAdapterConfiguration`, `Win32_Processor`, `Win32_PhysicalMemory`, `Win32_LogicalDisk`), `HKLM:\SOFTWARE\Microsoft\Cryptography\MachineGuid`.
- Produces: Silent 1.5s boot agent and 1-click installer writing to `%ProgramData%\LabSync\` and `$env:PUBLIC\Desktop`.

- [ ] **Step 1: Implement clone-safe hardware fingerprint in `scripts/client-agent/labsync-agent.ps1`**

Update GUID extraction logic:
```powershell
$hwUuid = (Get-CimInstance Win32_ComputerSystemProduct -ErrorAction SilentlyContinue).UUID
if (-not $hwUuid -or $hwUuid -match '00000000|FFFFFFFF') { $hwUuid = "GENERIC-SYSTEM" }

$regGuid = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Cryptography" -ErrorAction SilentlyContinue).MachineGuid
if (-not $regGuid) { $regGuid = [System.Guid]::NewGuid().ToString() }

$activeNic = Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
$macAddr = if ($activeNic -and $activeNic.MacAddress) { $activeNic.MacAddress.Replace(':', '-') } else { "00-00-00-00-00-00" }

$compositeGuid = "$hwUuid-$regGuid-$macAddr"
```
Ensure configuration is loaded from `C:\ProgramData\LabSync\config.json` with fallback to local script directory.

- [ ] **Step 2: Create `scripts/client-agent/Setup-LabTerminal.bat`**

Implement self-contained batch installer:
- Prompts for Administrator elevation if not already elevated (`net session >nul 2>&1`).
- Prompts once for workstation code if `$env:COMPUTERNAME` does not match `^PC-\d+$` (normalizing e.g. `4` -> `PC-04`).
- Creates directory `C:\ProgramData\LabSync\`.
- Writes `C:\ProgramData\LabSync\config.json` with `{ "server_url": "%SERVER_URL%", "lab_id": "%LAB_ID%", "station_code": "%STATION_CODE%", "pairing_token": "%PAIRING_TOKEN%" }`.
- Copies `labsync-agent.ps1` into `C:\ProgramData\LabSync\`.
- Creates Public Desktop shortcut (`%PUBLIC%\Desktop\LabSync Student Portal.lnk`) and Public Startup shortcut (`%ProgramData%\Microsoft\Windows\Start Menu\Programs\StartUp\LabSync Terminal.lnk`) pointing to:
  `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\ProgramData\LabSync\labsync-agent.ps1"`
- Runs `labsync-agent.ps1` immediately to enroll machine and open browser.

- [ ] **Step 3: Manually test script syntax in PowerShell**

Run: `powershell -ExecutionPolicy Bypass -Command "& { [System.Management.Automation.Language.Parser]::ParseFile('scripts/client-agent/labsync-agent.ps1', [ref]$null, [ref]$null) }"`
Expected: No syntax errors reported.

- [ ] **Step 4: Commit**

Commit: `git commit -m "feat(agent): implement clone-safe hardware fingerprint and Setup-LabTerminal installer"`

---

### Task 5: Admin Agent Downloader Modal & Reset Hardware Binding Control

**Files:**
- Create: `app/api/terminal/agent/download/route.ts`
- Modify: `app/actions/workstations.ts`
- Create: `components/admin/agent-download-modal.tsx`
- Modify: `components/admin/tabs/workstations-tab.tsx` (or admin workstation cards)

**Interfaces:**
- Consumes: `resetWorkstationHardwareBinding` server action, `/api/terminal/agent/download` endpoint.
- Produces: Interactive admin modal to configure and download `Setup-LabTerminal.bat`, plus 1-click hardware reset button per workstation.

- [ ] **Step 1: Implement `resetWorkstationHardwareBinding` in `app/actions/workstations.ts`**

Implement server action:
```ts
export async function resetWorkstationHardwareBinding(workstationId: string): Promise<{ success: boolean; error?: string }>
```
- Requires Super Admin or Lab In-Charge scope.
- Updates `public.workstations` setting `machine_guid = NULL`, `hardware_specs = NULL`, `last_seen_at = NULL`.
- Records audit ledger event (`TOFU_HARDWARE_LOCK_RESET`).
- Revalidates paths: `/admin`, `/computer-lab`, `/terminal`.

- [ ] **Step 2: Implement dynamic agent download route `app/api/terminal/agent/download/route.ts`**

Implement `GET /api/terminal/agent/download`:
- Accepts query params: `serverUrl`, `labId`, `pairingToken`.
- Validates privileged admin authentication.
- Reads `Setup-LabTerminal.bat` and `labsync-agent.ps1`, injects parameter constants.
- Returns a downloadable `.bat` file attachment with `Content-Disposition: attachment; filename="Setup-LabTerminal.bat"`.

- [ ] **Step 3: Create `components/admin/agent-download-modal.tsx`**

Build modal component with:
- Server Address input pre-filled with `window.location.origin` (editable for LAN IP).
- Lab selection dropdown (default `Computer Lab`).
- Institutional Pairing Key display.
- Download `.bat` button and Copy PowerShell One-Liner button.

- [ ] **Step 4: Wire Download modal and Reset Hardware buttons into Workstations view in `/admin`**

- Add **"Download Lab Agent (.bat)"** button to toolbar in `workstations-tab.tsx`.
- Add **"Reset Hardware Binding"** button to each workstation row/card when `ws.machine_guid` is present.

- [ ] **Step 5: Type check and commit**

Run: `npx tsc --noEmit`
Commit: `git commit -m "feat(admin): add agent download dialog and reset hardware binding control"`

---

### Task 6: Comprehensive End-to-End Verification

**Files:**
- Modify: `tests/terminal-agent-handshake.test.mjs`

- [ ] **Step 1: Run complete automated test suite**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/terminal-agent-handshake.test.mjs`
Expected: 100% of handshake, ticket redemption, TOFU enrollment, and guard tests pass.

- [ ] **Step 2: Run institutional regression test suites**

Run: `node --experimental-strip-types --import ./tests/register-hooks.mjs --test ./tests/calendar-policy.test.mjs`
Run: `node --experimental-strip-types --import ./tests/conflict-engine.test.mjs`
Expected: All tests pass without regression.

- [ ] **Step 3: Run strict TypeScript compile verification**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Create sequentially numbered task log in `doc/tasks/`**

Create `doc/tasks/2026-11-02-task-94-terminal-cryptographic-binding-and-auto-deploy-agent.md` and update `doc/tasks/README.md`.

- [ ] **Step 5: Final commit**

Commit: `git commit -m "chore: document Task 94 completion and verify all test suites"`

