# you asked

message time: 2026-10-16 13:03:54

### Domain 1: Database & Backend Data Layer
1. **Database Indexing:** Are frequently queried, filtered (`WHERE`), sorted (`ORDER BY`), and joined foreign keys explicitly indexed? Flag missing composite indexes.
​2. **N+1 Query Detection:** Are ORM calls (Prisma, TypeORM, Hibernate, ActiveRecord, etc.) executing separate sub-queries inside loops instead of using eager joins, batch fetching, or dataloaders?
3. **Expensive Query & Computation Caching:** Are resource-heavy aggregations or repetitive queries cached (e.g., via Redis, Memcached, or materialized views) with appropriate TTLs?
4. **Database Connection Pooling:** Is there an active pool configuration (e.g., PgBouncer, HikariCP, Prisma connection limits) to prevent connection starvation under concurrent spikes?
5. **Pagination of Large Datasets:** Are all multi-record endpoints strictly paginated (cursor-based or limit/offset)? Flag unbounded `.findAll()` or `SELECT *` without limits.

### Domain 2: Network, Edge & Infrastructure
6. **API Response Caching:** Are read-heavy HTTP endpoints returning appropriate cache directives (`Cache-Control`, `ETag`, `stale-while-revalidate`) or edge/reverse-proxy cache policies?
7. **API Payload Compression:** Is compression middleware (`Brotli` / `Gzip`) active on the web/API gateway for JSON payloads and static responses?
8. **CDN Distribution:** Are static assets (JS, CSS, images, media) served via a globally distributed CDN with aggressive caching headers?
9. **Load Balancing & Horizontal Scaling:** Is traffic routed through a load balancer (ALB, Nginx, Cloudflare) with clear health check configurations and session persistence strategy?
10. **Server-Side Application Caching:** Is in-memory or distributed caching utilized for rendered HTML fragments, token lookups, or user session state?

### Domain 3: Frontend Runtime & Interaction
11. **Unnecessary Component Re-renders:** Are UI components re-rendering unnecessarily due to unstable object references, missing memoization (`useMemo`, `useCallback`, `React.memo`), or bloated context state?
12. **Input Debouncing & Throttling:** Are search inputs, window resize handlers, scroll events, and autosave calls debounced or throttled to prevent event-loop congestion?
13. **Loading Skeletons & Layout Stability:** Are perceived loading states handled with structural skeleton loaders rather than blocking spinners or content shifts that harm CLS (Cumulative Layout Shift)?

### Domain 4: Asset Delivery, Bundling & Core Web Vitals
14. **Asset Lazy Loading:** Are below-the-fold images, offscreen iframes, and hidden heavy components lazy-loaded via native `loading="lazy"` or dynamic imports?
15. **Image Optimization & Compression:** Are modern formats (`WebP`, `AVIF`) enforced, images responsive (`srcset`), and raw uploads auto-compressed before delivery?
16. **Code Splitting & Dynamic Chunks:** Is code split at the route level and heavy modal/subsystem level (e.g., `React.lazy`, dynamic `import()`) to keep the initial bundle small?
17. **JS/CSS Minification:** Is the production build pipeline configured to aggressively strip dead code, minify, and mangle bundle outputs?
18. **Non-Critical Script Deferral:** Are third-party scripts (analytics, trackers, widgets) loaded asynchronously or deferred (`async`, `defer`, or dedicated script loaders)?
19. **Unused Dependencies & Tree-Shaking:** Are there bloated imports (e.g., importing entire `lodash` instead of `lodash-es` or specific utils) and packages that can be pruned?
20. **Lighthouse & Core Web Vitals Readiness:** Are there immediate blockers for LCP (<2.5s), INP (<200ms), and CLS (<0.1)?

---

### Audit Output Format
Present your analysis as:
- **Executive Summary:** Overall performance grade (A-F) and top 3 critical bottlenecks.
- **Detailed Audit Table:** Checkpoint | Status (Pass / Fail / Warn) | High-Level Finding.
- **Remediation Plan:** Prioritized step-by-step code and config patches starting with Highest Impact / Lowest Effort.

---

# gemini response

## Executive Summary

**Overall Performance Grade: C+**

The **LabSync LIMS** architecture demonstrates strong foundational engineering in several areas: it implements a singleton `pg.Pool` routed through Supabase’s transaction-mode connection pooler (port `6543`), utilizes `next/dynamic` to split heavy administrative subsystems out of the initial bundle, and provides custom route-level `loading.tsx` skeletons. 

