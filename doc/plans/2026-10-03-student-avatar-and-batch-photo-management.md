# Student Visual Identity & Batch Photo Management System

> **Date**: October 3, 2026  
> **Status**: Approved & Architected  
> **Target Modules**:  
> - Database: `public.students.photo_url`
> - Batch Ingestion: `lib/student-photos/matcher.ts`, `components/roster/batch-photo-import-modal.tsx`
> - CAD Workstations: `components/maintenance/workstations/workstation-node.tsx`, `components/computer-lab/station-quick-popover.tsx`
> - Attendance & Roll-Call: `app/(dashboard)/records/new/log-form.tsx`, `components/computer-lab/live-cockpit-bar.tsx`
> - Incident Register: `components/records/incident-records-table.tsx`, `components/records/incident-detail-drawer.tsx`
> - Class Roster: `components/roster/class-roster-view.tsx`

---

## 1. Executive Summary & Institutional Purpose

In academic laboratory management across Secondary and Higher Secondary institutions in Nepal (Class 11/12 and college labs), instructors and lab in-charges manage between 30 and 40 students per 90-minute practical session.

Text-only registers and numeric roll grids present significant cognitive friction:
1. **Misidentification**: Marking the wrong student absent during roll-call due to similar names (e.g. *Bikash Thapa* vs *Bikash Shrestha*).
2. **CAD Floor Disconnect**: Workstation nodes on the CAD floor map (`PC-01`, `PC-02`...) only show numeric roll labels. The instructor cannot visually verify if the student sitting at `PC-08` is the student actually assigned to that workstation.
3. **Equipment Accountability**: When lab equipment is damaged or broken during a practical, associating the responsible student requires indisputable visual identity rather than raw rolls.

This specification introduces a **full-lifecycle Student Visual Identity Engine**, powered by an automated **Batch Photo Matcher** supporting institutional photo naming conventions (`8_kaustuv_thapa.jpg`).

---

## 2. Multi-Factor Batch Photo Matching Engine

### 2.1 Institutional Naming Format: `<roll>_<name>.<ext>`
Schools typically provide student photos taken during ID card photography in the format:
`8_kaustuv_thapa.jpg` (or `08-kaustuv-thapa.png`, `14_aarav_sharma.jpeg`, `2_dipen.webp`).

### 2.2 Matching Algorithm (`lib/student-photos/matcher.ts`)
The parser executes a deterministic two-factor matching ladder:

```
                      ┌──────────────────────────────────────┐
                      │ Input File: "8_kaustuv_thapa.jpg"    │
                      └──────────────────┬───────────────────┘
                                         │
                                         ▼
                      ┌──────────────────────────────────────┐
                      │ Regex: /^(\d+)[-_ ]+(.+)\.([a-z]+)$/i│
                      │  • Extracted Roll: 8                 │
                      │  • Extracted Name: "kaustuv thapa"   │
                      └──────────────────┬───────────────────┘
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         │                                                               │
         ▼                                                               ▼
┌─────────────────────────────────┐             ┌─────────────────────────────────┐
│ FACTOR 1: Primary Roll Match    │             │ FACTOR 2: Name Cross-Validation │
│ Student in class with Roll = 8? │             │ Student name contains "kaustuv" │
│  & "thapa"?                     │
└────────────────┬────────────────┘             └────────────────┬────────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         │
                                         ▼
               ┌──────────────────────────────────────────────────┐
               │ CONFIDENCE CLASSIFICATION:                       │
               │  • Roll Match + Name Match    --> HIGH (Auto)    │
               │  • Roll Match only (Name diff)--> MEDIUM (Review)│
               │  • Name Match only (Roll diff)--> MEDIUM (Review)│
               │  • Neither                    --> UNMATCHED      │
               └──────────────────────────────────────────────────┘
```

1. **Rule 1 (High Confidence - Auto Match)**:
   - Both the parsed Roll Number and Student Name match the database enrollment record.
   - Example: File `8_kaustuv_thapa.jpg` matches `Student { roll: 8, name: "Kaustuv Thapa" }`.
   - Result: Auto-staged with green confirmation pill `✓ Matched (Roll + Name)`.
2. **Rule 2 (Medium Confidence - Name Review)**:
   - The roll number matches, but the name differs significantly (e.g. roll shift occurred, or nickname used).
   - Result: Staged with amber warning `Roll 8 (Name discrepancy: "Kaustuv" vs "Koustav")`.
3. **Rule 3 (Medium Confidence - Roll Shift Review)**:
   - The roll number is different, but the student's name is a unique match in the class.
   - Result: Staged with blue notice `Matched by Name: Kaustuv Thapa (Current Roll: 9)`.
4. **Rule 4 (Unmatched)**:
   - File could not be mapped to any student in the active class. Displayed in an "Unmatched Photos" tray where the admin can assign to a student via a single click.

---

## 3. Database & Storage Architecture

### 3.1 PostgreSQL Schema Update
Add `photo_url` column to `public.students`:
```sql
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN public.students.photo_url IS 'Base64 data URL or storage URI for student face avatar';
```

