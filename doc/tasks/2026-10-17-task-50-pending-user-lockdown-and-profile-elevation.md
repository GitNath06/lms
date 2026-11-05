# Task 50: Pending Account Strict Profile Lockdown & Enterprise Profile Elevation

**Date**: 2026-10-17  
**Status**: Completed  
**Focus**: Pending Account Strict Profile Confinement, Server-Side Action Hardening, Avatar Management & Institutional In-Review Profile Elevation  

---

## 1. Problem Statement & Operational Context

During physical end-to-end verification of newly self-registered staff and faculty accounts (`approval_status === 'pending'`), several critical enterprise and UX vulnerabilities were identified:

1. **Dashboard & Operational Tab Exposure**: Unverified pending users were not confined to their profile page. They could access operational views (`/`, `/records`, `/schedules`, `/computer-lab`, `/maintenance`, `/incidents`) or switch view filters from `my_data` to institutional `all`.
2. **Server-Side Action Bypasses**: Critical mutation endpoints (`createPracticalLog`, `updatePracticalLog`, `deletePracticalLog`, `submitLiveSession`, `createAdHocSession`, `reportWorkstationIssue`, `saveMaintenancePlan`, `deleteMaintenancePlan`, `createSchedule`, `deleteSchedule`, `unmergeSchedule`, `reportIncident`, `escalateIncidentToHOD`, `updateIncidentStatus`) did not explicitly reject requests from accounts with `approval_status === 'pending'`. Users declaring `lab_incharge` or `super_admin` upon registration could temporarily acquire privileged scopes before administrator approval.
3. **Password Policy Pre-OTP Verification Gap**: The server-side OTP generation action did not strictly require a non-empty password before dispatching the 6-digit email verification code.
4. **Incomplete Profile Page (`/profile`) Experience**:
   - Missing Profile Picture (avatar) uploader with live preview, cloud storage sync, and removal option.
   - Missing institutional in-review notice hero explaining the verification status and administrative workflow.
   - Missing display of assigned curriculum batches, practical subjects, and laboratory facilities (or the clear pending approval notice).
   - Inaccurate green "Approved" badge displayed for pending users on the profile page.

---

## 2. Architecture & Technical Implementation

### A. Strict Navigation Confinement & Navigation Pruning
- **Middleware Guard (`middleware.ts`)**:
  - Checks `session_user` cookie. If `approval_status === 'pending'`, any navigation to routes other than `/profile` (e.g. `/`, `/records`, `/schedules`, `/computer-lab`, `/maintenance`, `/incidents`, `/admin`, `/login`) is immediately intercepted and redirected to `/profile?notice=pending_verification`.
- **Sidebar & Mobile Navigation Filtering (`components/layout/collapsible-sidebar.tsx`, `components/layout/mobile-nav.tsx`, `app/(dashboard)/layout.tsx`)**:
  - Propagates `isPending` boolean to navigation components.
  - When `isPending === true`, completely hides all operational tabs (`Dashboard`, `Timetable`, `Logbook`, `Incidents`, `Floor Plan`, `Maintenance`, `Report`) and Super Admin links.
  - Displays only **Faculty Profile** (`/profile`) along with an amber **"Account In-Review"** status pill.

### B. User Scope & Server-Side Mutation Hardening
- **User Scope Model (`lib/context/user-scope.ts`, `lib/context/server-user-scope.ts`)**:
  - Explicitly adds `approvalStatus: 'pending' | 'approved' | 'rejected'` and `isPending: boolean`.
  - In `resolveUserScope()`, if `approvalStatus === 'pending'`, the user scope is strictly locked down: `isPrivileged = false`, `assignedClasses = []`, `assignedSubjects = []`, `assignedLabIds = []`, regardless of any role claimed during registration.
  - In `server-user-scope.ts`, skips querying active `class_subjects` for pending accounts.
