# LabSync LIMS — Computer Lab Floor Plan, Live Cockpit & Projection Elevation
## Master Engineering Specification & Architecture Blueprint

> **Date**: 2026-10-05  
> **Status**: APPROVED & IN ACTIVE EXECUTION  
> **Target Environment**: Next.js 16 App Router · Supabase PostgreSQL · Tailwind CSS · React 19  
> **Institutional Context**: Academic Laboratories (50-terminal Computer Labs, Class 11 & 12 Science/Computer Science, Nepal)  
> **Target Routes**: `/computer-lab`, `/computer-lab/projector`, `/maintenance`, `/terminal/[id]`  

---

## 1. Executive Summary & Vision

The laboratory floor plan is the central operational nervous system of academic computer facilities. In high-density institutions (34 to 50+ terminals), laboratory management encompasses far more than simple static desk icons:
1. **Dynamic & Manual Seat Allocation**: Automatic seating by Class Roll ($1 \dots N \to \text{PC-01} \dots \text{PC-50}$) and alphabetical order with drag-and-drop manual adjustments.
2. **Displaced Student Auto-Detection**: When a workstation suffers hardware/software faults, the system instantly detects displaced students and coordinates seamless temporary session replacement without destroying the permanent baseline plan.
3. **Wall-Mounted Big-Screen Projection Mode**: A dedicated, clutter-free wall display on the lab projector/TV (`/computer-lab/projector`) displaying the active session seating chart so students entering the lab find their seats in seconds.
4. **Machine-by-Machine Maintenance Checklists**: Fleet task checklists in `/maintenance` (e.g. VS Code rollout, OS updates, thermal paste replacement) with machine-by-machine checkboxes synced to the floor plan.
5. **Live Severity-Coded Incident Tracking**: Workstations dynamically light up according to fault severity (Critical Rose, High Amber, Low Cyan) with full diagnostic and repair history.
6. **Forensic Seating Audit in Practical Records**: Every practical log captures a frozen session seating snapshot. If unauthorized software, games, or OS tampering is discovered on a PC, administrators can inspect the historical usage timeline to identify who sat at that station across past practicals.
7. **Zero-Login Student Terminal Self-Reporting**: Students report issues directly from their terminal screen (Windows activation, missing software, crashes) without passwords, protected by a 2-tier hardware lock.

---

## 2. The 5 Core Operational Pillars

### Pillar 1: Dynamic & Manual Seating with Displaced Student Replacement
- **Auto-Populate Strategies**:
  - Sequential Roll: Roll 1 $\to$ PC-01, Roll 2 $\to$ PC-02 $\dots$
  - Alphabetical (A–Z): Alphabetical roster order.
  - Previous Cohort Template Clone.
- **Displaced Student Detection**:
  - When a workstation status becomes `under_repair` or `flagged` (Critical/High), the system checks `workstation_seat_plans`.
  - Displaced students are placed in a high-visibility Cockpit Queue:  
    `⚠️ 1 Displaced Student: Kaustuv Thapa (Roll 14) from PC-14 → [Assign Temporary PC]`
  - Highlights all available, operational terminals and allows 1-click temporary session assignment (`session_overrides`).

### Pillar 2: Wall-Mounted Big-Screen Projection Mode (`/computer-lab/projector`)
- **Purpose**: Wall projector / large monitor mounted at the front of the lab.
- **Design Philosophy**:
  - Zero admin chrome: no sidebar, no breadcrumbs, no edit buttons, no navigation tabs.
  - Ultra-high contrast dark obsidian canvas with crisp typography.
  - Large legible Roll Badges (`R-14`), full student names, and photo avatars.
  - Real-time auto-refresh (every 10s or live WebSocket/PostgreSQL changes) reflecting teacher roll-call marks immediately.
  - Color Semantics:
    - 🟢 Emerald: Assigned student marked Present.
    - 🟡 Amber: Temporary Seat Replacement.
    - ⚪ Subtle Slate: Empty / Unassigned Station.
    - 🔴 Pulsing Rose: Out of Service / Hardware Fault (Warning: Do Not Sit Here).

### Pillar 3: Multi-PC Maintenance Checklists (Fleet Operations)
- Integrated into `/maintenance`:
  - Routine task definitions (e.g., *"Install Python 3.12 & VS Code 2026"*, *"Clean CPU Dust & Re-apply Thermal Paste"*).
  - Machine checklist grid: displays PC-01 to PC-50 with 1-click status toggles: `[✓] Completed`, `[ ] Pending`, `[!] Blocked`.
  - Live progress meter (`28/34 Terminals Completed - 82%`).
  - Synced Floor Plan Overlay: Visual badge overlay on the floor plan showing task progress per PC.
  - Certified Logbook archival upon task completion.

### Pillar 4: Live Severity-Coded Incident Tracking & Workstation Linking
- Reporting an incident in `/incidents` or dashboard modal for "Computer Lab" prompts for **"Affected Workstation / PC No"**.
- Dynamically derives node status on the floor plan:
  - 🔴 **Critical**: Pulsing Rose glow (`#EF4444`) with alert siren icon (e.g., PSU failure, smoke, smashed monitor).
  - 🟡 **High**: Amber glow (`#F59E0B`) with wrench icon (e.g., Windows boot loop, blue screen, crashing OS).
  - 🔵 **Medium/Low**: Yellow/Cyan glow (e.g., mouse wheel stuck, missing keycap).
