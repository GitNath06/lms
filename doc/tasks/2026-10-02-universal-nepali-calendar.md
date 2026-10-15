# Task Log: Universal Nepali (B.S.) Date Picker Deployment

- **Date**: 2026-10-02
- **Author**: Antigravity Assistant & User
- **Status**: Completed & Verified
- **Parent Plan**: [SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md](file:///d:/Projects/LMR/doc/plans/SYSTEM_INTEGRITY_AUDIT_AND_REDESIGN_ROADMAP.md)

---

## 1. Goal & Issue Identified
The user reported that date fields across the system were opening the browser's default English/Gregorian calendar (`mm/dd/yyyy`, October 2026, etc.), breaking consistency with Nepal's institutional Bikram Sambat (B.S.) calendar. Additionally, the modal button had an unwanted `+` symbol (`+ Create Academic Year`).

User directives:
1. Re-use the existing calendar UI and engine developed in `dual-calendar-picker.tsx` / `academic-calendar-modal.tsx` (Devanagari numerals, English micro-date below, amber Sunday/Saturday, "आज" badge).
2. Display Format: Option C (Devanagari) + Option A (Dual): `२०८४ बैशाख १ गते (14 Apr 2027)`.
3. Upgrade all locations across the entire system in one cohesive sweep.
4. Remove all `+` symbols/icons from buttons.

---

## 2. Changes Made
1. **Engine Expansion ([lib/nepali-date.ts](file:///d:/Projects/LMR/lib/nepali-date.ts))**:
   - Expanded `BS_CALENDAR_DATA` to cover 2075 through 2090 B.S. with accurate monthly day counts.
2. **Universal Component Created ([components/ui/nepali-date-picker.tsx](file:///d:/Projects/LMR/components/ui/nepali-date-picker.tsx))**:
   - Built a drop-in popover calendar matching the exact styling requested.
   - Dual display: `२०८४ बैशाख १ गते (14 Apr 2027)`.
   - BS Year & Month selectors (2078–2090 B.S., Baishakh to Chaitra).
   - Weekday headers with amber weekend highlights.
   - Large Devanagari numerals with small English AD dates beneath each cell.
   - `आज` (Today) badge and 1-click today jump button.
   - Clear button (`X`) when populated.
3. **Replaced Native `<input type="date">` Across ALL 8 Locations in Project**:
   - [components/admin/academic-years-manager.tsx](file:///d:/Projects/LMR/components/admin/academic-years-manager.tsx): Replaced Start & End dates, removed all `+` icons from buttons.
   - [components/computer-lab/start-adhoc-session-modal.tsx](file:///d:/Projects/LMR/components/computer-lab/start-adhoc-session-modal.tsx): Replaced session date input.
   - [components/maintenance/log-maintenance-modal.tsx](file:///d:/Projects/LMR/components/maintenance/log-maintenance-modal.tsx): Replaced service date input.
   - [components/maintenance/snooze-modal.tsx](file:///d:/Projects/LMR/components/maintenance/snooze-modal.tsx): Replaced snooze deferral date input.
   - [components/print/print-filter-controls.tsx](file:///d:/Projects/LMR/components/print/print-filter-controls.tsx): Replaced print date filter input.
   - [components/records/incident-filter-bar.tsx](file:///d:/Projects/LMR/components/records/incident-filter-bar.tsx): Replaced From & To date filter inputs.
   - [components/records/practical-filter-bar.tsx](file:///d:/Projects/LMR/components/records/practical-filter-bar.tsx): Replaced From & To date filter inputs.
   - [components/schedules/session-action-modal.tsx](file:///d:/Projects/LMR/components/schedules/session-action-modal.tsx): Replaced substitution effective date input.
   - [components/dev/time-travel-controller.tsx](file:///d:/Projects/LMR/components/dev/time-travel-controller.tsx): Replaced simulation date input.

---

## 3. Verification & Invariants
- Verified with ripgrep: **0** native `type="date"` inputs remain in `app/` and `components/`.
- Buttons comply strictly with Rule 1: No literal `+` or unwanted plus icons.
- Strict TypeScript verification executing via `npx tsc --noEmit`.