- **Server Action Guards**:
  - **Practical Logs (`app/actions/logs.ts`)**: `createPracticalLog`, `updatePracticalLog`, and `deletePracticalLog` reject mutations with `"Permission denied: Your account is pending verification."`. `getPracticalLogs` and `getTodayLogStats` return empty arrays/zeroed metrics for pending users.
  - **Live Lab Cockpit (`app/actions/live-session.ts`)**: `submitLiveSession` and `createAdHocSession` reject execution with `"Unauthorized: Your faculty account is pending verification."`.
  - **Workstation Fleet & Issues (`app/actions/workstations.ts`)**: `reportWorkstationIssue`, `updateWorkstation`, and `deleteWorkstation` enforce pending account rejection.
  - **Lab Maintenance (`app/actions/maintenance.ts`, `app/actions/maintenance-templates.ts`)**: `getAuthorizedProfile()` and `checkPrivilege()` enforce `!scope.isPending && scope.approvalStatus !== 'pending'`, locking `saveMaintenancePlan`, `deleteMaintenancePlan`, and `logMaintenanceService`.
  - **Timetable Schedules (`app/actions/schedules.ts`)**: `createSchedule`, `deleteSchedule`, `mergeSchedules`, and `unmergeSchedule` strictly reject pending accounts.
  - **Incident Register (`app/actions/incidents.ts`)**: `reportIncident`, `escalateIncidentToHOD`, and `updateIncidentStatus` reject pending accounts.
  - **Workstation Seat Plans (`app/actions/seat-plans.ts`)**: `assignStudentToSeat`, `swapStudents`, `autoAssignRemainingSeats`, and `clearAllCohortSeats` enforce `!scope.isPending`.

### C. Authentication & Password Pre-Check Enforcement
- **OTP Generation (`app/actions/otp.ts`)**:
  - `generateAndSendSignupOtp`: Strictly validates that password is non-empty and validates all 5 policy criteria (minimum 8 characters, uppercase, lowercase, number, special character) *before* issuing any verification code.
- **Login Flow (`app/actions/auth.ts`, `app/(auth)/login/page.tsx`)**:
  - Directs newly registered and pending accounts directly to `/profile`.

### D. Enterprise Profile Page (`/profile`) Elevation
- **Avatar Management (`components/profile/teacher-profile-form.tsx`, `app/actions/profile.ts`)**:
  - Embedded profile picture uploader with square live preview, initials fallback badge, file size/type validation, 1-click cloud storage sync via `updateTeacherAvatar()`, and a dedicated remove option.
- **Institutional In-Review Hero Banner**:
  - Displayed prominently at the top of `/profile` when `isPending` is true. Features an amber status hero with an animated clock icon, clear explanation of the review process, and a 3-step security milestone indicator.
- **Assigned Curriculum & Laboratory Scope**:
  - Intelligently switches between an informative pending explanation box (for unapproved faculty) and a structured view of assigned classes, designated laboratories, and practical subject modules (for approved faculty).
- **Security & Institutional Clearance**:
  - Corrected account status pills: amber `Pending Approval` with clock icon for pending accounts, emerald `Verified` with checkmark for approved accounts, and rose `Rejected` for rejected accounts.

---

## 3. Verification & Automated Test Suite

- **Automated Test Suite**: Created [`tests/pending-user-lockdown.test.mjs`](file:///d:/Projects/LMR/tests/pending-user-lockdown.test.mjs) covering:
  1. `resolveUserScope` strict lockdown for pending accounts across all roles.
  2. `generateAndSendSignupOtp` pre-OTP password policy verification.
  3. Server mutation rejection across practical logs, live sessions, workstation issues, timetable schedules, and incidents when executed under a pending session.
- **Test Results**: All 4 subtests passed (`pass: 4, fail: 0`).
- **Strict TypeScript Compliance**: `npx tsc --noEmit` exited with code 0 (0 compile errors across all routes and components).