However, production scalability and runtime responsiveness are bottlenecked by **three critical issues**:
1. **Unpooled `pg.Client` Instantiation & Sequential N+1 Loops in Server Actions:** Authentication (`app/actions/auth.ts`) and OTP (`app/actions/otp.ts`) actions bypass the shared `getPgPool()` singleton and spin up raw `new pg.Client()` TCP/SSL handshakes on every call. Furthermore, log creation (`app/actions/logs.ts`), floor element updates (`app/actions/floor-elements.ts`), and cohort promotions (`app/actions/academic-years.ts`) execute sequential `await` queries inside `for...of` loops.
2. **1Hz Global Re-render Cascade (`useLiveSchedule`):** `hooks/use-live-schedule.ts` runs a `1000ms` `setInterval` that updates `now` state every second, triggering full-tree re-renders and recalculating Bikram Sambat calendar conversions, period ranges, and array sorting on every tick.
3. **Un-debounced Server Action Filter Queries:** Search inputs in `app/(dashboard)/records/incidents/page.tsx` and `app/(dashboard)/records/page.tsx` bind directly to `filters.search`, which sits in a `useEffect` dependency array that invokes database-backed Server Actions (`getIncidentRecords`, `getPracticalRecords`) and `window.history.replaceState` on every keystroke.

---

## Detailed Audit Table