- Click-to-Diagnose drawer allows immediate triage, photo inspection, and certified resolution with technician notes.

### Pillar 5: Forensic Seating History & Session Snapshots
- When an instructor submits a practical log (`practical_logs`), the system freezes the active seating arrangement into the log record.
- **Two Investigative Workflows**:
  1. **Record Review (`/records`)**: Opening a historical practical session displays the interactive floor plan showing who was present and seated at each desk during that class.
  2. **Machine Technical Biography (`/computer-lab` $\to$ Workstation $\to$ Usage Timeline)**:
     - Chronological list of past student seatings:
       - *Yesterday 11:30 AM (Class 11 Sci A)*: Kaustuv Thapa (Roll 14)
       - *Wednesday 02:00 PM (Class 12 Sci B)*: Rohan Shrestha (Roll 22)
       - *Tuesday 10:00 AM (Class 11 Sci B)*: Aayush Poudel (Roll 05)
     - Empowers administrators to identify who altered system settings, installed unauthorized software/games, or caused physical damage.

---

## 3. Zero-Login Student Terminal Self-Reporting & Anti-Spoofing Architecture

### 3.1 The Problem
Giving 500+ students individual user accounts for lab reporting creates extreme friction (forgotten passwords, account sharing, unauthorized logins). Conversely, open links allow pranksters to submit false reports for other terminals.

### 3.2 The 2-Tier Hardware Lock Solution
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│               2-TIER HARDWARE TERMINAL LOCK (ANTI-PRANK DEFENSE)                 │
├────────────────────────────────┬─────────────────────────────────────────────────┤
│ Tier 1: Cryptographic Device   │ • Admin configures browser shortcut once:       │
│ Pairing Token (Browser Level)  │   `/terminal/pair?station=PC-30&secret=...`     │
│                                │ • Browser stores an encrypted persistent token.  │
│                                │ • Submitting for any other PC is rejected:       │
│                                │   "Mismatch: This terminal is registered as     │
│                                │    PC-30. You cannot submit reports for PC-12." │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Tier 2: Local LAN IP Subnet    │ • Workstations in academic labs have static LAN │
│ Mapping (Network Level)        │   IPs (e.g., 192.168.1.130 = PC-30).             │
│                                │ • Server verifies `client_ip`. Even if cookies  │
│                                │   are wiped or incognito opened, the network    │
│                                │   cable confirms it is PC-30.                   │
│                                │ • Mobile phones and external devices blocked.   │
└────────────────────────────────┴─────────────────────────────────────────────────┘
```

### 3.3 Student Reporting Experience (`/terminal`)
1. Student clicks desktop shortcut "Report PC Issue".
2. Page opens pre-bound to **PC-12 (Computer Lab 01)**.
3. Automatically identifies active session and pre-fills student name from the live seat plan (*"Are you Kaustuv Thapa (Roll 14)?"*).
4. 1-Tap Quick Issue Tags:
   - 🪟 *Windows Not Activated*
   - 📄 *MS Office / Word / Excel Unlicensed*
   - 📦 *Required Software Missing (Python, VS Code, C++)*
   - 💥 *Software Crashing / Freezing*
   - 🖱️ *Mouse / Keyboard / Audio Fault*
   - 🌐 *No Internet / Network Disconnected*
   - ⚡ *PC Restarting / Blue Screen*
   - 📝 *Other (custom note)*
5. Tap **"Request Assistance"** $\to$ Real-time amber beacon glows on Teacher & Lab In-Charge Cockpit with instant audio chime/toast.

---

## 4. Multi-Phase Implementation Roadmap

| Phase | Scope | Focus Areas | Status |
| :--- | :--- | :--- | :--- |
| **Phase 2** | **Auto-Grid Layout & Projection Screen** | • Auto-arrange presets (4 Rows, 5 Rows, Dual Islands) & batch coordinate updates.<br>• Enhanced scalable workstation nodes with high-clarity student avatars & legible typography.<br>• Fullscreen Big-Screen Projection Mode (`/computer-lab/projector`) with live 10s auto-refresh. | **Complete (100%)** |
| **Phase 3** | **Dynamic Seating & Forensic History** | • Auto-assign by roll / alphabet & displaced student auto-detection queue.<br>• Session seating snapshot in `practical_logs`.<br>• Workstation student usage chronological timeline. | **Complete (100%)** |
| **Phase 4** | **Multi-PC Maintenance Routine Checklists** | • Fleet task checklists in `/maintenance` with machine-by-machine toggles.<br>• Synchronized progress overlay on the CAD Floor Plan.<br>• Certified service logbook archiving. | **Complete (100%)** |
| **Phase 1** | **Zero-Login Student Terminal & Live Beacon** | • `/terminal` route with 1-tap issue chips.<br>• 2-Tier anti-spoofing pairing token & LAN IP binding.<br>• Real-time help beacon on Live Cockpit with toast notification. | Queued (Next Up) |

---

## 5. Architectural Invariants
1. **Rule #10 (High-Density Cards)**: No double-nested card wrappers; standalone `.glass-card` elements in direct grid.
2. **Rule #1 (Zero Literal `+`)**: Action buttons must use `<Plus className="..." />`, never raw `+` characters.
3. **Database Relational Integrity**: All positions stored in `public.workstations` (`pos_x`, `pos_y`, `row_label`).
4. **Strict TypeScript & Zero Lints**: All new code and types must pass `npx tsc --noEmit` with 0 errors.
