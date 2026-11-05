# LabSync LIMS (LMR) — Comprehensive Technical Audit & Strategic Engineering Roadmap

**Document Reference**: `doc/plans/2026-11-02-comprehensive-system-audit-and-future-architecture-roadmap.md`  
**Date**: November 2, 2026  
**Status**: Authoritative Architectural Specification & Audit Register  
**Scope**: Full Platform Modernization, Performance Optimization, Terminal Security, Telemetry, and Future Capabilities  

---

## Table of Contents
1. [Executive Summary & Effort Breakdown](#1-executive-summary--effort-breakdown)
2. [Initiative 1: Terminal Cryptographic Binding & Auto-Deploy Agent](#2-initiative-1-terminal-cryptographic-binding--auto-deploy-agent)
3. [Initiative 2: App Latency Elimination, Bootstrap Consolidation & List Virtualization](#3-initiative-2-app-latency-elimination-bootstrap-consolidation--list-virtualization)
4. [Initiative 3: Strategic Client-Side vs Server-Side Rendering (Hybrid SWR Model)](#4-initiative-3-strategic-client-side-vs-server-side-rendering-hybrid-swr-model)
5. [Initiative 4: 1:1 Layout-True Skeletons & Fluid View Transitions](#5-initiative-4-11-layout-true-skeletons--fluid-view-transitions)
6. [Future Capabilities & Institutional Powerhouse Features](#6-future-capabilities--institutional-powerhouse-features)
   - 6.1 [True Offline-First PWA Engine (Nepal Connectivity Defense)](#61-true-offline-first-pwa-engine-nepal-connectivity-defense)
   - 6.2 [Rapid-Fire 5-Second Roll-Call (Absent-Only NumPad & Voice)](#62-rapid-fire-5-second-roll-call-absent-only-numpad--voice)
   - 6.3 [NEB Practical Board Exam Inspection Dossier & Cryptographic QR Verification](#63-neb-practical-board-exam-inspection-dossier--cryptographic-qr-verification)
   - 6.4 [Linear-Style Universal Command Palette (Ctrl+K / Cmd+K)](#64-linear-style-universal-command-palette-ctrlk--cmdk)
   - 6.5 [Smart Timetable Conflict Auto-Resolver (Alternative Slot Heuristic)](#65-smart-timetable-conflict-auto-resolver-alternative-slot-heuristic)
   - 6.6 [Biometric Authentication: WebAuthn / Passkeys (Windows Hello & TouchID)](#66-biometric-authentication-webauthn--passkeys-windows-hello--touchid)
7. [Live Telemetry & Distraction vs. Compilation Detection Engine](#7-live-telemetry--distraction-vs-compilation-detection-engine)
8. [Native Windows Forensic Subsystems (Built-in Activity Trackers)](#8-native-windows-forensic-subsystems-built-in-activity-trackers)
9. [Sequenced Phasing & Milestones](#9-sequenced-phasing--milestones)

---

## 1. Executive Summary & Effort Breakdown

| # | Architectural Domain | Primary Focus & Target Deliverables | Current Risk / Friction | Estimated Effort |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Terminal Cryptographic Binding & Agent** | Replace `/terminal/PC-23` with signed unguessable tokens, enforce hardware GUID pairing, web-downloadable Windows setup agent (`.bat` / `.ps1`). | 🔴 High Vulnerability (Predictable URLs, no hardware lock) | **10 – 14 hours** |
| **2** | **Latency Elimination & List Virtualization** | Eliminate 10–15s load times, consolidate 9–11 concurrent Server Action waterfalls into 1 bootstrap query, add windowed virtualization for rosters. | 🔴 High Friction (Slow page transitions, connection starvation) | **14 – 18 hours** |
| **3** | **Hybrid Client/Server Rendering (SWR Cache)** | Zero-wait client memory cache, optimistic local updates, background async server revalidation, eliminate frozen navigation states. | 🟡 Suboptimal (Full re-fetch on every route/tab switch) | **10 – 12 hours** |
| **4** | **1:1 Layout-True Skeletons & Transitions** | Match real 76px KPI cards, Live Cockpit, 8-period timetable canvas; eliminate Cumulative Layout Shift (CLS) on initial load. | 🟡 Outdated (Skeletons reflect legacy layouts from months ago) | **8 – 10 hours** |
| **5** | **Offline PWA & Background Sync** | Service Worker, local IndexedDB storage, silent bidirectional sync upon Wi-Fi reconnect (Nepal ISP/power outage resilience). | 🟢 Strategic Value | **12 – 16 hours** |
| **6** | **Rapid-Fire Roll-Call (Absent NumPad)** | Direct keyboard entry (`3 14 27 Enter`) marking absent students in 3 seconds, auto-presenting the remaining 90%+ cohort. | 🟢 Teacher Ergonomics | **6 – 8 hours** |
| **7** | **NEB Board Inspection Packager + QR** | Official NEB 75% practical compliance PDF export, 3-tier signature blocks, public cryptographic verification URL (`/verify/<hash>`). | 🟢 Compliance & Prestige | **8 – 12 hours** |
| **8** | **Hardware Telemetry & Distraction Detection** | Windows User32 foreground title monitor, GPU load heuristic, 3-tier compilation vs game duration buffer, CAD Cockpit status flags. | 🟢 Classroom Intelligence | **16 – 20 hours** |

---

## 2. Initiative 1: Terminal Cryptographic Binding & Auto-Deploy Agent

### 2.1 Current Gaps & Vulnerabilities
1. **Predictable Route Insecurity**:
   - `app/terminal/[code]/page.tsx` resolves workstations using raw route parameters (`params.code` &rarr; `workstations.label`).
   - Any student or unauthorized device on the local network can manually navigate to `/terminal/PC-01` or `/terminal/PC-23` and report false equipment issues, spoof attendance, or disrupt the terminal queue.
2. **Disconnected HMAC Engine**:
   - `lib/security/terminal-token.ts` contains cryptographic signing logic (`createHandshakeTicket`, `verifyTerminalSessionToken`), but **no server middleware or route guards enforce it** on the terminal paths.
3. **Absence of a 1-Click Provisioning Agent**:
   - Lab In-Charges currently have no automated method to set up physical computers. Each PC requires manual configuration.

### 2.2 Target Architecture & Workflow
```
[Physical Lab Computer]
   │
   ├─ Step 1: Admin downloads "Deploy-Terminal.bat" from /admin or /computer-lab
   ├─ Step 2: Script runs on Windows PC as Administrator
   │    ├─ Extracts BIOS UUID: (Get-CimInstance Win32_ComputerSystemProduct).UUID
   │    ├─ Extracts Primary MAC: (Get-NetAdapter | Where Status -eq 'Up').MacAddress
   │    └─ Sends 1-Time Cryptographic Handshake POST to /api/terminal/pair
   │
   ├─ Step 3: Server validates admin session & binds UUID to workstation in PostgreSQL
   ├─ Step 4: Server issues 365-day HttpOnly signed workstation token ("lmr_ws_token")
   └─ Step 5: Script configures Windows Startup / Kiosk Shortcut to:
        http://labsync.local/terminal/station?t=<HMAC_TOKEN>
```

### 2.3 Key Technical Deliverables
- **Cryptographic Guard on Terminal Routes**: Replace predictable routes with `/terminal/s/[signedToken]`. Direct visits without a verified hardware-bound cookie redirect to an *"Unpaired Hardware Hardware Fingerprint Required"* screen.
- **Web-Downloadable Agent Package**: An auto-generated Windows script packaged with the lab's specific network URL and pre-selected station code.
- **One-Click Re-Pairing Key**: In the Workstation Technical Biography drawer, an admin can click *"Reset Station Hardware Pairing"* if a motherboard or PC is replaced.

---

## 3. Initiative 2: App Latency Elimination, Bootstrap Consolidation & List Virtualization

### 3.1 Current Root Causes of 10–15s Latency
1. **Turbopack Dev JIT Overhead**:
   - In development mode (`next dev --turbopack`), Next.js compiles routes and Server Actions on the first hit (`Compiling /records/incidents ...`).
2. **`proxy.ts` Network Blocking**:
   - `proxy.ts` executes `supabase.auth.getUser()` on page transitions. When latency to the Supabase Auth server spikes, this blocks response streaming for 3 to 8 seconds.
3. **Mount Waterfall (9–11 Simultaneous Server Actions)**:
   - On initial load of `/schedules` or `/`, multiple hooks fire concurrently:
     - `useRoutineState` &rarr; `getSchedules()`
     - `useInfrastructureState` &rarr; `getSubjectsAction()`, `getClassesAction()`, `getLabFacilitiesAction()`, `getHolidaysAction()`, `getPeriodsAction()` (5 queries!)
     - `useIncidentState` &rarr; `getIncidents()`, `getNotifications()`
     - `useUserScope` &rarr; `getCurrentUserProfile()`
   - These 9–11 simultaneous HTTP POSTs overwhelm the connection pool and saturate the network waterfall.
4. **Un-Virtualized Large DOM Trees**:
   - Student roster tables render every student row and avatar simultaneously, creating memory pressure on low-spec lab laptops.

### 3.2 Target Architecture: The Master Bootstrap Pattern
```
Client Mount (tick 0)
   │
   └─► Executes 1 Single Consolidated RPC: getLabSyncBootstrapData()
         │
         ├─ Single PostgreSQL Connection
         ├─ Returns { labs, periods, subjects, classes, calendarSettings, currentUser }
         └─ Populates Master In-Memory Client Cache in 120ms total roundtrip
```
- **Session Token Verification in `proxy.ts`**: Verify JWT claims locally using standard public key verification rather than making full remote HTTPS roundtrips on non-mutating navigation.
- **Virtualized Scrolling (`@tanstack/react-virtual`)**:
  - In `class-roster-view.tsx`, render only the 15–20 visible student rows in the viewport.
  - Dynamically load subsequent rows as the user scrolls.
- **Progressive Avatar Hydration**: Render low-overhead SVG monogram initials first; stream remote profile photos lazily with `loading="lazy"` via native Intersection Observer.

---

## 4. Initiative 3: Strategic Client-Side vs Server-Side Rendering (Hybrid SWR Model)

### 4.1 The Core Imbalance
- Currently, navigation between already-visited tabs (e.g., switching from `/schedules` to `/maintenance` to `/`) re-initiates full server fetches, resulting in a sluggish, frozen feeling.
- Mutating actions block the interface until the server responds, rather than providing instant tactile feedback.

### 4.2 Target Architecture: Stale-While-Revalidate (SWR) & Shared Cache
```
User Clicks Navigation Item (e.g., "/records" or "/schedules")
   │
   ├─ [Frame 0 - 0ms]: Instant render from Client Memory Cache (Stale Data)
   │                   UI updates immediately; zero frozen screens.
   │
   ├─ [Background Async]: Silent Server Action verifies data freshness
   │
   └─ [On Data Change]: Only modified DOM elements re-render seamlessly
```
- **Optimistic State with Automatic Rollback**: When an instructor marks roll-call or an admin moves a workstation in the CAD plan, the UI updates instantly. If the network request fails, the state gracefully rolls back with an alert banner.
- **Cross-Component Deduplication**: If both `LiveSessionCockpit` and `AdvancedCalendar` require timetable sessions, they share a single cache promise rather than dispatching duplicate queries.

---

## 5. Initiative 4: 1:1 Layout-True Skeletons & Fluid View Transitions

### 5.1 Current Deficiencies
- `components/ui/skeleton-loader.tsx` contains `DashboardOverviewSkeleton` built for an obsolete dashboard layout (renders a legacy top hero banner and a 4-card KPI row that no longer exist).
- When the actual dashboard loads (3 high-density 76px KPI cards + Live Cockpit + 2-column command center), the screen experiences a jarring structural jump (Cumulative Layout Shift).
- Workstation CAD Floor and Admin modules lack layout-true skeletons, relying on blank wells or basic text spinners.

### 5.2 Target Architecture
1. **Pixel-Identical Skeleton Mockups**:
   - `DashboardSkeleton`: Exactly mirrors the 3 KPI cards (~76px high), Live Cockpit ribbon, and 8/4 grid layout.
   - `TimetableSkeleton`: Exactly mirrors the 8-period horizontal columns and Sunday-to-Friday day headers.
   - `WorkstationFloorSkeleton`: Mirrors the CAD border, radar minimap placeholder, and teacher podium anchor.
2. **Smooth Layout Transitions**:
   - Implement CSS `view-transition-name` and subtle opacity crossfades (150ms–200ms) to eliminate visual flicker when data resolves.

---

## 6. Future Capabilities & Institutional Powerhouse Features

### 6.1 True Offline-First PWA Engine (Nepal Connectivity Defense)
- **The Problem**: Periodic power cuts, generator transitions, and unstable ISP uplinks in Nepal can drop laboratory connectivity midway through practical exams.
- **The Solution**:
  - Full Progressive Web App (PWA) manifest and Service Worker caching.
  - Core routes (`/computer-lab`, `/schedules`, `/records/new`) function completely offline.
  - Roll-call tallies, incident tickets, and session notes queue locally in IndexedDB.
  - When connection restores, a two-way sync engine reconciles with PostgreSQL using vector timestamps to prevent merge conflicts.

### 6.2 Rapid-Fire 5-Second Roll-Call (Absent-Only NumPad & Voice)
- **The Problem**: Manually clicking 48 individual students consumes 6 to 10 minutes of valuable practical class time.
- **The Solution**:
  - In Class 11 and 12, 90%+ of students are present; only 2 to 5 are typically absent.
  - **"Rapid Absent Punch"**: Instructor presses `A`, types absent roll numbers separated by spaces (`3 14 27`), and presses `Enter`.
  - Instantly marks those 3 absent and all other 45 present in **under 3 seconds**.
  - **Bilingual Voice Command** (Native Web Speech API): Instructor holds spacebar and says *"Roll 5 and 12 absent"*; system processes and updates the live floor plan immediately.

### 6.3 NEB Practical Board Exam Inspection Dossier & Cryptographic QR Verification
- **The Problem**: End-of-year NEB (National Examinations Board) practical evaluations require tedious manual audits of paper registers to verify 75% attendance compliance.
- **The Solution**:
  - **1-Click NEB Inspection Dossier Generator**: Generates an official, print-perfect A4 government report containing:
    - 75% attendance threshold classification (Board Exam Eligible vs. Ineligible repeaters).
    - Curriculum experiment completion matrix.
    - Official 3-tier institutional signature block (Subject Teacher, Lab In-Charge, Campus Chief).
  - **Cryptographic QR Code**: Generates a tamper-proof SHA-256 digital signature linking to `https://labsync.institution.edu.np/verify/<hash>`. External NEB examiners can scan the printed document with any smartphone to verify authenticity against the database audit ledger.

### 6.4 Linear-Style Universal Command Palette (`Ctrl+K` / `Cmd+K`)
- **The Problem**: Navigating multi-level menus and dropdowns slows down administrative power users.
- **The Solution**:
  - Global modal spotlight dialog triggered by `Ctrl+K`:
    - `PC-14` &rarr; Opens PC-14 technical biography and fault history drawer.
    - `12 C` &rarr; Opens Class 12 Science C seating chart and attendance tally.
    - `Chem` &rarr; Filters schedule grid to Chemistry Lab.
    - `Breakage` &rarr; Opens incident triage modal.

### 6.5 Smart Timetable Conflict Auto-Resolver (Alternative Slot Heuristic)
- **The Problem**: When a timetable collision occurs, the system displays an error banner, leaving the teacher to manually search for open slots.
- **The Solution**:
  - When a collision is detected, the conflict engine computes adjacent availability:
    > *"Computer Lab is reserved for Period 3 by Mr. Dinanath Shah. However, **Electronics Lab** is vacant this period, or Computer Lab is available **tomorrow at Period 4**. Switch with 1 click?"*
  - Teacher clicks *"Reallocate to Electronics Lab"*, automatically updating the reservation and dispatching notifications.

### 6.6 Biometric Authentication: WebAuthn / Passkeys (Windows Hello & TouchID)
- **The Problem**: Teachers forget passwords or leave credentials saved on shared lab podium computers.
- **The Solution**:
  - WebAuthn passkey support allowing faculty to log in with laptop fingerprint readers, Windows Hello facial recognition, or mobile security keys in under 1 second.
  - Eliminates password compromise risks on shared institutional terminals.

---

## 7. Live Telemetry & Distraction vs. Compilation Detection Engine

### 7.1 How Foreground Activity Tracking Works on Windows
Windows exposes lightweight Win32 API functions:
`GetForegroundWindow()` &rarr; `GetWindowThreadProcessId()` &rarr; `GetWindowText()`

Every 3 to 5 seconds, the background agent inspects the top-level window:
- **Academic Tasks**:
  - Process: `code.exe` | Title: `lab3_binary_search.cpp - Visual Studio Code`
  - Process: `idle.exe` | Title: `practical4_matrix.py - Python 3.12 IDLE`
  - Process: `chrome.exe` | Title: `Class 11 Science - LabSync Student Terminal`
- **Distractions / Games**:
  - Process: `gta5.exe`, `csgo.exe`, `valorant.exe`, `roblox.exe`, `minecraft.exe`
  - Browser Games: `chrome.exe` | Title: `Krunker.io - Free Online FPS - Google Chrome`
  - Browser Games: `chrome.exe` | Title: `CrazyGames: Free Online Games`
  - Browser Games: `chrome.exe` | Title: `Slope Game - Play Unblocked`

### 7.2 The 3-Tier Compilation vs. Gaming Heuristic
High CPU alone does not indicate gaming—compiling a large C++ project in Visual Studio or running a build in Android Studio will push CPU to 100% for 10–20 seconds.

```
                           Incoming Station Telemetry
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
Foreground Process & Window Title                             Resource Usage
(e.g., code.exe / msbuild.exe)                             (CPU %, GPU 3D %, RAM)
        │                                                             │
        └──────────────────────────────┬──────────────────────────────┘
                                       │
                                       ▼
                   Cross-Reference with Live Timetable Slot
                     (e.g., Class 12 C++ Programming Lab)
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
   TIER 1: Academic Tool         TIER 2: Known Game            TIER 3: Neutral App
   • Whitelisted IDE / compiler  • Gaming exe or browser game  • Unfocused / unknown
   • High CPU = "COMPILING"      • Sustained GPU 3D > 75%      • 45-second duration buffer
   • Status: ✅ Productive       • Status: 🔴 Distraction      • Status: ⚪ Nominal
```

1. **Academic Whitelist**:
   - If the active timetable session is C++ Programming, processes like `devenv.exe`, `code.exe`, `g++.exe`, and `msbuild.exe` are marked legitimate.
   - High CPU spikes are categorized as `⚡ Compiling Project (Normal Burst)`.
2. **Window Title Verification**:
   - Window titles differentiate academic research (`Flexbox - MDN Web Docs`) from entertainment (`Krunker.io - Play FPS`).
3. **45-Second Temporal Grace Buffer**:
   - Compilation spikes last 5–20 seconds.
   - Gaming involves sustained high GPU 3D rendering for multiple continuous minutes.
   - Alerts only trigger if an unwhitelisted entertainment program remains active for **more than 45 seconds continuously**.

### 7.3 Live CAD Cockpit Actions
When a station is flagged in `/computer-lab`:
- **Discreet Faculty Alert**: PC-14 glows amber on the floor plan: `Distraction: Krunker.io (Active 4m)`.
- **Teacher 1-Tap Actions**:
  1. *Send Nudge*: Displays a non-intrusive banner on the student PC: *"Instructor Note: Please return to your code editor."*
  2. *Close Process*: Remotely closes the game process or browser tab.
  3. *Teacher Demo Lock*: Pulls down a full-screen institutional focus banner during demonstrations.

---

## 8. Native Windows Forensic Subsystems (Built-in Activity Trackers)

Windows maintains multiple built-in forensic subsystems that automatically track application execution. Our lightweight agent leverages these native OS records without requiring invasive third-party monitoring software:

### 8.1 Windows Prefetch (`C:\Windows\Prefetch\*.pf`)
- Windows automatically maintains prefetch files for every launched executable to optimize startup performance.
- **Stored Data**: Executable name (e.g. `VALORANT.EXE-A3B91C4D.pf`), exact last execution timestamp, and total execution count.
- **Forensic Invariant**: Even if a student deletes a portable game folder before class ends, the prefetch artifact remains in the OS.

### 8.2 Windows SRUM (System Resource Usage Monitor)
- **Path**: `C:\Windows\System32\sru\SRUDB.dat` (Embedded Extensible Storage Engine database).
- **Stored Data**:
  - Tracks every program executed over the past **30 to 60 days**.
  - Exact application path, total active runtime (in seconds), and total network bytes sent/received.
  - Differentiates background processes from foreground applications.

### 8.3 Windows Registry `UserAssist`
- **Path**: `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist`
- **Stored Data**:
  - Records every GUI program executed via Explorer (Desktop, Start Menu, Taskbar).
  - Contains launch count and exact **total focus time** (how many minutes the application was actively focused on the monitor).
  - Obfuscated using ROT-13 (decoded instantaneously by the agent).

### 8.4 Windows Event Log (Process Creation Auditing)
- **Log**: `Security` log (Event ID **4688**: *"A new process has been created"*).
- **Capability**: Enabled via `auditpol /set /subcategory:"Process Creation" /success:enable`.
- **Stored Data**: Immutable audit entry with process name, parent process, full command-line arguments, and student user account.
- **USB Execution Tracking**: Detects portable games executed directly from USB pen drives without local installation.

---

## 9. Sequenced Phasing & Milestones

```
Phase 1: Security & Terminal Integrity (Sprint 1)
  ├─ Enforce HMAC signed tokens on /terminal/s/[token]
  ├─ Build 1-click Windows Setup Agent script generator in /admin
  └─ Implement hardware GUID pairing and lock
  Estimate: 10 – 14 hours

Phase 2: Performance & Query Consolidation (Sprint 2)
  ├─ Build getLabSyncBootstrapData() consolidated master action
  ├─ Optimize proxy.ts session verification
  └─ Implement @tanstack/react-virtual on student rosters and logs
  Estimate: 14 – 18 hours

Phase 3: Client Cache & Fluid Modernization (Sprint 3)
  ├─ Implement shared SWR / client-side cache layer
  ├─ Build 1:1 layout-true skeletons for Dashboard, Timetable, CAD Floor
  └─ Add CSS view transitions and micro-interaction polish
  Estimate: 16 – 20 hours

Phase 4: Institutional Superpowers (Sprint 4)
  ├─ Rapid-Fire Absent NumPad roll-call
  ├─ 1-Click NEB Practical Board Dossier export with QR verification
  ├─ Offline PWA Service Worker engine
  └─ Live Telemetry agent & Focus Mode integration
  Estimate: 24 – 32 hours
```

---

*This document serves as the permanent master architectural plan for LabSync LIMS platform hardening and feature expansion.*

