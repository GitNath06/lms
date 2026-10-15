# 📌 REMINDER: UI Redesign with Stitch (stitch.google.com) & System Reapplication

> **File Purpose**: Explicit reminder and roadmap specification to redesign the LabSync LIMS / LMR user interface using **[stitch.google.com](https://stitch.google.com)** and reapply the modern design tokens, component hierarchy, and layout back into this Next.js 16 / Tailwind CSS codebase.  
> **Status**: 📝 Queued for Future Implementation  
> **Target Scope**: Full Application UI Redesign (Dashboard, Floor Plan, Live Cockpit, Projector View, Maintenance Workbench, Student Terminal, and Admin Console).  

---

## 1. Objective & Vision

When ready to modernize and elevate the visual aesthetics of the platform:
1. Use **Stitch** (`stitch.google.com`) to generate, prototype, and refine state-of-the-art UI layouts and design system components.
2. Translate and reapply the Stitch design outputs, layout structures, and styling tokens into this repository without breaking any existing backend PostgreSQL queries, server actions, or data models.

---

## 2. Key Screen Areas to Redesign in Stitch

| # | Screen / Area | Target Route | Core Elements to Redesign in Stitch |
| :-: | :--- | :--- | :--- |
| **1** | **Main Dashboard Command Center** | `/` | • High-density executive KPI strip (~76px cards, Rule #10).<br>• Live Lab telemetry room cards with real-time occupancy.<br>• Ongoing practical session feed & quick log actions.<br>• Incident damage summary. |
| **2** | **CAD Floor Plan & Live Cockpit** | `/computer-lab` | • Living LCD workstation nodes with milled chamfered bezels.<br>• Floating HUD controls (Zoom, Pan, Fit-to-screen, Reset).<br>• Draggable radar minimap.<br>• Compact cohort selection bar.<br>• Unassigned student tray and drag-and-drop seating.<br>• Live help request beacon alerts (`TerminalAssistanceQueue`). |
| **3** | **Big-Screen Wall Projection Mode** | `/computer-lab/projector` | • Clean, zero-chrome wall display for front-of-class projectors/TVs.<br>• High-contrast attendance status indicators (Present emerald, Displaced amber, Absent rose).<br>• Legible roll number badges and student photo avatars. |
| **4** | **Student Self-Reporting Terminal** | `/terminal/[code]` | • Mobile & desktop responsive zero-login portal.<br>• 1-Tap quick issue chips with vibrant status badges.<br>• Active practical session identity verification block.<br>• 2-Tier hardware lock pairing screen (`/terminal/pair`). |
| **5** | **Lab Maintenance Workbench** | `/maintenance` | • Fleet multi-PC routine checklist modal with machine-by-machine toggles.<br>• Certified service history logbook (clean technical compliance, zero pricing clutter).<br>• Synchronized CAD floor plan progress overlay. |
| **6** | **Institutional Timetable Grid** | `/schedules` | • Sunday–Friday weekly timetable matrix.<br>• Period slot blocks with instructor badges.<br>• Triple-collision conflict warnings. |
| **7** | **Super Admin Console** | `/admin` | • "Precaution Active" safety toggle station.<br>• Cohort Promotion Wizard steps.<br>• User access approval management & audit ledger. |

---

## 3. Workflow to Reapply Stitch Designs into this Codebase

When the user initiates this task (e.g., *"Let's redesign our UI using stitch.google.com"*):

1. **Review & Ingest Stitch Exports**:
   - Inspect Stitch design specs, CSS variables, typography tokens, color palette, and component mockups.
2. **Update Design System Foundations**:
   - Update `app/globals.css` (color tokens, surface elevations, shadows, typography variables).
   - Ensure the 4 font families (`Plus Jakarta Sans`, `Inter`, `Noto Sans Devanagari`, `JetBrains Mono`) and dark/light themes remain unified.
3. **Refactor UI Primitives (`components/ui/`)**:
   - Update buttons, badges, card surfaces (`.glass-card`), inputs, and modals according to Stitch styling.
4. **Reapply to Feature Components**:
   - Update layouts across `components/computer-lab/`, `components/terminal/`, `components/maintenance/`, and `components/layout/`.
5. **Preserve Architectural Invariants**:
   - ⚠️ **Rule #1**: NO literal `+` in button labels (`<Plus className="..." />`).
   - ⚠️ **Rule #8**: Strict TypeScript (`npx tsc --noEmit` must pass with 0 errors).
   - ⚠️ **Rule #10**: Zero double-nested card-in-card containers.
   - ⚠️ **Rule #13**: Pure RPC server action exports in `app/actions/*`.
   - ⚠️ **Rule #19**: Workstation status dynamically derived from issues, not static DB columns.
6. **Execute Automated Test Validation**:
   - Run the complete 6-suite test pipeline:
     ```bash
     node --experimental-strip-types --import ./tests/register-hooks.mjs --test \
       tests/phase1-student-terminal.test.mjs \
       tests/phase2-auto-grid-and-projector.test.mjs \
       tests/phase3-seating-and-forensics.test.mjs \
       tests/phase4-fleet-maintenance.test.mjs \
       tests/floor-plan-status-sync.test.mjs \
       tests/workstation-floor.test.mjs
     ```

---

## 4. Quick Activation Prompt

To trigger this redesign in the future, simply tell the agent:
> *"Hey, remember our plan in `doc/plans/REMINDER_UI_REDESIGN_WITH_STITCH_GOOGLE.md`? Let's redesign the UI using stitch.google.com and reapply the new designs."*
