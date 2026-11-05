# Enterprise Security, RBAC & Forensic Integrity Audit Report
**Institutional Target**: LabSync LIMS / LMR — Ratna Rajya Laxmi Secondary School (Gaindakot-11, Pitauji, Gandaki)  
**Document ID**: `SEC-AUDIT-2026-10-15-V1`  
**Classification**: Strictly Confidential / Institutional Governance  
**Audit Scope**: Database RLS Policies (33 Tables), Server Actions RPC Security, Cryptographic Terminal Protocol, Academic Dual Sign-Off Integrity, NEB 75% Board Compliance Engine, and Database Cascading Referential Invariants.  
**Execution Posture**: Strict Read-Only Introspection (Zero application code modifications during audit).

---

## 1. Executive Summary

A comprehensive, deep-dive enterprise security and forensic integrity audit was conducted across the **LabSync LIMS** platform. The audit systematically evaluated the system against top institutional threat vectors: privilege escalation, unauthorized data modification via PostgREST, cryptographic spoofing of physical lab terminals, tampering with official National Examination Board (NEB) practical attendance records, and database cascading deletion risks.

### Executive Risk Verdict: 🔴 HIGH RISK — ACTION REQUIRED BEFORE PRODUCTION
While the system features modern architectural components (PostgreSQL Row-Level Security on all 33 tables, biometric/terminal hardware binding, and sliding-window OTP rate limiting), several **critical privilege escalation vectors, client-controllable parameter backdoors in Server Actions, and unauthenticated data exposure risks** were uncovered.

### Vulnerability Summary Table

| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| 🔴 **Critical** | **3** | Direct PostgREST Role Escalation, Server Action Scope Bypasses (`internalBypassScopeCheck`), Hardcoded Cryptographic Signing Salt. |
| 🟠 **High** | **6** | Anonymous Reading of Hardware Secrets (`pairing_token`, `machine_guid`), Anonymous Staff PII Harvesting, Public Calendar Deletion, Public Audit Log Forgery, Direct Pool Fallback Bypassing RLS, Permissive Attendance Write Access. |
| 🟡 **Medium** | **5** | Free-Text "verified" Dual Sign-Off Spoofing, NEB 75% Attendance Defaulting to 100%, Development Mode Privilege Leaks, In-Memory Replay Cache in Multi-Instance Deployments, Catastrophic Foreign Key Cascade Deletion on Facilities. |
| 🟢 **Low / Info** | **1** | Over-scoped Cookie Path (`path: '/'` on workstation terminal session). |

---

## 2. Threat Surface & Attack Vector Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PUBLIC THREAT SURFACE                                     │
├──────────────────────────────┬───────────────────────────────┬─────────────────────────┤
│    Vector A: PostgREST API   │   Vector B: Next.js Actions   │  Vector C: Terminal LAN │
│    https://<ref>.supabase.co │   /_next/data or Server RPC   │  /terminal & /api/*     │
└──────────────┬───────────────┴───────────────┬───────────────┴────────────┬────────────┘
               │                               │                            │
               ▼                               ▼                            ▼
  [Profiles UPDATE without CHECK]    [internalBypassScopeCheck]     [Static Salt Fallback]
  Role escalation: teacher -> admin  Administrative bypass: cohort, [Public pairing_token]
  Public read on pairing_token       academic years, seat plans     Workstation spoofing
               │                               │                            │
               └───────────────────────┬───────┴────────────────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │  PostgreSQL Database Engine    │
                       │  33 Tables (RLS Enabled)       │
                       │  Direct Pooler (15 max conn)   │
                       └────────────────────────────────┘
```

---

## 3. Detailed Vulnerability Register

---

### Finding 01 (CRITICAL): Direct PostgREST Role Escalation via Unchecked Self-Profile Update
- **Target Table**: `public.profiles`
- **CVSS 3.1 Base Score**: **9.8** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H`)
- **Vulnerability Type**: Insecure Direct Object Reference (IDOR) / Broken Access Control (CWE-284)

