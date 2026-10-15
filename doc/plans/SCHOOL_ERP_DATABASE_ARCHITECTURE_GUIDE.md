# Real-World School ERP Database Architecture & Student Lifecycle Guide

> **Target Audience**: LabSync LIMS (LMR) Engineering & Administration  
> **Status**: Canonical Reference Guide  
> **Location**: `doc/plans/SCHOOL_ERP_DATABASE_ARCHITECTURE_GUIDE.md`  

---

## 1. The Core Philosophy: Identity vs. Temporal Enrollment

In amateur database designs, student tables often have:
```sql
-- ❌ BAD DESIGN (Breaks historical data)
CREATE TABLE students (
    id UUID PRIMARY KEY,
    name TEXT,
    grade INT,       -- e.g. 9
    roll_number INT  -- e.g. 14
);
```
**Why this fails:** When a student passes to Grade 10, changing `grade = 10` and `roll_number = 12` destroys their Grade 9 attendance, report cards, practical logs, and exam history.

### The Enterprise SIS Solution: 2 Decoupled Tables
```
┌──────────────────────────────────────┐
│  public.students (Permanent Person)  │
├──────────────────────────────────────┤
│ id (UUID, permanent)                 │
│ admission_no (Permanent School ID)   │
│ full_name, gender, dob               │
│ created_at                           │
└──────────────────┬───────────────────┘
                   │ 1 : Many
                   ▼
┌──────────────────────────────────────┐
│ public.student_enrollments (Annual)  │
├──────────────────────────────────────┤
│ id (UUID, per academic year)         │
│ student_id (FK -> students.id)       │
│ academic_year_id ('2083', '2084')    │
│ class_id ('11sci', '12sci')          │
│ roll_number (Roll in THAT year)      │
│ status ('active' | 'archived' | ...) │
└──────────────────────────────────────┘
```

- **`students`** is created **once** upon admission and is never deleted.
- **`student_enrollments`** creates a new row **every year**. 
- A student who spends 2 years in school has **1 student record** and **2 enrollment records**.

---

## 2. How Everything Links Together (The Relational Web)

```
[ Academic Year ] (e.g. 2083/84)
       │
       ├──► [ Classes ] (e.g. Grade 11 Science)
       │         │
       │         ├──► [ Class Subjects ] (Physics, Chemistry, Computer)
       │         │           │
       │         │           └──► [ Timetable / Schedules ] ◄── [ Teachers ]
       │         │
       │         └──► [ Student Enrollments ] ◄── [ Students (Identity) ]
       │                     │
       │                     ├──► [ Roll Attendance / Practical Logs ]
       │                     └──► [ Workstation Seat Plans ]
```

1. **Subjects**: `subjects` contains master subjects (e.g., Computer Science, Physics).
2. **Class Curriculum**: `class_subjects` connects subjects to classes (`class_id = '11sci'`, `subject = 'Computer'`).
3. **Teacher Assignment**: `schedules` links `(teacher_id, class_subject_id, lab_id, day_of_week, time_slot)`.
4. **Student Daily Operations**: Practical logs and attendance point to `enrollment_id`. If someone asks "Who was present on 2083-05-12 in Grade 11?", the system looks at the 2083 enrollment record, preserving their 2083 roll number forever.

---

## 3. How Upgrades / Promotions Actually Work (The 3 Cases)

At the end of an academic year (e.g., transitioning from Year 2083 to Year 2084):

### Case A: Standard Promotion (Passed)
- Student enrolled in Grade 9 (2083) passes.
- Old enrollment (2083) marked `status = 'completed'` or `'archived'`.
- New enrollment row inserted: `student_id = Same UUID`, `class_id = 'Grade 10'`, `academic_year_id = '2084'`, `status = 'active'`.

### Case B: Repeating the Grade (Failed / Retained)
- Student does not meet promotion criteria.
- Old enrollment (2083) marked `status = 'archived'`.
- New enrollment row inserted: `student_id = Same UUID`, `class_id = 'Grade 9'` (Same grade!), `academic_year_id = '2084'`, `status = 'active'`.

### Case C: Leaving School (Transfer Certificate / Dropout / Graduated)
- Student moves to another school or graduates Class 12.
- Old enrollment marked `status = 'transferred'` or `'graduated'`.
- **No new enrollment row is created** in Year 2084.
- Their permanent student record remains for historical transcripts, certificates, and logbook audits.

### Case D: New Comer (Lateral Entry)
- A new student joins Grade 10 in Year 2084.
- Create new row in `public.students` (new UUID + admission number).
- Create new row in `public.student_enrollments` (`academic_year_id = '2084'`, `class_id = 'Grade 10'`).

---

## 4. Manual Admin Workflow in a School ERP

The admin doesn't update SQL directly. They follow a standard 5-step end-of-year wizard:

```
[ Step 1: Create Academic Year ]
Admin defines Year 2084 (Start: Baishakh 1, End: Chaitra 30).
                  │
                  ▼
[ Step 2: Open Promotion Wizard ]
Select Source Year (2083) and Source Class (Grade 9).
Select Target Year (2084) and Target Class (Grade 10).
                  │
                  ▼
[ Step 3: Flag the Exceptions (Grid with Dropdowns) ]
By default, all 40 students are pre-selected as "Promote to Grade 10".
Admin changes:
• Roll 07 -> "Repeat Grade 9"
• Roll 18 -> "Left School (TC Issued)"
• Roll 25 -> "Promote to Grade 10"
                  │
                  ▼
[ Step 4: Atomic Execution Batch ]
Admin clicks "Execute Cohort Promotion".
In a single database transaction:
- Existing 2083 enrollments set to 'archived'.
- New 2084 enrollments created for all active/repeating students.
                  │
                  ▼
[ Step 5: Roll Number Allocation & Roster Finalization ]
Admin clicks "Auto-Assign Roll Numbers" (alphabetical A-Z by full name)
or enters custom roll numbers for the new class.
```

---

## 5. Implementation in LabSync LIMS (LMR)

In LMR, this architecture is already backed by:
- `public.students` (UUID, `admission_no`, `full_name`)
- `public.student_enrollments` (Constraint: `status IN ('active', 'transferred', 'graduated', 'archived', 'completed')`)
- `app/actions/academic-years.ts` (`promoteCohort()`, `enrollStudent()`)
- `lib/types/students.ts`
