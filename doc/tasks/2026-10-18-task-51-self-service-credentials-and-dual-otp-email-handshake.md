# Task 51: Self-Service Credentials Management & Dual-OTP Email Change Handshake

> **Authoritative Log**: Executed on October 18, 2026  
> **Status**: COMPLETED  
> **Target Subsystems**: `app/actions/profile-credentials.ts`, `lib/mailer.ts`, `components/profile/teacher-profile-form.tsx`, `tests/profile-credentials.test.mjs`, `lib/audit/audit-ledger.ts`

---

## 1. Context & Operational Imperative

Faculty and staff members operating laboratory workstations frequently needed self-service capabilities to manage their security credentials without administrative intervention:
1. **Password Updates**: Changing login passwords directly from their institutional profile while strictly complying with institutional password policies and validating the current password.
2. **Institutional Email Updates**: Updating email addresses in shared laboratory computer environments. In schools and computer labs where faculty members might leave workstations unlocked, a naive email change mechanism creates a severe account takeover vector.
3. **The Dual-OTP Security Handshake**:
   - The user explicitly required: **Current Password Re-Authentication** + **OTP Verification sent to Old (Current) Email** + **OTP Verification sent to New Email**.
   - **Why this makes absolute security sense**:
     - **Old Email OTP (Authorization Gate)**: Prevents session hijacking or rogue actions if someone accesses an unattended logged-in browser session. The attacker cannot steal the account because the legitimate account owner immediately gets an alert and the authorization code on their primary inbox.
     - **New Email OTP (Ownership & Destination Gate)**: Prevents accidental lockouts caused by typos (e.g. typing `@gnail.com` instead of `@gmail.com`) and proves authentic control over the target inbox before any database records are modified.
     - **Current Password Gate**: Proves the person initiating the change knows the root secret of the account.

---

## 2. Architecture & Implementation

### A. Dual-Channel Email Dispatch (`lib/mailer.ts`)
Added two dedicated institutional email notification templates:
- `sendOldEmailChangeSecurityOtp(oldEmail, fullName, otpCode, targetNewEmail)`:
  Dispatches an urgent security notification with a high-contrast amber security badge, explaining that an email transfer to `targetNewEmail` was requested. Dispatches the 6-digit authorization code and instructs the user to alert the IT office immediately if they did not initiate the request.
- `sendNewEmailChangeVerificationOtp(newEmail, fullName, otpCode)`:
  Dispatches a clean verification email to the prospective address with a 6-digit confirmation code and a 10-minute expiry warning.

### B. High-Assurance Server Actions (`app/actions/profile-credentials.ts`)
Constructed three transactional server actions:
1. `changeCurrentPassword({ currentPassword, newPassword, confirmPassword })`:
   - Validates user session.
   - Enforces `validatePasswordPolicy(newPassword)` against institutional complexity requirements.
   - Confirms `newPassword !== currentPassword`.
   - Re-authenticates `currentPassword` against `auth.users.encrypted_password` using PostgreSQL `crypt()`.
   - Atomically updates `auth.users.encrypted_password` using `crypt($1, gen_salt('bf', 10))`.
   - Records forensic event in `public.audit_ledger` with `action: 'UPDATE'` and `entityType: 'policy'`.
   - Invalidates user profile cache and revalidates `/profile`.
2. `initiateDualOtpEmailChange({ currentPassword, newEmail })`:
   - Re-authenticates user identity with `currentPassword`.
   - Validates `newEmail` format and checks `auth.users` for duplicate accounts.
   - Ensures `newEmail !== currentEmail`.
   - Generates two distinct 6-digit cryptographically random numeric OTPs.
   - Records both into `public.email_otps` with purposes `'email_change_old'` and `'email_change_new'` with a 10-minute expiry.
   - Dispatches both emails concurrently via `Promise.all`.
   - In non-production environments, provides `devOtpOld` and `devOtpNew` helpers for streamlined QA.
3. `confirmDualOtpEmailChange({ currentPassword, newEmail, oldEmailOtp, newEmailOtp })`:
   - Re-verifies user session and current password.
   - Validates the Old Email OTP from `public.email_otps` with attempt-limiting (max 5 attempts).
   - Validates the New Email OTP from `public.email_otps` with attempt-limiting.
   - Executes an atomic PostgreSQL transaction (`BEGIN ... COMMIT`):
     - Marks both OTPs as verified (`is_verified = TRUE`).
     - Migrates `auth.users.email`.
     - Migrates `auth.identities.identity_data` (updating `sub` and `email`).
     - Migrates `public.profiles.email`.
   - Records forensic audit trail in `public.audit_ledger`.
   - Purges user profile caches and revalidates dashboard layouts.

### C. Tabbed Profile Interface (`components/profile/teacher-profile-form.tsx`)
Elevated `/profile` with a 3-tab layout:
- **Tab 1: Academic Profile & Scope**: Name, honorific, phone, biographical statement, institutional role badge, designated laboratories, and curricular practical subjects table.
- **Tab 2: Security & Credentials**:
  - **Change Account Password card**: Eye visibility toggles, interactive `PasswordRequirementsChecklist` showing real-time feedback as the user types, and confirmation matching.
  - **Change Institutional Email card**: High-clarity Dual-Channel Handshake badge and institutional explanation banner. Step 1 (password re-authentication + target email) transitioning to Step 2 (Dual OTP code inputs with 60-second resend countdown and change destination shortcut).
  - **Institutional Clearance & Session Telemetry card**: Role, Account Status, and Operational Clearance summary.
- **Tab 3: Preferences & Alerts**: Practical subject focus chips, timetable conflict alerts, and 15-minute practical reminder preferences.

---

## 3. Invariants & Rules Preserved

1. **Rule #1 (No Literal `+` in Buttons)**:
   All buttons utilize Lucide icons (`<Plus className="h-3.5 w-3.5" />`, `<KeyRound className="h-4 w-4" />`, `<Check className="h-4 w-4" />`).
2. **Rule #8 (Strict TypeScript Compilation)**:
   Passed `npx tsc --noEmit` with 0 compile errors.
3. **Rule #13 (Next.js `'use server'` Export Rules)**:
   `app/actions/profile-credentials.ts` strictly exports only asynchronous functions.
4. **Rule #16 (Zero Shadow Databases)**:
   Credentials operations interface directly with live PostgreSQL `auth.users`, `auth.identities`, and `public.profiles`.

---

## 4. Verification & Automated Test Suite

Created and executed `tests/profile-credentials.test.mjs`:
- `1. Enforces institutional password policy correctly` &rarr; **PASSED**
- `2. Verifies current password authentication against crypt()` &rarr; **PASSED**
- `3. Atomically updates password with bcrypt hash` &rarr; **PASSED**
- `4. Simulates Dual-OTP generation for old and new email addresses` &rarr; **PASSED**
- `5. Rejects mismatched OTPs during Dual-OTP handshake` &rarr; **PASSED**
- `6. Atomically confirms Dual-OTP email migration across auth.users, auth.identities, and public.profiles` &rarr; **PASSED**

All 6 tests passed cleanly alongside regression test suites (`teacher-preferences-and-profile.test.mjs`, `pending-user-lockdown.test.mjs`, `password-policy-and-approval.test.mjs`).
