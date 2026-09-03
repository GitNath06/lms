Markdown
# Product Requirements Document (PRD)
## Project Name: LabSync — Laboratory Management System (LIMS)
**Target Roles:** Lab In-Charge (`admin`), Faculty / Teachers (`teacher`)  
**Deployment Target:** Vercel  
**Primary Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + PostgreSQL)

---

## 1. Executive Summary
Academic and institutional laboratories across Computer, Physics, Chemistry, and Biology departments frequently suffer from slot collision, missing records, manual attendance tallying, and untracked breakages. 

**LabSync** digitizes laboratory workflows by providing:
1. Dynamic scheduling with multi-period slot merging.
2. Real-time practical session data and attendance logging.
3. One-click, high-contrast, print-ready daily log sheets with dual signature lines for institutional handovers.

---

## 2. User Roles & Permissions (RBAC)

| Role | Permissions |
|---|---|
| **Lab In-Charge (`admin`)** | Full system control. Manage lab rooms, approve schedules, merge consecutive session slots, view logs across all labs, manage role assignments, and export/print daily certified logs. |
| **Teacher / Faculty (`teacher`)** | View timetable matrix, reserve available practical slots, log completed session topics, record student attendance (present/absent), and review their own logging history. |

---

## 3. Database Schema Specification (Supabase PostgreSQL)

```sql
-- ENUMS
create type user_role as enum ('admin', 'teacher');
create type lab_type as enum ('computer_lab', 'physics_lab', 'chemistry_lab', 'biology_lab');
create type session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');

-- 1. PROFILES TABLE
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role user_role default 'teacher',
  department text,
  created_at timestamp with time zone default now()
);

-- 2. LAB ROOMS
create table labs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type lab_type not null,
  capacity int not null default 30,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- 3. SCHEDULES & BOOKINGS
create table schedules (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid references labs(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  subject_name text not null,
  batch_name text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  is_merged boolean default false,
  status session_status default 'scheduled',
  created_at timestamp with time zone default now()
);

-- 4. PRACTICAL LOG ENTRIES
create table practical_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references schedules(id) on delete set null,
  lab_id uuid references labs(id) on delete cascade not null,
  teacher_id uuid references profiles(id) on delete set null,
  date date not null default current_date,
  period_label text not null,
  subject_name text not null,
  batch_group text not null,
  practical_title text not null,
  total_students int not null default 0,
  present_students int not null default 0,
  absent_students int not null default 0,
  remarks text,
  logged_by uuid references profiles(id),
  created_at timestamp with time zone default now()
);

-- ENABLE ROW LEVEL SECURITY (RLS)
alter table profiles enable row level security;
alter table labs enable row level security;
alter table schedules enable row level security;
alter table practical_logs enable row level security;

-- BASIC RLS POLICIES
create policy "Public read profiles" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

create policy "Public read labs" on labs for select using (true);
create policy "Admin modify labs" on labs for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "Authenticated read schedules" on schedules for select to authenticated using (true);
create policy "Authenticated insert schedules" on schedules for insert to authenticated with check (true);
create policy "Admin or Owner update schedules" on schedules for update to authenticated using (
  auth.uid() = teacher_id or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "Authenticated read logs" on practical_logs for select to authenticated using (true);
create policy "Authenticated insert logs" on practical_logs for insert to authenticated with check (true);
4. Feature Specifications
Module 1: Authentication & Layout Shell
Supabase Auth (@supabase/ssr) with email & password.

Sign up captures full_name, department, and role (admin or teacher).

Responsive desktop/tablet shell: Collapsible Sidebar, Breadcrumbs, User Profile Dropdown with active role badge.

Protected route middleware: Redirects unauthenticated traffic to /login and authenticated users away from /login.

Module 2: Overview Dashboard (/)
Metric Cards: Sessions Today, Active Lab Utilization %, Total Practical Logs recorded this week.

Happening Now Banner: Dynamic card highlighting the current active session based on system clock.

Upcoming Timetable: Chronological feed of remaining practical blocks for the day.

Quick Actions: One-tap modal triggers for "Log Practical", "Book Slot", and "Print Daily Report".

Module 3: Lab Scheduling & Timetable Matrix (/schedules)
Visual grid view filterable by Lab Type (computer_lab, physics_lab, chemistry_lab, biology_lab).

Slot Booking Dialog: Input Lab, Teacher, Subject, Batch Group, Date, and Period Slots.

Multi-period Merge capability: Consolidates two consecutive time blocks into a single block tagged with an is_merged badge.

Overlap validation preventing conflicting reservations for the same lab room.

Module 4: Practical Session Data Logging (/logs & /logs/new)
Form inputs: Lab Room, Teacher, Date, Period Label (e.g., "Period 3 & 4"), Subject, Batch Group, Experiment Title.

Student tallying: Total Students, Present, Absent with automated live calculation of attendance percentage.

Filterable table view searchable by date range, lab type, subject, and faculty.

Module 5: Standardized Printouts & Exports (/print/daily-log)
Formal institutional header with Lab Room, Department, Date, and Shift.

Tabular log overview: Period, Subject, Faculty, Experiment Title, Attendance Ratio, Apparatus Remarks.

Designated dual signature blocks: "Lab In-Charge Signature" and "HOD / Principal Signature".

Print CSS (@media print): Auto-hides sidebars, navigation bars, backgrounds, and action buttons during window.print().

5. Folder & Architecture Blueprint
Plaintext
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx             # Persistent Sidebar & Header
│   │   ├── page.tsx               # Metric Dashboard
│   │   ├── schedules/page.tsx     # Timetable & Slot Booking
│   │   ├── logs/
│   │   │   ├── page.tsx           # Practical Log Table
│   │   │   └── new/page.tsx       # New Practical Entry Form
│   │   └── print/
│   │       └── daily-log/page.tsx # Formal Printable Report
│   └── actions/
│       ├── auth.ts                # Server Actions: Login/Signup/Signout
│       ├── schedules.ts           # Server Actions: Booking/Merging
│       └── logs.ts                # Server Actions: Logging practicals
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   ├── dashboard/                 # Metric widgets & Live session banner
│   ├── scheduler/                 # Matrix view & Booking dialog
│   └── print/                     # Printable Letterhead & Signatures
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Component Supabase client
│   │   └── middleware.ts          # Session refresh helper
│   └── utils.ts
├── middleware.ts                  # Route protection & role validation
└── types/
    └── database.ts                # TypeScript types matching schema
6. Rules for AI Coding Agents
Scoped Execution: Implement only the explicitly requested module in each session.

Component Standard: Use shadcn/ui components (components/ui/) exclusively—do not write unstyled raw HTML inputs or tables.

Data Mutation: Use Next.js Server Actions (app/actions/*) paired with revalidatePath().

Advisory Rule: Place all unprompted suggestions or UX enhancements at the very end in a 💡 Suggested Enhancements section; do not modify code without prior approval.


---

For a complete walkthrough of configuring server-side Supabase authentication in Next.js App Router, see this [Introduction to Supabase Auth with Next.js 15 Tutorial](https://www.youtube.com/watch?v=fmXMNvxxQJQ). This video breaks down how Server Components and Server Actions work together with Supabase sessions to secure your app's routes.

<FollowUp label="Ready to start Module 1 (Login & Auth Actions) in Claude?" query="Let's build Module 1: Auth & Login system based on PRD.md. Generate the login page and auth server actions."/>
 *YouTube video views will be stored in your YouTube History, and your data will be stored and used by YouTube according to its [Terms of Service](https://www.youtube.com/static?template=terms)*