| # | Checkpoint | Status | High-Level Finding |
| :--- | :--- | :---: | :--- |
| **1** | **Database Indexing** | **Warn** | Leading-wildcard `ILIKE '%...%'` queries across `audit_logs`, `practical_logs`, `lab_incidents`, and `students` bypass standard B-Tree indexes and force sequential table scans. Missing composite indexes on `(academic_year_id, class_id, status)` and `(schedule_id, date)`. |
| **2** | **N+1 Query Detection** | **Fail** | Sequential `await` database queries inside `for...of` loops in `app/actions/logs.ts` (attendance bridging), `app/actions/floor-elements.ts` (`saveLabFloorElements`), `app/actions/academic-years.ts` (cohort promotion), and client outbox flushing (`use-logs-state.ts`). |
| **3** | **Expensive Query & Computation Caching** | **Warn** | Heavy analytical aggregations in `app/actions/institutional-reports.ts` (`getStudentBoardComplianceReport`, `getWorkstationReliabilityAnalytics`, `getInstitutionalReminders`) execute multi-table `JOIN` and `GROUP BY` queries on every request with zero caching (`unstable_cache` or Redis). |
| **4** | **Database Connection Pooling** | **Warn** | `lib/db.ts` properly configures a singleton `pg.Pool` (`max: 20`, port `6543`), **but** `app/actions/auth.ts` and `app/actions/otp.ts` define a separate `getPgClient()` that instantiates a raw, unpooled `new pg.Client()` on every request. |
| **5** | **Pagination of Large Datasets** | **Warn** | `getAuditLogs`, `getPracticalRecords`, and `getIncidentRecords` support pagination when `pageSize` is passed. However, `getAllUsers()`, `getIncidents()`, `getNotifications()`, `getPracticalLogs()`, and print/export routes execute unbounded queries (`SELECT *` without `LIMIT`). |
| **6** | **API Response Caching** | **Warn** | Data fetching relies almost entirely on Next.js Server Actions (`POST` requests) and dynamic SSR queries without `unstable_cache` or `Cache-Control` / `stale-while-revalidate` directives for read-heavy reference data (labs, classes, academic years). |
| **7** | **API Payload Compression** | **Warn** | Export actions (`exportMaintenanceRecordsAction`, `exportStudentBoardComplianceAction`) encode full `.xlsx` and `.csv` buffers as Base64 strings inside JSON payloads (~33% size inflation) instead of streaming binary responses via Route Handlers. |
| **8** | **CDN Distribution** | **Warn** | User and student avatars (`photo_url`) are stored and rendered as raw Base64 Data URLs (`fileToBase64` in `lib/image-compression.ts`) or unoptimized external URLs via raw `<img>` tags (`app/(dashboard)/records/new/log-form.tsx`) instead of CDN-backed storage buckets. |
| **9** | **Load Balancing & Horizontal Scaling** | **Fail** | Stateful in-memory globals (`globalThis.__INCIDENT_RECORDS_STORE__`, `globalThis.__PRACTICAL_LOGS_STORE__`, `globalThis.__PRINT_SELECTION_TOKENS__`, `userProfileCache`, `IN_MEMORY_DISPATCH_LOGS`) break session and data consistency across multi-instance / serverless horizontal scaling. |
| **10** | **Server-Side Application Caching** | **Warn** | `userProfileCache` (`auth.ts`) and `cachedHolidays` (`holidays.ts`) use per-process `Map` caches with 30s–300s TTLs. These do not share state across serverless workers and are not integrated with Next.js Data Cache (`unstable_cache`). |
| **11** | **Unnecessary Component Re-renders** | **Fail** | `useLiveSchedule` (`hooks/use-live-schedule.ts`) triggers a state update every `1000ms` (`setInterval`), causing all consuming dashboard views to re-render every second. Additionally, `useLogsState` and `useIncidentState` compare full arrays via `JSON.stringify(prev) === saved` on storage events. |
| **12** | **Input Debouncing & Throttling** | **Fail** | Search inputs in `app/(dashboard)/records/incidents/page.tsx` and `app/(dashboard)/admin/page.tsx` update state on every keystroke without debouncing. In `records/incidents/page.tsx`, typing triggers `fetchIncidents()` (a Server Action DB query) on every character typed. |
| **13** | **Loading Skeletons & Layout Stability** | **Pass** | Dedicated `loading.tsx` files with structural `<Skeleton/>` components are implemented across `/admin`, `/incidents`, `/records`, `/records/incidents`, `/records/new`, and `/print/records`. |
| **14** | **Asset Lazy Loading** | **Warn** | Heavy admin components are lazy-loaded, but raw `<img src={st.photo_url} />` elements in `app/(dashboard)/records/new/log-form.tsx` lack `loading="lazy"`, `width`, and `height` attributes. |
| **15** | **Image Optimization & Compression** | **Warn** | `lib/image-compression.ts` compresses client uploads via HTML5 Canvas (`1600px`, JPEG `0.75`), but outputs JPEG instead of `WebP` and converts files to Base64 strings (`fileToBase64`), bloating database rows and JSON payloads. `next/image` is not used for rendering. |
| **16** | **Code Splitting & Dynamic Chunks** | **Pass** | `app/(dashboard)/admin/page.tsx` makes extensive use of `next/dynamic` (`ssr: false`) for 10 heavy modules (`AdminFloorArchitect`, `RoutineManager`, `ClassRosterView`, etc.). However, `app/(dashboard)/incidents/page.tsx` and `app/(dashboard)/analytics/analytics-client-page.tsx` statically import all tabs and modals. |
| **17** | **JS/CSS Minification** | **Pass** | Standard Next.js App Router production build pipeline handles SWC minification, dead-code elimination, and CSS bundling. |
| **18** | **Non-Critical Script Deferral** | **Pass** | No render-blocking third-party `<script>` tags exist in the application routes. Non-critical post-mutation tasks (emails) properly use Next.js `after()` in `incidents.ts`, `logs.ts`, and `otp.ts`. |
| **19** | **Unused Dependencies & Tree-Shaking** | **Warn** | `app/(auth)/login/page.tsx` imports 26 icons from `lucide-react` (9 of which—`Shield`, `Sparkles`, `Cpu`, `Atom`, `TestTube2`, `ChevronRight`, `HelpCircle`, `Phone`, `RotateCcw`, `Wrench`—are completely unused). `app/actions/maintenance.ts` top-level imports `ExcelJS` (`generateMaintenanceRecordsXlsxBuffer`), pulling heavy spreadsheet code into the action module on cold start. |
| **20** | **Lighthouse & Core Web Vitals Readiness** | **Warn** | **LCP Blocker:** `app/(dashboard)/computer-lab/page.tsx` executes 4 sequential `await` database queries before streaming HTML. **INP Blocker:** Un-debounced search inputs triggering Server Actions + synchronous `localStorage.setItem(JSON.stringify(...))` on large arrays. |

---

## Remediation Plan

### Priority 1: Highest Impact / Lowest Effort (Immediate Quick Wins)

