# Task 90: Idempotent Practical Log Persistence, Simulated Date Lock & Duplicate Elimination

**Date**: 2026-10-29  
**Category**: Practical Logbook, Live Session Cockpit & Idempotency Hardening  
**Target Files**:
- `app/actions/logs.ts`
- `app/actions/live-session.ts`
- `components/schedules/session-action-modal.tsx`
- `components/computer-lab/computer-lab-workspace.tsx`
- `components/computer-lab/live-cockpit-bar.tsx`
- `doc/tasks/README.md`

---

## 1. Forensic Root Cause & Investigation Summary

The user reported that after saving and submitting a practical log from inside the Live Session Cockpit on `/computer-lab`:
- The button still displayed `Save & Submit Practical Log` instead of reflecting that the log was recorded.
- Clicking the button repeatedly allowed the user to submit multiple duplicate practical logs for the exact same session on the same day.

### Forensic Investigation:
1. **Date Desynchronization**:
   - In `components/schedules/session-action-modal.tsx`, `logRecord` and fallback calls hardcoded `date: getNepalDateStr()`, evaluating to today's real-world date (`2026-10-29`).
   - However, on the workspace, simulated time or selected timetable viewing date was set to Wednesday (`2026-10-28`).
   - Consequently, the log was saved in `public.practical_logs` with `date = '2026-10-29'`.
   - When `fetchLiveSession(scheduleId, effectiveDateStr)` reloaded the session for Wednesday (`2026-10-28`), `getLiveSessionContext` queried:
     ```sql
     SELECT ... FROM practical_logs WHERE schedule_id = $1 AND date = '2026-10-28'
     ```
     This query returned `null` because the log had been inserted with Thursday's date.
   - Because `sessionContext.existingLog` remained `null`:
     - `LiveCockpitBar` continued to render `<CheckCircle2 /> <span>Save & Submit Practical Log</span>`.
     - The badge did not show the 24-hour edit window.
2. **Missing Schedule-Level Idempotency in `createPracticalLog`**:
   - `createPracticalLog` in `app/actions/logs.ts` only performed duplicate checks by matching strings (`period_label`, `batch_group`, `subject_name`).
   - It did not check for existing records matching `(schedule_id, date)`.
   - When `data.id` was omitted, `createPracticalLog` generated a new random UUID/id every time, resulting in duplicate rows in PostgreSQL instead of updating the existing session log in-place.

---

## 2. Actions Implemented

### A. Authoritative Session Date Binding
1. **`SessionActionModal` Date Prop Propagation**:
   - Added `sessionDate?: string` to `SessionActionModalProps`.
   - Initialized `subDate` to `sessionDate || session?.date || getNepalDateStr()`.
   - Defined `effectiveSessionDate = sessionDate || (session as any)?.date || subDate || getNepalDateStr()` in `handleActionSubmit` so that logs, skips, and incident reports use the session's active date.
2. **`computer-lab-workspace.tsx` Date Precedence**:
   - In `handleSaveLogFromModal` and `handleSkipFromModal`, enforced `targetSessionDate = sessionContext.date || effectiveDateStr || logData.date`.
   - Passed `sessionDate={sessionContext?.date || effectiveDateStr}` to `<SessionActionModal>`.
   - Ensured `fetchLiveSession` reloads with `targetSessionDate`.

### B. Server-Side Idempotent Upsert Guard in `createPracticalLog`
In `app/actions/logs.ts`:
1. **Schedule-Date Auto-Linking**:
   - When `logPayload.schedule_id` and `checkDate` are present and `targetEditId` is not explicitly provided:
     ```ts
     const { data: schedMatch } = await supabase
       .from('practical_logs')
       .select('id')
       .eq('schedule_id', logPayload.schedule_id)
       .eq('date', checkDate)
       .order('created_at', { ascending: false })
       .limit(1)
       .maybeSingle()
     if (schedMatch?.id) targetEditId = schedMatch.id
     ```
   - Auto-assigns `recordId = targetEditId`.
   - Supersedes duplicate inserts by performing an in-place `ON CONFLICT (id) DO UPDATE`.
2. **Purged Loose Grade Substring Matching**:
   - In `app/actions/logs.ts`, replaced `normBatch.includes(String(cs.classes.grade))` with strict alphanumeric matching (`cleanBatch === cleanClsName`).

### C. Live Session Query Hardening
In `app/actions/live-session.ts`:
- Added `.order('created_at', { ascending: false }).limit(1)` to `getLiveSessionContext`'s `practical_logs` query to ensure robust single-row retrieval.

### D. Corrected Historical Wednesday Record
- Updated existing `log-1793254336741-7b2lr` (`DBMS-10` Class 10 C) in `public.practical_logs` from `'2026-10-29'` to `'2026-10-28'` so it binds to the simulated session.

---

## 3. Verification & Evidence

1. **TypeScript Verification**:
   - `npx tsc --noEmit` &rarr; **0 compile or type errors**.
2. **Unit Domain Invariants**:
   - `tests/unit-domain-invariants.test.mjs` &rarr; **12/12 passed (0 failed)**.
3. **Phase 6 Conflict & Audit Suite**:
   - `tests/phase6-conflicts-and-audit.test.mjs` &rarr; **8/8 passed (0 failed)**.
4. **Cockpit Bar Dynamic UI**:
   - Once a log is saved, `sessionContext.existingLog` is immediately populated.
   - The button automatically transforms to `<FileCheck /> <span>Update Session Log</span>`.
   - The status bar displays `Editable: 24h window remaining`.
   - Any re-save performs an idempotent update on the same row.

