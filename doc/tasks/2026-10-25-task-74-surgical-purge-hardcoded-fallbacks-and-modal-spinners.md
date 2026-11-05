# Task 74: Surgical Purge of Hardcoded Fallbacks & Modal Loading Spinner Injection

**Date**: 2026-10-25  
**Status**: Completed  
**Subsystems Affected**: Server Actions (`records.ts`, `logs.ts`, `incidents.ts`, `auth.ts`, `otp.ts`), Modals & Drawers (`report-incident-modal.tsx`, `incident-categories-manager.tsx`, `snooze-modal.tsx`, `incident-detail-drawer.tsx`, `practical-detail-modal.tsx`, `advanced-calendar.tsx`, `session-action-modal.tsx`), Context & Hooks (`user-scope.ts`, `use-logs-state.ts`, `use-incident-state.ts`, `use-routine-state.ts`).

---

## 1. Executive Summary

Static analysis identified legacy prototype hardcoded teacher name fallbacks, mock memory arrays, hardcoded department strings, and missing submission spinner/auto-close feedback in modals and drawers.

This task surgically executed all 5 required remediations without regressions:
1. Purged hardcoded mock stores and teacher dictionaries from server actions so queries strictly return live PostgreSQL rows (or empty `[]`).
2. Purged hardcoded teacher names and department fallback strings in context, modals, routine manager, demo logins, and input placeholders.
3. Verified initial `isLoading` states start as `true` in custom hooks and admin tables to prevent empty-data flash on mount.
4. Added submission loading spinners (`<Loader2 className="animate-spin" />`), disabled states, inline error banners, and clean auto-close (`onClose()` before `onSuccess()`) across all 6 flagged modals and drawers.
5. Verified 0 scanner matches and 0 TypeScript compilation errors (`npx tsc --noEmit`).

---

## 2. Changes Implemented

### Track 1: Server Actions Hardcoded Mock Purge
- **`app/actions/records.ts`**:
  - Removed `FALLBACK_PRACTICAL_LOGS` and `FALLBACK_INCIDENTS` seed arrays containing `'Dr. Rajesh Sharma'`, `'Dr. Prakash Adhikari'`, `'Dr. Nirmala Poudel'`, `'Er. Anish Karki'`, `'Ms. Sunita Thapa'`, and `'All 38 workstations functioning properly'`.
  - Initialized in-memory fallbacks to empty arrays `[]`.
- **`app/actions/logs.ts`**:
  - Deleted `SEED_PRACTICAL_LOGS` and `TEACHER_NAME_MAP`.
  - Replaced fallback teacher assignment `'t1'` with `null`.
  - Removed `|| 'Period 1 (10:10 - 11:00)'` fallback on period label.
- **`app/actions/incidents.ts`**:
  - Purged `IN_MEMORY_INCIDENTS` and `IN_MEMORY_NOTIFICATIONS` mock objects to empty arrays `[]`.
- **`app/actions/auth.ts` & `app/actions/otp.ts`**:
  - Removed all `|| 'Science Department'` fallbacks across lines 133, 348, 393, 469 in `auth.ts` and line 231 in `otp.ts`. Fields now pass `null`, strictly upholding AGENTS.md Rule #5.

### Track 2: Hardcoded Teacher & Department Fallbacks in Modals & Context
- **`components/admin/routine-manager.tsx`**:
  - Replaced `setFormTeacher(assignedTeach?.full_name || 'Er. Anish Karki')` with `setFormTeacher(assignedTeach?.full_name || '')`.
- **`components/schedules/session-action-modal.tsx`**:
  - Deleted `TEACHER_NAME_MAP`.
  - Replaced fallback `|| 'Dr. Rajesh Sharma'` with `|| ''`.
  - Replaced `slotObj?.label || '10:10 - 11:00'` with `slotObj?.label || ''`.
- **`components/dashboard/report-incident-modal.tsx`**:
  - Replaced fallback `|| 'Dr. Prakash Adhikari'` with `|| ''`.
  - Added inline error banner for failed server responses.
