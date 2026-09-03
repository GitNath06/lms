# Institutional Laboratory Practical & Timetable Management System (LMS)

A real-time, zero-data-loss laboratory practical tracking and routine management system built for engineering institutions and secondary schools in Nepal (B.S. 2083 / 2026 A.D.).

---

## 🌟 Key Features

- **Executive Real-Time Dashboard (`/`)**:
  - Live NPT Clock & Bikram Sambat (B.S.) Nepali Calendar integration.
  - **Happening Now**: Real-time practical tracking banner with countdown timer.
  - **Today's Practical Logs**: Attendance turnout, topics learned, and instant record modification.
  - **Upcoming & Backlog Sessions**: Fast action buttons to log or skip past and future periods.
  - **Facility Telemetry**: Live occupancy and workstation status for Computer, Physics, and Chemistry labs.
  - **Curriculum & Syllabus Progress Tracker**.

- **Advanced Timetable Matrix (`/schedules`)**:
  - **Inverted Grid Layout**: Days on the sticky left axis (Sunday–Friday), Periods on the horizontal top axis.
  - **Multi-Track Independent CSS Grid**: Multi-period practical spans (`span: 2`, `span: 3`) across consecutive periods without distorting parallel labs.
  - **Dynamic Merge & Unmerge Engine**: Dual sub-panel cards connected with an animated glowing `+` connector badge and automatic time calculations.
  - **Standardized Nomenclature**: Clean shorthand codes (`COMP-12`, `CHEM-12`, `PHY-12`, `DBMS-10`).

- **Official Daily Practical Register Sheet (`/print/daily-log`)**:
  - A4 print-optimized clean black-and-white layout with institutional header, date/lab filtering, and physical signature blocks for:
    - *Subject Teacher*
    - *Lab Assistant*
    - *Department Head (HOD) Approval Stamp*

- **Super-Admin Management Portal (`/admin`)**:
  - Centralized management for Periods & Timings, Lab Rooms, Classes/Streams, Subjects, Faculty, and Academic Holidays.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Core**: React 19, TypeScript
- **Styling**: Tailwind CSS, Modern Minimalist Design System (Apple / Linear-inspired 1px Zinc Aesthetics)
- **Icons**: Lucide Icons
- **Backend / Database**: Supabase (PostgreSQL with Realtime capabilities)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 📜 License
Private institutional software. All rights reserved.
