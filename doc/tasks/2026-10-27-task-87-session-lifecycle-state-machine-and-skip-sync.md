# Task 87: Session Lifecycle State Machine, 10-Minute Standby Hold, Back-to-Back Up-Next Micro-Pill & Instant Cross-App Skip/Unscheduled Sync

**Date**: 2026-10-27  
**Category**: Core Operational State Machine & Timetable Collision Defense  
**Target Files**:
- `components/computer-lab/live-cockpit-bar.tsx`
- `components/computer-lab/computer-lab-workspace.tsx`
- `lib/scheduling/conflict-engine.ts`
- `app/actions/live-session.ts`
- `hooks/use-logs-state.ts`
- `tests/phase6-conflicts-and-audit.test.mjs`
- `doc/tasks/README.md`

---

## 1. Objectives & Executive Summary

Eliminated the "frozen / dead" session tracking perception by overhauling the Computer Lab operational state machine with 4 strict operational safeguards:
1. **Three-Tier Priority Evaluation (Every Minute Tick)**:
   - **Priority 1 (LIVE)**: A non-skipped session where $T_{\text{start}} \le \text{now} < T_{\text{end}}$. Ongoing live sessions always take precedence.
   - **Consecutive / Back-to-Back Sessions**: When Session A is LIVE and Session B is scheduled to start within $\le 10$ minutes, Session A remains on the floor plan while `LiveCockpitBar` renders a compact micro-badge: `⏭️ Up Next (in Xm): {batchName} • {subjectCode}`.
   - **Priority 2 (STANDBY_HOLD)**: No session is live and the next non-skipped session starts within $0 < (T_{\text{start}} - \text{now}) \le 10\text{ minutes}$. Locks unscheduled bookings, mounts the cohort seating plan for PC inspection/replacement, and displays `Starts in Xm` + `Skip`.
   - **Priority 3 (FREE_LAB)**: No live session and no session starts within 10 minutes. Main workspace renders `Lab Available • Free Period` with a prominent `Start Unscheduled Session` button and next session telemetry preview.
2. **Non-Blocking Concluded Grace Handling**:
   - Concluded sessions ($now \ge T_{\text{end}}$) immediately drop the live pulsing green dot and display `Concluded at {endTime} • Pending Log Submission` with `Save & Submit Practical Log`.
   - If not logged within 5 minutes past $T_{\text{end}}$, the workspace auto-releases back to `FREE_LAB` (or Standby Hold if a new class is within 10 minutes) and shows a non-blocking amber reminder banner so an unlogged session never blocks the room.
3. **True Skip Detection & Instant Cross-App Sync**:
   - `computer-lab-workspace.tsx` checks both `routines` state and `practical_logs` for today. If a session is marked `skipped`, its hold/live state is bypassed immediately.
   - `lib/scheduling/conflict-engine.ts` queries `public.practical_logs` for `status = 'skipped'` on the target date. Skipped schedule slots are ignored during facility collision checks, unblocking teachers to immediately book unscheduled practicals in that period without false collision rejections.
   - Real-time broadcasts (`broadcastSync('logs')`, `broadcastSync('schedules')`) synchronize all open tabs, dashboards, and projector views in 0ms.
4. **Clean SSR Hydration & UI Declutter**:
   - Eliminated conditional emojis (`🟢 LIVE:`, `🕒`, `✓`) inside timetable `<option>` tags, replacing them with clean plain text tags (`[LIVE]`, `[NEXT]`, `[DONE]`).
   - Added Inspection Preview banner when inspecting future sessions $> 10$m away, with a 1-tap `Return to Free Lab` button.

---

## 2. Verification & Test Evidence
- `npx tsc --noEmit` &rarr; **0 errors**.
- `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passing** (100% pass).
- `node --experimental-strip-types --import ./tests/register-hooks.mjs --test tests/phase6-conflicts-and-audit.test.mjs` &rarr; **7/7 passing** (100% pass).
