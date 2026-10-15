# Staff & Faculty Profile Pictures Architecture

> **Date**: October 4, 2026  
> **Status**: Approved & Architected  
> **Target Roles**: Teachers (`teacher`), Lab In-Charge (`lab_incharge`), Head of Department (`hod`), and Super Admin (`super_admin` / `admin`)  
> **Target Modules**:  
> - Database: `public.profiles.photo_url` & `public.profiles.avatar_url`
> - Server Actions: `app/actions/auth.ts` (`getCurrentUserProfile`, `getAllUsers`, `updateCurrentUserPhoto`, `updateUserProfilePhoto`, `updateUserCredentials`)
> - Top Navigation: `components/layout/user-profile-menu.tsx`
> - Admin Console: `components/admin/user-access-manager.tsx` (Table, Drawer, Edit Modal)
> - Faculty State: `hooks/use-infrastructure-state.ts`
> - Touchpoints: `components/records/incident-detail-drawer.tsx`, `components/dashboard/live-session-cockpit.tsx`

---

## 1. Executive Summary & Purpose

Following the deployment of the Student Visual Identity System, institutional staff and faculty require equal visual representation across LabSync LIMS / LMR:
1. **Top Navbar Identity**: Logged-in Teachers, Lab In-Charges, HODs, and Super Admins currently see initials (`LA`, `KT`). A real face avatar personalizes the operational command center and instills institutional ownership.
2. **Staff Directory & RBAC Management**: In `/admin` Tab 04 ("User Accounts" / Staff Directory), administrators managing faculty accounts can visually identify teachers and laboratory managers.
3. **Self-Service & Admin Management**:
   - Any authenticated user can upload, change, or remove their own profile photo directly from the top-right user menu.
   - Super Admins can set or update any staff member's photo from the User Access Manager directory or drawer.
4. **Contextual Recognition**:
   - In the **Incident Detail Drawer**, the supervising Subject Teacher appears with their real face photo chip.
   - In the **Live Session Cockpit**, the ongoing session displays the instructor's photo avatar.

---

## 2. Technical Architecture & Data Models

### 2.1 Database Schema (`public.profiles`)
Add `photo_url` and `avatar_url` to `public.profiles`:
```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.photo_url IS 'Base64 data URL or storage URI for user profile avatar';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Alias/fallback storage URI for user profile avatar';
```

### 2.2 Client-Side Compression (< 20 KB)
- Clamped to 256×256 pixels, square center-crop.
- WebP/JPEG format at 75% quality.
- Embedded as compact Data URLs, requiring zero external S3 bucket setup and loading instantaneously with 0 network roundtrips.

---

## 3. Server Actions & Security Architecture

1. `updateCurrentUserPhoto(photoUrl: string)`:
   - Validates active session via `getServerUserScope()`.
   - Updates `public.profiles` for the caller's UUID.
   - Invalidates in-memory user cache and calls `revalidatePath('/', 'layout')`.
2. `updateUserProfilePhoto(userId: string, photoUrl: string)`:
   - Guarded by Super Admin scope check.
   - Records an immutable audit event (`UPDATE` on `user_role`).
3. `updateUserCredentials(userId, data)`:
   - Accepts optional `photo_url` to support updating photo during full credential edits.
4. `getAllUsers()` & `getCurrentUserProfile()`:
   - Explicitly queries and returns `photo_url` and `avatar_url`.

---

## 4. UI Touchpoints

1. **Header User Profile Menu (`components/layout/user-profile-menu.tsx`)**:
   - Trigger button: Crisp circular photo avatar inside role-tinted ring (Amber for Super Admin, Indigo for Lab Incharge / HOD, Slate for Teacher), with initials fallback.
   - Popover card: Large profile banner avatar with hover camera overlay allowing 1-click photo upload or removal.
2. **User Access Manager (`components/admin/user-access-manager.tsx`)**:
   - Staff directory table: 34×34px avatar chip for each user row with initials fallback and click-to-upload.
   - Slide-over Drawer: Large 64×64px avatar with `<Camera className="h-4 w-4" />` upload trigger.
   - Edit Modal: Photo preview and upload button.
3. **Incident Detail Drawer (`components/records/incident-detail-drawer.tsx`)**:
   - Subject Teacher metadata card shows the teacher's photo avatar alongside their name.
4. **Live Session Cockpit (`components/dashboard/live-session-cockpit.tsx`)**:
   - Ongoing practical session card shows the instructor's photo avatar chip.

---

## 5. Verification Protocol
- `npx tsc --noEmit` must pass with 0 errors.
- Automated tests covering profile photo updates and retrieval.