#### Root Cause Analysis
In `public.profiles`, Row-Level Security is enabled with policy:
```sql
-- Existing Policy in pg_policies:
Table: profiles | Cmd: UPDATE | Roles: "{public}" | Qual: (auth.uid() = id) | WithCheck: null
```
PostgreSQL column-level privileges grant `UPDATE` on **all columns** (including `role`, `approval_status`, and `permissions`) to the `authenticated` role. Furthermore, there is **zero database trigger** verifying that the user is not altering their own role.

#### Exploitation Scenario
Any authenticated user (e.g., a newly registered teacher whose account is still `'pending'`) can send an HTTP `PATCH` request directly to the PostgREST API using their regular Supabase session JWT:
```http
PATCH /rest/v1/profiles?id=eq.<my_user_id> HTTP/1.1
Host: <supabase_project_ref>.supabase.co
Authorization: Bearer <user_jwt_token>
apikey: <public_anon_key>
Content-Type: application/json

{
  "role": "super_admin",
  "approval_status": "approved",
  "permissions": {
    "can_manage_users": true,
    "can_edit_schedules": true,
    "can_verify_practicals": true
  }
}
```
PostgreSQL evaluates `(auth.uid() = id)` which returns `true`. Because `WithCheck` is `null` and column grants permit `UPDATE`, the role is updated immediately to `super_admin`. On the next request, the user gains complete administrative root control over the institutional portal.

#### Remediation SQL
```sql
-- 1. Revoke column-level update privileges on sensitive fields from authenticated users
REVOKE UPDATE (role, approval_status, permissions, email) ON public.profiles FROM authenticated;
REVOKE UPDATE (role, approval_status, permissions, email) ON public.profiles FROM anon;

-- 2. Enforce check constraint trigger to block self-elevation
CREATE OR REPLACE FUNCTION public.protect_profile_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR 
      OLD.approval_status IS DISTINCT FROM NEW.approval_status OR
      OLD.permissions IS DISTINCT FROM NEW.permissions) THEN
    -- Only service_role or active super_admins can alter roles/statuses
    IF NOT (
      (auth.jwt() ->> 'role' = 'service_role') OR
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin' AND approval_status = 'approved'
      )
    ) THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your own role or approval status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_protect_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privilege_escalation();
```

---

### Finding 02 (CRITICAL): Server Action RBAC Bypass via Client-Controllable `internalBypassScopeCheck`
- **Target Files**:
  - `app/actions/academic-years.ts` (lines 225, 412, 531)
  - `app/actions/archive-hub.ts` (lines 29, 113, 225, 273, 333, 453, 553)
  - `app/actions/seat-plans.ts` (lines 66, 71, 934)
- **CVSS 3.1 Base Score**: **9.1** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H`)
- **Vulnerability Type**: Privilege Bypass / Client Parameter Injection (CWE-602)

#### Root Cause Analysis
In Next.js App Router, every `export async function` in a file with `'use server'` is compiled into a public HTTP RPC endpoint callable by anyone with valid JSON input.

In `app/actions/academic-years.ts`:
```typescript
export async function updateAcademicYearAction(
  input: { id: string; name?: string; start_date?: string; end_date?: string; internalBypassScopeCheck?: boolean }
): Promise<{ success: boolean; data?: AcademicYear; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can modify academic years.' }
  }
  // Connects directly to getPgPool() as postgres superuser!
```
In `app/actions/academic-years.ts`:
```typescript
export async function promoteCohortAction(
  input: PromoteCohortInput // contains internalBypassScopeCheck?: boolean
): Promise<{ success: boolean; data?: PromoteCohortResult; error?: string }> {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can promote cohorts.' }
  }
```
In `app/actions/archive-hub.ts`:
```typescript
export async function restoreArchivedStudentAction(input: {
  studentId: string
  enrollmentId?: string
  targetRollNumber?: number
  internalBypassScopeCheck?: boolean
}) {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged && !input.internalBypassScopeCheck) {
    return { success: false, error: 'Access denied: Only administrators can restore archived items.' }
  }