#### 1. Replace Raw `pg.Client` with Shared `getPgPool()` in Auth & OTP Actions (Domain 1.4)
**Bottleneck:** `app/actions/auth.ts` and `app/actions/otp.ts` call `getPgClient()`, which creates a brand-new `new pg.Client()` TCP + SSL connection on every invocation. Under concurrent login or registration spikes, this exhausts PostgreSQL connections and adds 150–300ms of SSL handshake latency per request.
**Patch (`app/actions/auth.ts` & `app/actions/otp.ts`):**
```typescript
// REMOVE getPgClient() from app/actions/auth.ts and app/actions/otp.ts:
// function getPgClient() { return new pg.Client(...) }

// REPLACE single queries with getPgPool().query():
import { getPgPool } from '@/lib/db'

export async function toggleUserActiveStatus(userId: string, is_active: boolean) {
  const scope = await getServerUserScope()
  if (scope.role !== 'super_admin') {
    return { success: false, error: 'Access Denied' }
  }

  const pool = getPgPool()
  const prevRes = await pool.query(
    `SELECT id, full_name, role, is_active FROM public.profiles WHERE id = $1::uuid`,
    [userId]
  )
  const beforeProfile = prevRes.rows[0] || null

  await pool.query(
    `UPDATE public.profiles SET is_active = $1 WHERE id = $2::uuid`,
    [is_active, userId]
  )
  // ... audit & revalidate
}

// For multi-statement transactions (e.g., deleteUserAccount, verifySignupAndCreateAccount),
// checkout a pooled client and release it in `finally`:
const pool = getPgPool()
const client = await pool.connect()
try {
  await client.query('BEGIN')
  // ... transactional queries ...
  await client.query('COMMIT')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release() // Returns connection to pool instead of closing TCP socket
}
```

#### 2. Parallelize Sequential Server Queries in `ComputerLabPage` (Domain 4.20 - LCP)
**Bottleneck:** `app/(dashboard)/computer-lab/page.tsx` runs 4 independent queries (`getWorkstationBoardData`, `labs`, `schedules`, `classes`, `class_subjects`) sequentially, delaying Time to First Byte (TTFB) and Largest Contentful Paint (LCP).
**Patch (`app/(dashboard)/computer-lab/page.tsx`):**
```typescript
export default async function ComputerLabPage() {
  const supabase = await createClient()
  const scope = await getServerUserScope()
  const pool = getPgPool()

  // Execute all 5 independent data fetches concurrently
  const [
    initialBoardData,
    labRes,
    { data: schedRows },
    { data: classesData },
    { data: csRows },
  ] = await Promise.all([
    getWorkstationBoardData('comp'),
    pool
      .query('SELECT id, name, code, capacity, type, status, is_active FROM public.labs WHERE id = $1 LIMIT 1', ['comp'])
      .catch(() => ({ rows: [] })),
    (supabase.from('schedules') as any)
      .select(`
        id, lab_id, teacher_id, start_time, end_time, day_key, class_subject_id,
        class_subjects:class_subject_id (
          id, class_id, subject_id, teacher_id,
          classes:class_id ( id, name, grade, section ),
          subjects:subject_id ( id, code, name ),
          profiles:teacher_id ( id, full_name )
        )
      `)
      .eq('lab_id', 'comp')
      .order('start_time', { ascending: true }),
    (supabase.from('classes') as any)
      .select('id, name, grade, section')
      .order('grade', { ascending: true }),
    (supabase.from('class_subjects') as any)
      .select(`
        id, class_id, subject_id, teacher_id,
        classes:class_id ( id, name ),
        subjects:subject_id ( id, code, name )
      `),
  ])
  // ... transform and render
}
```

#### 3. Debounce Filter & Search Inputs Triggering Server Actions (Domain 3.12 - INP)
**Bottleneck:** In `app/(dashboard)/records/incidents/page.tsx`, `useEffect(() => { fetchIncidents(true) }, [filters])` fires a full database query Server Action on every keystroke when `filters.search` changes.
**Patch (`app/(dashboard)/records/incidents/page.tsx`):**
```typescript
// Add a debounced filter state before triggering the Server Action useEffect:
const [debouncedFilters, setDebouncedFilters] = useState<IncidentRecordFilters>(filters)

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedFilters(filters)
  }, 300)
  return () => clearTimeout(timer)
}, [filters])

useEffect(() => {
  fetchIncidents(true)
  if (typeof window !== 'undefined') {
    const params = filtersToSearchParams(debouncedFilters)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }
}, [debouncedFilters])
```

