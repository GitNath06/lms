# Task 47: Institutional Password Policy, Dynamic Checklist & Immediate Read-Only Preview Access

**Date**: 2026-10-17  
**Status**: Completed  
**Author**: Antigravity AI  

---

## 1. Context & Institutional Objective

Academic laboratory staff registration previously allowed minimal 6-character passwords and blocked users from entering the dashboard entirely until an administrator approved their account (`approval_status = 'pending'`).

To align with institutional security benchmarks and elevate user onboarding experience:
1. **Password Security Policy**: Implemented institutional password criteria (8+ characters, uppercase, lowercase, numeric digit, and special character/symbol).
2. **Interactive UI Checklist**: Embedded a real-time reactive password checklist with strength scoring bar and password visibility toggles (`Eye` / `EyeOff`) across registration and self-service password reset flows.
3. **Pre-OTP Validation Invariant**: Validated password complexity on the client and server *before* sending OTP codes to prevent unnecessary SMS/email dispatches on invalid credentials.
4. **Immediate Read-Only Preview Access**: Permitted verified pending accounts to authenticate and enter the dashboard in **Read-Only Preview** mode with an informative top banner, while maintaining strict server-side authorization guards preventing writes or approvals.

---

## 2. Changes Made

### A. Core Authentication Policy Engine (`lib/auth-policy.ts`)
- Defined `validatePasswordPolicy(password)` exporting:
  - `criteria.minLength` (>= 8 chars)
  - `criteria.hasUpper` (A-Z)
  - `criteria.hasLower` (a-z)
  - `criteria.hasNumber` (0-9)
  - `criteria.hasSpecial` (!@#$%^&*)
  - `score` (0–5), `strength` (`'weak' | 'fair' | 'good' | 'strong'`), `isValid`, and human-readable `errors`.

### B. Reactive Password Checklist (`components/auth/password-requirements-checklist.tsx`)
- Visual strength gauge bar with dynamic colors (`bg-rose-500`, `bg-amber-500`, `bg-indigo-500`, `bg-emerald-500`).
- Interactive checkmark icons displaying real-time pass/fail states for each criterion.
- Optional password confirmation match indicator (`Passwords match`).

### C. Server-Side Pre-Flight Guards (`app/actions/otp.ts`)
- Updated `generateAndSendSignupOtp(email, fullName, password)` to validate password policy before dispatching verification email/OTP.
- Enforced password policy in `verifySignupAndCreateAccount` before inserting into PostgreSQL.
- Enforced password policy in `verifyAndResetPassword` before updating user password.

### D. Read-Only Preview Experience (`app/(dashboard)/layout.tsx`)
- Added `components/dashboard/pending-verification-banner.tsx` displaying an elevated yellow warning strip with an informative badge for accounts where `approval_status === 'pending'`.
- Clarified that practical session recording and configuration changes require Super Administrator approval.

### E. Login & Registration Modal Redesign (`app/(auth)/login/page.tsx`)
- Dual password inputs with individual `Eye` / `EyeOff` visibility toggles.
- Real-time client-side password policy validation and confirmation match check.
- Automatic sign-in transition upon successful OTP verification with a clear "Enter Dashboard (Read-Only Preview)" CTA.

---

## 3. Verification & Invariant Enforcement

- **TypeScript Compilation**: `npx tsc --noEmit` passed with **0 errors**.
- **Unit Test Suite**: Created and passed `tests/password-policy-and-approval.test.mjs` (7/7 tests passing).
- **Core Domain & Security Invariants**: Verified `tests/admin-guards.test.mjs` and `tests/unit-domain-invariants.test.mjs` (17/17 passing).