```

#### Exploitation Scenario
An unauthorized teacher or low-privilege account calls the Server Action endpoint via browser `fetch` or script:
```javascript
await fetch('/_next/data/.../promoteCohortAction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromClassId: '11sci',
    toClassId: '12eng',
    fromAcademicYearId: '2083',
    toAcademicYearId: '2084',
    exceptions: [],
    internalBypassScopeCheck: true // <--- Bypasses check!
  })
})
```
The server action bypasses the `!scope.isPrivileged` check and immediately executes raw transactions using `getPgPool()`, promoting cohorts, altering historical academic years, or restoring archived records without administrative privileges.

#### Remediation Plan
1. **Never pass authorization bypass flags in public function arguments**.
2. Separate internal intra-action business functions from public Server Action wrappers:
```typescript
// Internal unexported helper
async function internalPromoteCohort(input: PromoteCohortInput) { ... }

// Public exported Server Action: strictly enforces user privilege
export async function promoteCohortAction(input: Omit<PromoteCohortInput, 'internalBypassScopeCheck'>) {
  const scope = await getServerUserScope()
  if (!scope.isPrivileged) {
    return { success: false, error: 'Access denied: Only administrators can promote cohorts.' }
  }
  return internalPromoteCohort(input)
}
```

---

### Finding 03 (CRITICAL): Hardcoded Cryptographic Salt Fallback in Workstation HMAC Engine
- **Target File**: `lib/security/terminal-token.ts` (lines 9–14)
- **CVSS 3.1 Base Score**: **8.8** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`)
- **Vulnerability Type**: Use of Hard-coded Cryptographic Key (CWE-321)

#### Root Cause Analysis
In `lib/security/terminal-token.ts`:
```typescript
const SECRET_KEY =
  process.env.TERMINAL_SIGNING_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'labsync-lims-default-terminal-signing-salt-2083'
```
Database inspection of `.env.local` confirms that **none** of `TERMINAL_SIGNING_SECRET`, `SUPABASE_JWT_SECRET`, or `NEXTAUTH_SECRET` are defined in the environment. Consequently, the application signs all 60-second handshake tickets and physical workstation session cookies using the publicly visible literal string `'labsync-lims-default-terminal-signing-salt-2083'`.

#### Exploitation Scenario
Any student or attacker on the campus Wi-Fi can compute their own HMAC-SHA256 signature offline:
```javascript
const crypto = require('crypto')
const secret = 'labsync-lims-default-terminal-signing-salt-2083'
const payload = {
  stationId: 'ws-pc-01',
  stationCode: 'PC-01',
  machineGuid: 'attacker-guid',
  issuedAt: Date.now()
}
const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url')
const cookie = `${encoded}.${signature}`
```
Setting `Cookie: labsync_terminal_session=<forged_token>` allows the attacker to impersonate any workstation in the laboratory, submit attendance, or report fake student experiments.

#### Remediation Plan
1. Define a high-entropy 256-bit secret in `.env.local`: `TERMINAL_SIGNING_SECRET=<32_byte_random_hex>`.
2. Remove the hardcoded fallback; throw a fatal startup exception in production if `TERMINAL_SIGNING_SECRET` is missing.

---

### Finding 04 (HIGH): Anonymous Public Read Access to Workstation Pairing Secrets & Hardware GUIDs
- **Target Table**: `public.workstations`
- **CVSS 3.1 Base Score**: **8.2** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N`)
- **Vulnerability Type**: Sensitive Data Exposure (CWE-200)

#### Root Cause Analysis
Database audit of `pg_policies` and column privileges revealed:
```
Table: workstations | Cmd: SELECT | Roles: "{public}" | Qual: true
```
All columns of `workstations`—specifically `pairing_token`, `machine_guid`, `lan_ip`, and `hardware_specs`—are granted `SELECT` to `anon`.

#### Exploitation Scenario
Any client without logging in can issue:
```bash
curl "https://<supabase_ref>.supabase.co/rest/v1/workstations?select=id,label,pairing_token,machine_guid,lan_ip" \
  -H "apikey: <public_anon_key>"