#### 4. Throttle `useLiveSchedule` Ticker & Memoize Derived Schedule Computations (Domain 3.11)
**Bottleneck:** `hooks/use-live-schedule.ts` updates `now` every `1000ms` and recalculates `getNepaliDate(now)`, `todaySessions`, `activeSessions`, and `upcomingSessions` on every render.
**Patch (`hooks/use-live-schedule.ts`):**
```typescript
// 1. Update schedule evaluation on 15-second intervals (or only when minute changes),
// and memoize heavy Nepali date & session sorting by minute:
const currentMinuteStamp = Math.floor(now.getTime() / 60000)

const nepaliDate = useMemo(() => getNepaliDate(now), [currentMinuteStamp])

const { todaySessions, activeSessions, upcomingSessions, activeSlotId, activePeriodName, minutesRemaining } = useMemo(() => {
  // Perform period range lookup and sortSessionsChronologically only once per minute
  // or when customRoutines / holidayInfo changes
  ...
}, [currentMinuteStamp, customRoutines, isWeekend, isHoliday, holidayTitle, dayKey])
```

---

### Priority 2: High Impact / Medium Effort (Database & N+1 Eliminations)

#### 5. Eliminate N+1 Queries in Attendance Bridging & Floor Element Saving (Domain 1.2)
**Bottleneck 1:** In `app/actions/logs.ts` (lines 469–480), `createPracticalLog` loops over `enrollments` and executes an individual `await supabase.from('log_attendance').update(...)` for every student in the class (35–42 queries per log submission).
**Patch (`app/actions/logs.ts`):**
```typescript
// Replace the for-loop of individual Supabase updates with a single SQL bulk UPDATE join:
const pool = getPgPool()
await pool.query(
  `UPDATE public.log_attendance la
   SET enrollment_id = se.id,
       student_id = se.student_id
   FROM public.student_enrollments se
   WHERE la.log_id = $1
     AND la.enrollment_id IS NULL
     AND se.academic_year_id = $2
     AND se.class_id = $3
     AND se.status = 'active'
     AND la.roll_number = se.roll_number;`,
  [recordId, effectiveYearId, targetClassId]
)
```

**Bottleneck 2:** In `app/actions/floor-elements.ts` (`saveLabFloorElements`), elements are updated/inserted sequentially inside a `for (const el of elements)` loop.
**Patch (`app/actions/floor-elements.ts`):**
```typescript
// Batch upsert all floor landmarks in a single query:
const toUpsert = elements.map((el) => {
  const { x, y } = clampFloorCoordinates(el.pos_x, el.pos_y)
  return {
    ...(el.id ? { id: el.id } : {}),
    lab_id: labId,
    element_type: el.element_type,
    label: el.label.trim(),
    pos_x: x,
    pos_y: y,
    width: el.width || 12.0,
    height: el.height || 4.0,
    rotation: el.rotation || 0,
    metadata: el.metadata || {},
    is_active: el.is_active !== undefined ? el.is_active : true,
  }
})

const { error } = await supabase.from('lab_floor_elements').upsert(toUpsert)
```

#### 6. Add Missing Composite & Trigram Indexes to PostgreSQL (Domain 1.1)
**Bottleneck:** Frequent multi-column filters (`student_enrollments`, `practical_logs`, `workstation_seat_plans`) and `ILIKE '%search%'` queries lack composite and GIN trigram indexes.
**Migration SQL Patch:**
```sql
-- Enable pg_trgm for fast ILIKE '%...%' searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Composite indexes for hot foreign-key + filter lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_enrollments_year_class_status
  ON public.student_enrollments (academic_year_id, class_id, status, roll_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practical_logs_year_lab_date
  ON public.practical_logs (academic_year_id, lab_id, date DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practical_logs_schedule_date
  ON public.practical_logs (schedule_id, date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lab_incidents_lab_status_date
  ON public.lab_incidents (lab_id, status, severity, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workstation_issues_ws_status
  ON public.workstation_issues (workstation_id, status, severity);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_action_created
  ON public.audit_logs (entity_type, action, created_at DESC);

-- 2. GIN Trigram indexes for ILIKE '%search%' filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practical_logs_search_trgm
  ON public.practical_logs USING gin (practical_title gin_trgm_ops, subject_name gin_trgm_ops, batch_group gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_name_trgm
  ON public.students USING gin (full_name gin_trgm_ops, admission_no gin_trgm_ops);
```