- **`app/(auth)/login/page.tsx` & `components/admin/user-access-manager.tsx`**:
  - Replaced hardcoded demo account names with institutional role titles (`'Laboratory In-Charge'`, `'Physics Department Faculty'`, `'Computer Department Faculty'`).
  - Replaced placeholder `placeholder="e.g. Dr. Prakash Adhikari"` with generic Nepalese name `placeholder="e.g. Ram Bahadur Thapa"`.

### Track 3: Verification of Empty-Flash Loading States
- **`components/admin/incident-categories-manager.tsx`**:
  - Verified `const [isLoading, setIsLoading] = useState(true)` and verified table body loading skeleton/spinner (`<Loader2 className="animate-spin text-indigo-500" />`).
- **`hooks/use-logs-state.ts`**, **`hooks/use-incident-state.ts`**, and **`hooks/use-routine-state.ts`**:
  - Confirmed `const [isLoading, setIsLoading] = useState<boolean>(true)` is initialized to `true` across all three hooks until initial PostgreSQL fetch completes.

### Track 4: Modal & Drawer Loading Spinners, Error Banners & Clean Auto-Close
- **`components/admin/incident-categories-manager.tsx`**:
  - Added `isConfirming` state to `confirmDialog` with `<Loader2 className="animate-spin" />` (`"Archiving..."` / `"Deleting..."`), disabled state during mutation, and auto-close before `triggerToast`.
- **`components/dashboard/report-incident-modal.tsx`**:
  - Added `formError` state, rendered inline alert banner on failure, checked `res.error`, and invoked `onClose()` before `onSuccess()`.
- **`components/maintenance/snooze-modal.tsx`**:
  - Replaced button label literal `+` presets with clean labels (`'3 Days'`, `'7 Days'`, `'14 Days'`).
  - Added `<Loader2 className="animate-spin" />` spinner and disabled state during submission.
  - Ensured `onClose()` is invoked before `onSuccess()`.
- **`components/records/incident-detail-drawer.tsx`**:
  - Added `submittingAction` state tracking individual button actions (`'under_repair'`, `'replaced'`, `'resolved'`, `'escalate'`).
  - Injected `<Loader2 className="animate-spin" />` inside active action button while disabling all buttons.
  - Ensured `onClose()` is invoked before `onSuccess()`.
- **`components/records/practical-detail-modal.tsx`**:
  - Added `<Loader2 className="animate-spin" />` spinner inside Save Modifications button and Confirm Delete button.
  - Ensured `onClose()` is invoked before `onSuccess()`.
- **`app/(dashboard)/schedules/advanced-calendar.tsx`**:
  - Added `isSubmittingDecline` and `declineError` states to inline decline modal.
  - Wired `handleConfirmDecline` to await `rejectSlotBooking`, display inline error banner on catch, close modal, and display toast.
  - Added disabled state and `<Loader2 className="animate-spin" />` spinner to Confirm Decline button.

---

## 3. Verification & Compliance Evidence

1. **Static Scanner Verification**:
   - Ran `node scratch/scan-mocks.mjs` scanning `app/`, `components/`, `hooks/`, `lib/` for:
     - `'Rajesh Sharma'`, `'Prakash Adhikari'`, `'Nirmala Poudel'`, `'Anish Karki'`, `'Sunita Thapa'`, `'Science Department'`, `'All 38 workstations functioning properly'`.
   - **Result**: Exactly 0 occurrences remaining.
2. **TypeScript Strict Type Check**:
   - `npx tsc --noEmit` exited with code 0 (0 errors).
3. **Automated Test Suites**:
   - Ran `tests/ux-loading-and-modal-contract.test.mjs`, `tests/phase3-mock-purge.test.mjs`, `tests/verify-empty-array-traps.test.mjs`, `tests/practical-log-form-and-subject-clean.test.mjs`, `tests/phase1-canonical-actions.test.mjs`.
   - **Result**: 100% passed (0 failed).