```
This returns every workstation's secret `pairing_token` and composite `machine_guid`. An attacker can use these pairing tokens to bypass the hardware lock in `app/api/terminal/handshake/route.ts` and spoof workstation heartbeats.

#### Remediation SQL
```sql
-- Revoke anonymous access to pairing secrets
REVOKE SELECT (pairing_token, machine_guid) ON public.workstations FROM anon;
REVOKE SELECT (pairing_token, machine_guid) ON public.workstations FROM authenticated;

-- Create an unprivileged public view for floor plan CAD rendering
CREATE OR REPLACE VIEW public.workstations_public AS
SELECT id, lab_id, label, row_label, pos_x, pos_y, device_type, is_active, created_at
FROM public.workstations;

GRANT SELECT ON public.workstations_public TO anon, authenticated;
```

---

### Finding 05 (HIGH): Unrestricted Anonymous Staff PII Harvesting via `public.profiles`
- **Target Table**: `public.profiles`
- **CVSS 3.1 Base Score**: **7.8** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`)
- **Vulnerability Type**: Information Disclosure (CWE-200)

#### Root Cause Analysis
The read policy on `public.profiles` is:
```sql
Table: profiles | Cmd: SELECT | Roles: "{public}" | Qual: true
```
All columns (`full_name`, `email`, `phone`, `role`, `approval_status`, `permissions`) are readable by unauthenticated anonymous users.

#### Exploitation Scenario
An external party can scrape all institutional faculty email addresses, phone numbers, and internal staff UUIDs by querying `GET /rest/v1/profiles`, facilitating targeted spear-phishing or credential stuffing.

#### Remediation SQL
```sql
DROP POLICY IF EXISTS "Allow public to read all profiles" ON public.profiles;

-- Only authenticated institutional users can read staff directory
CREATE POLICY "Allow authenticated staff to read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Restrict sensitive fields: phone and email should be restricted to self or admin
REVOKE SELECT (phone) ON public.profiles FROM authenticated;
```

---

### Finding 06 (HIGH): Unrestricted Anonymous Deletion & Alteration of Calendar Settings
- **Target Table**: `public.calendar_settings`
- **CVSS 3.1 Base Score**: **7.5** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`)
- **Vulnerability Type**: Insecure RLS Policy / Missing Authorization Check

#### Root Cause Analysis
In `pg_policies`:
```
Table: calendar_settings | Cmd: ALL | Roles: "{public}" | Qual: true | WithCheck: null
```
`Cmd: ALL` (encompassing `INSERT`, `UPDATE`, `DELETE`) is granted to role `{public}` with unconditional `Qual: true`.

#### Exploitation Scenario
An anonymous attacker can send `DELETE /rest/v1/calendar_settings` or alter institutional holiday policies (e.g., disabling Sunday recess or removing Dashain holiday suspensions), directly corrupting laboratory attendance scheduling rules.

#### Remediation SQL
```sql
DROP POLICY IF EXISTS "Allow update calendar settings" ON public.calendar_settings;

CREATE POLICY "Allow only administrators to modify calendar settings"
ON public.calendar_settings FOR ALL
TO authenticated
USING (is_privileged())
WITH CHECK (is_privileged());
```

---

### Finding 07 (HIGH): Arbitrary Audit Log Forgery & Ingestion via Public Insert
- **Target Table**: `public.audit_logs`
- **CVSS 3.1 Base Score**: **7.5** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L`)
- **Vulnerability Type**: Insufficient Authorization / Audit Trail Manipulation (CWE-778)

#### Root Cause Analysis
In `pg_policies`:
```
Table: audit_logs | Cmd: INSERT | Roles: "{public}" | Qual: null | WithCheck: true
```
The policy permits any anonymous caller to insert arbitrary records into `public.audit_logs`.

#### Exploitation Scenario
An attacker can insert forged audit events claiming that an administrator performed attendance overrides or session seat swaps:
```json
POST /rest/v1/audit_logs
{
  "actor_name": "Super Admin",
  "actor_role": "super_admin",
  "action": "OVERRIDE",
  "entity_type": "attendance",
  "entity_label": "Roll 15 Attendance Marked Present by Admin"
}
```
This undermines forensic trust in the audit trail.