#### 7. Fix Unbounded `.select('*')` in `createPracticalLog` Duplicate Check (Domain 1.5)
**Bottleneck:** In `app/actions/logs.ts` (lines 184–186), the duplicate check fetches **every historical log ever recorded for a lab** (`select(...).eq('lab_id', checkLab)` without `.eq('date', checkDate)`) and filters them in JavaScript.
**Patch (`app/actions/logs.ts`):**
```typescript
const { data: existingDbRows, error: dupErr } = await (supabase.from('practical_logs') as any)
  .select('id, date, lab_id, period_label, batch_group, subject_name')
  .eq('lab_id', checkLab)
  .eq('date', checkDate) // <-- Bound the query to the specific date in SQL!
```

---

### Priority 3: Medium Impact / Medium Effort (Caching, Bundling & Asset Delivery)

#### 8. Cache Expensive Analytical Aggregations with `unstable_cache` (Domain 1.3 & 2.10)
**Bottleneck:** `getStudentBoardComplianceReport`, `getWorkstationReliabilityAnalytics`, and `getInstitutionalReminders` in `app/actions/institutional-reports.ts` run 3 to 5 multi-table aggregation queries on every page load.
**Patch (`app/actions/institutional-reports.ts`):**
```typescript
import { unstable_cache } from 'next/cache'

export const getCachedStudentBoardComplianceReport = unstable_cache(
  async (academicYearId: string, classId: string) => {
    return getStudentBoardComplianceReport({ academicYearId, classId })
  },
  ['student-board-compliance'],
  { revalidate: 120, tags: ['practical-logs', 'student-enrollments'] }
)
```

#### 9. Lazy-Load `ExcelJS` in `app/actions/maintenance.ts` & Dynamic-Import Analytics Tabs (Domain 4.16 & 4.19)
**Bottleneck:** `app/actions/maintenance.ts` statically imports `generateMaintenanceRecordsXlsxBuffer` (which imports `exceljs`) at the top of the file, unlike `app/actions/institutional-reports.ts` which dynamically imports it. Additionally, `app/(dashboard)/analytics/analytics-client-page.tsx` statically imports all 5 analytics tabs.
**Patch (`app/actions/maintenance.ts`):**
```typescript
// Remove top-level import:
// import { generateMaintenanceRecordsXlsxBuffer } from '@/lib/exports/xlsx'

// Inside exportMaintenanceRecordsAction:
const { generateMaintenanceRecordsXlsxBuffer } = await import('@/lib/exports/xlsx')
const buffer = await generateMaintenanceRecordsXlsxBuffer(formattedRecords, summaryMetrics, { ... })
```
**Patch (`app/(dashboard)/analytics/analytics-client-page.tsx`):**
```typescript
import dynamic from 'next/dynamic'

const SyllabusProgressTab = dynamic(() => import('@/components/analytics/syllabus-progress-tab').then(m => m.SyllabusProgressTab))
const FacultyActivityTab = dynamic(() => import('@/components/analytics/faculty-activity-tab').then(m => m.FacultyActivityTab))
const LabOccupancyTab = dynamic(() => import('@/components/analytics/lab-occupancy-tab').then(m => m.LabOccupancyTab))
const WorkstationReliabilityTab = dynamic(() => import('@/components/analytics/workstation-reliability-tab').then(m => m.WorkstationReliabilityTab))
```

#### 10. Switch Image Compression to `image/webp` and Upload to Supabase Storage (Domain 2.8 & 4.15)
**Bottleneck:** `lib/image-compression.ts` exports `image/jpeg` and converts images to Base64 strings via `fileToBase64`, which are stored directly in `public.profiles.photo_url` and `public.students.photo_url`. This inflates every profile/roster query payload.
**Patch (`lib/image-compression.ts`):**
```typescript
// Export as WebP for 25-35% smaller file sizes over JPEG at equivalent quality:
const blob = await new Promise<Blob | null>((resolve) => {
  canvas.toBlob((b) => resolve(b), 'image/webp', opts.quality)
})
const compressedFileName = `${originalBaseName || 'photo'}_compressed.webp`
const compressedFile = new File([blob], compressedFileName, {
  type: 'image/webp',
  lastModified: Date.now(),
})
```
Upload the resulting `File` to a public Supabase Storage bucket (`avatars` / `incident-photos`) with `cacheControl: '31536000'` and store only the CDN URL string in PostgreSQL. Render avatars with `loading="lazy"` and explicit dimensions (`width={24} height={24}`).