### 3.2 Client-Side Compression Pipeline
To guarantee that loading 35 workstation avatars on the CAD floor is instantaneous and runs at 60fps without network lag:
- Image Resizing: Clamped to `256 × 256` pixels (square face crop / aspect-fill).
- Compression: WebP/JPEG format at 75% quality.
- Target Payload: `< 20 KB` per student photo.
- Total Cohort Payload (35 students): `< 700 KB` (loads in under 50ms).

---

## 4. UI Touchpoints & User Experience

### 4.1 Touchpoint 1: Class Roster & Batch Import Modal (`/admin` &rarr; Class Roster)
- **Table Avatar Column**: Roster table displays a round avatar (`h-8 w-8`) next to the student's name.
  - Fallback: Initials badge (e.g., `KT` for Kaustuv Thapa) on a semantic indigo/slate tinted background.
  - Active Photo: Crisp circular thumbnail with subtle border.
- **Batch Photo Import Modal**:
  - Toolbar button: `<Camera /> <span>Batch Import Photos</span>`.
  - Dropzone accepting ZIP files, photo folders, or multi-selected image files.
  - Visual Reconciliation Grid showing all students in the class with their matched photo, extracted roll, confidence badge, and 1-click manual override dropdown.
  - Single atomic commit action (`uploadStudentPhotosAction`).
- **Single Photo Update**:
  - Clicking on an individual student row or their avatar opens a quick camera/upload popover to snap or replace that single student's photo.

### 4.2 Touchpoint 2: CAD Workstation Floor & Workstation Nodes
- **Workstation Living LCD Node (`components/maintenance/workstations/workstation-node.tsx`)**:
  - Under the workstation monitor bezel, the assigned student badge displays a circular avatar (`h-5 w-5`) beside the student's roll number and name.
  - **Zero Premature Attendance Halos**: Outside of an active roll-call log session, the system does not show speculative "Present" or "Absent" rings. It cleanly displays the assigned student's avatar, their roll, and their name.
  - **Hardware Telemetry Priority**: Clearly highlights whether the PC is **Operational**, **Flagged / Faulty**, or **Under Maintenance / Unavailable**.
- **Station Quick Popover (`components/computer-lab/station-quick-popover.tsx`)**:
  - Hovering or tapping a workstation displays a high-resolution student card with photo, full name, Roll No, and Admission No.
- **Future Elevation (Scheduled for dedicated floor plan milestone)**:
  - **Displaced Students Reassignment Queue**: A dedicated side-panel identifying all students whose assigned PCs are currently under repair or malfunctioning, enabling the Lab In-Charge to 1-tap reassign them to available workstations for that session.

### 4.3 Touchpoint 3: Practical Roll-Call & Absent Selector (`/logs/new` & Live Session)
- **Marked Absent Student Tray**:
  - In `/logs/new` and live session cockpit, when rolls are toggled absent (e.g. Roll 8, Roll 14), a dynamic **"Absent Students"** tray renders below the grid.
  - Each absent student is displayed as a tactile card with:
    - Student face avatar thumbnail.
    - Roll number badge (`R-08`).
    - Full name (`Kaustuv Thapa`).
    - Quick 1-tap `[x]` remove button to restore them to present if clicked accidentally.
  - Provides instant visual verification for the teacher before submitting the practical log.

### 4.4 Touchpoint 4: Incident Register & Detail View
- **Main Register Table (`/records/incidents`)**:
  - **Zero Visual Clutter**: The main table remains strictly clean and high-density, showing date, lab, equipment name, circumstances, and equipment photo thumbnail chip. No cluttering with multiple avatars in the table row.
- **Incident Detail Drawer (`components/records/incident-detail-drawer.tsx`)**:
  - When an incident has responsible students tagged (`student_rolls` or linked students):
  - Renders a dedicated **"Responsible / Involved Student(s)"** card featuring:
    - Student face photo avatar.
    - Student full name, roll number, and class.
    - Admission ID / RFID.
  - Renders the reporting teacher's avatar and role badge under "Session Instructor".

---

## 5. Implementation Roadmap & Execution Plan

| Phase | Tasks | Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | Schema & Server Actions | Add `photo_url` to `public.students`, update TypeScript models, create `batchUpdateStudentPhotosAction` & `updateStudentPhotoAction`. |
| **Phase 2** | Smart Matcher Engine | Implement `lib/student-photos/matcher.ts` with regex parsing for `<roll>_<name>.<ext>`, multi-factor matching, and confidence ranking. |
| **Phase 3** | Batch Import Modal & Roster UI | Build `components/roster/batch-photo-import-modal.tsx` and integrate avatar column into `components/roster/class-roster-view.tsx`. |
| **Phase 4** | CAD Floor & Workstation Nodes | Update `WorkstationNode` and `StationQuickPopover` to render student avatar chips with attendance halos. |
| **Phase 5** | Roll-Call Absent Selector & Drawer | Add visual Absent Student Tray to `/records/new/log-form.tsx` and Student Involved card to `IncidentDetailDrawer`. |
| **Phase 6** | Verification & Test Suite | Automated test suite for matcher engine and server actions (`npx tsc --noEmit` & 0 errors). |