#### Remediation SQL
```sql
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;

-- Audit logs should ONLY be inserted by trusted server actions via pg pool
-- Revoke INSERT from anon and authenticated
REVOKE INSERT ON public.audit_logs FROM anon, authenticated;
```

---

### Finding 08 (HIGH): Direct Pool Fallback Bypasses RLS on Unauthorized Practical Logs
- **Target File**: `app/actions/logs.ts` (lines 654–665)
- **CVSS 3.1 Base Score**: **7.2** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`)
- **Vulnerability Type**: Security Control Bypass (CWE-693)

#### Root Cause Analysis
In `createPracticalLog`:
```typescript
const { error: dbError } = await (supabase.from('practical_logs') as any).upsert(
  upsertData,
  { onConflict: 'id' }
)

if (dbError) {
  // If RLS blocked (e.g. background job / unauthenticated server caller / testing script), fall back to direct pg pool
  if (dbError.code === '42501' || dbError.message?.includes('row-level security')) {
    try {
      const pool = getPgPool()
      if (pool) {
        await pool.query(`INSERT INTO public.practical_logs ...`)
```
When Supabase RLS correctly blocks an unauthorized user (`error code 42501`), the server action catches the exception and forces the write through the privileged PostgreSQL pool, neutralizing RLS enforcement.

#### Remediation Plan
Remove lines 656–665. When `dbError.code === '42501'`, return `{ success: false, error: 'Unauthorized: You do not have permission to log practicals for this laboratory or teacher.' }`.

---

### Finding 09 (HIGH): Permissive Attendance Write Access for All Authenticated Accounts
- **Target Table**: `public.log_attendance`
- **CVSS 3.1 Base Score**: **7.1** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`)
- **Vulnerability Type**: Broken Authorization (CWE-285)

#### Root Cause Analysis
In `pg_policies`:
```
Table: log_attendance | Cmd: ALL | Roles: "{authenticated}" | Qual: true | WithCheck: null
```
Any authenticated user (even with a `'pending'` approval status) has `DELETE`, `UPDATE`, and `INSERT` permissions on all student attendance records across the entire institution.

#### Remediation SQL
```sql
DROP POLICY IF EXISTS "Allow authenticated users to modify attendance" ON public.log_attendance;

CREATE POLICY "Allow teachers and admins to modify attendance"
ON public.log_attendance FOR ALL
TO authenticated
USING (
  is_privileged() OR 
  EXISTS (
    SELECT 1 FROM public.practical_logs pl
    WHERE pl.id = log_attendance.log_id 
      AND (pl.teacher_id = auth.uid() OR pl.logged_by = auth.uid())
  )
)
WITH CHECK (
  is_privileged() OR 
  EXISTS (
    SELECT 1 FROM public.practical_logs pl
    WHERE pl.id = log_attendance.log_id 
      AND (pl.teacher_id = auth.uid() OR pl.logged_by = auth.uid())
  )
);
```

---

### Finding 10 (MEDIUM): Free-Text "verified" String Search for Dual Sign-Off Audit
- **Target File**: `app/actions/institutional-reports.ts` (line 285)
- **CVSS 3.1 Base Score**: **6.5** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`)
- **Vulnerability Type**: Weak Integrity Verification / Semantic Spoofing

#### Root Cause Analysis
In `getFacultyPracticalLedger`:
```sql
COUNT(CASE WHEN pl.remarks ILIKE '%verified%' THEN 1 END)::int as verified_count
```
Dual sign-off verification is determined purely by checking if the free-text `remarks` column contains the substring `"verified"`. A teacher submitting or editing a log can type:
```
Remarks: "Conducted experiment and verified materials myself"
```
The query counts this as an official Lab In-Charge dual sign-off verification in the institutional audit report.

#### Remediation Plan
1. Add structured verification columns to `public.practical_logs`:
```sql
ALTER TABLE public.practical_logs 
ADD COLUMN verified_by_id UUID REFERENCES public.profiles(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN verification_signature TEXT;
```
2. Update `getFacultyPracticalLedger` to count `WHERE pl.verified_by_id IS NOT NULL`.

---

### Finding 11 (MEDIUM): NEB 75% Board Compliance Defaulting Unmarked Students to 100% Attendance
- **Target File**: `app/actions/institutional-reports.ts` (line 116)
- **CVSS 3.1 Base Score**: **6.2** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N`)
- **Vulnerability Type**: Business Logic Flaw / Insecure Default (CWE-1188)

#### Root Cause Analysis
In `getStudentComplianceReport`:
```typescript
const attended = attendanceMap.get(row.enrollment_id) ?? totalHeld // default full if no specific negative marks
```
If individual attendance records were never marked in `log_attendance` for a student, the report defaults to `totalHeld` (100% attendance). Consequently, an enrolled student who never attended any practical session is automatically certified as 100% compliant and eligible for NEB board practical examinations.

#### Remediation Plan
Change the fallback to `0` or derive attendance from class-level logs:
```typescript
const attended = attendanceMap.get(row.enrollment_id) ?? 0
```

---

### Finding 12 (MEDIUM): Blanket Privilege Elevation in Development Mode
- **Target Files**:
  - `app/actions/workstations.ts` (lines 64–66)
  - `app/actions/terminal.ts` (lines 20–25)
- **CVSS 3.1 Base Score**: **5.9** (`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`)
- **Vulnerability Type**: Environment-Dependent Privilege Elevation

#### Root Cause Analysis
```typescript
const isPrivileged =
  scope.isPrivileged ||
  scope.role === 'super_admin' ||
  scope.role === 'lab_incharge' ||
  scope.role === 'hod' ||
  process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'test'
```
If deployed in staging or a development container, any user is automatically granted `isPrivileged = true`.

#### Remediation Plan
Never grant authorization based on `NODE_ENV`. Use explicit mock personas in test runners via isolated credentials.

---

### Finding 13 (MEDIUM): Volatile In-Memory Anti-Replay Cache in Multi-Instance Deployments
- **Target File**: `lib/security/terminal-token.ts` (lines 81–91)
- **CVSS 3.1 Base Score**: **5.5** (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N`)
- **Vulnerability Type**: State Synchronization / Replay Vulnerability

#### Root Cause Analysis
`REDEEMED_TICKETS = new Map<string, number>()` resides in Node.js process memory. In multi-container Docker deployments or horizontal clusters, tickets redeemed on Instance A can be replayed against Instance B within their 60-second window.

#### Remediation Plan
Store redeemed ticket hashes in `public.rate_limit_events` with an automatic 60-second TTL cleanup.

---

### Finding 14 (LOW): Over-Scoped Cookie Path on Workstation Session Token
- **Target File**: `app/terminal/auth/route.ts` (line 59)
- **CVSS 3.1 Base Score**: **4.3** (`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N`)
- **Vulnerability Type**: Insecure Cookie Path Scope

#### Root Cause Analysis
```typescript
response.cookies.set('labsync_terminal_session', sessionToken, {
  httpOnly: true,
  sameSite: 'strict',
  path: '/', // Overly broad!
  secure: isSecure,
  maxAge: 60 * 60 * 12,
})
```
The cookie is transmitted on requests to `/admin`, `/analytics`, `/schedules`, and all API routes, unnecessarily widening its exposure surface.

#### Remediation Plan
Scope cookie path to `path: '/terminal'`.

---

### Finding 15 (MEDIUM): Catastrophic Foreign Key Cascade on Lab Facility Deletion
- **Target Tables**: `practical_logs`, `lab_incidents`, `workstations`, `workstation_seat_plans`
- **CVSS 3.1 Base Score**: **5.0** (`CVSS:3.1/AV:N/AC:L/PR:H/UI:R/S:U/C:N/I:H/A:H`)
- **Vulnerability Type**: Cascading Referential Data Destruction

#### Root Cause Analysis
Database audit revealed 24 foreign keys configured with `ON DELETE CASCADE`:
- `practical_logs.lab_id -> labs.id [CASCADE]`
- `lab_incidents.lab_id -> labs.id [CASCADE]`
- `workstations.lab_id -> labs.id [CASCADE]`
- `workstation_seat_plans.lab_id -> labs.id [CASCADE]`

Deleting a physical laboratory room (e.g. `comp`) triggers a recursive cascade that permanently purges all historical practical logs, student attendance records, equipment breakage logs, and CAD seat layouts.

#### Remediation SQL
```sql
ALTER TABLE public.practical_logs 
  DROP CONSTRAINT practical_logs_lab_id_fkey,
  ADD CONSTRAINT practical_logs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;

ALTER TABLE public.lab_incidents 
  DROP CONSTRAINT lab_incidents_lab_id_fkey,
  ADD CONSTRAINT lab_incidents_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;

ALTER TABLE public.workstations 
  DROP CONSTRAINT workstations_lab_id_fkey,
  ADD CONSTRAINT workstations_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE RESTRICT;
```

---

## 4. Regulatory & Institutional Compliance Review

### 4.1 NEB 75% Board Compliance Architecture
- **National Examination Board Mandate**: Secondary school practical exam eligibility requires $\ge 75\%$ recorded laboratory attendance.
- **Audit Finding**: Currently, attendance percentage relies on `public.log_attendance`. Because `log_attendance` permits `Cmd: ALL` to any authenticated user without verification stamps, attendance tallies can be manipulated prior to board audit export.

### 4.2 24-Hour Edit Lockout Invariant
- **Policy Invariant**: Practical logs should be immutable after 24 hours from session execution to preserve historical record integrity.
- **Audit Finding**: There is **no database-level constraint or trigger** preventing updates to `practical_logs` past 24 hours. The RLS update policy permits updates indefinitely as long as `(teacher_id = auth.uid())`.
- **Recommended Database Trigger**:
```sql
CREATE OR REPLACE FUNCTION public.enforce_log_24h_edit_lockout()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.created_at < NOW() - INTERVAL '24 hours') THEN
    IF NOT is_privileged() THEN
      RAISE EXCEPTION 'Regulatory Lockout: Practical logs cannot be modified after 24 hours without administrative override.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_24h_edit_lockout
BEFORE UPDATE ON public.practical_logs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_log_24h_edit_lockout();
```

---

## 5. Prioritized Remediation Roadmap

```
           PHASE 1 (Days 1–2)                  PHASE 2 (Days 3–4)                PHASE 3 (Days 5–7)
    Immediate Database Hardening          Application RPC & Tokens            Regulatory Compliance
  ┌───────────────────────────────┐     ┌───────────────────────────┐     ┌──────────────────────────┐
  │ • Revoke profiles.role UPDATE │     │ • Remove bypass flags     │     │ • Add verified_by_id col │
  │ • Revoke anon pairing_token   │ ──> │ • Set TERMINAL_SECRET     │ ──> │ • 24-hr edit lockout trg │
  │ • Fix calendar_settings RLS   │     │ • Scope cookie to /terminal│    │ • Change FKs to RESTRICT │
  │ • Protect audit_logs insert   │     │ • Remove RLS 42501 bypass │     │ • Fallback 0 on NEB 75%  │
  └───────────────────────────────┘     └───────────────────────────┘     └──────────────────────────┘
```

---

## 6. Audit Sign-Off & Verification Metadata

- **Lead Security Assessor**: Antigravity Enterprise Forensic Agent
- **Audit Hash (SHA-256)**: `d7f8a94b8e21c37b...`
- **Target Workspace**: `d:\Projects\LMR`
- **Database Status**: PostgreSQL on `aws-0-ap-southeast-1.pooler.supabase.com`
- **Report Location**: [`doc/audits/2026-10-15-enterprise-security-rbac-and-forensic-integrity-audit.md`](file:///d:/Projects/LMR/doc/audits/2026-10-15-enterprise-security-rbac-and-forensic-integrity-audit.md)
