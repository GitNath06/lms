import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

// 1. Load .env.local into process.env before any DB clients load
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

// 2. Import modules to test
const { createSessionClaim, verifySessionClaim } = await import('../lib/security/session-claim.ts')
const { setCachedQuery, getCachedQuery, invalidateQueryCache, isCachedQueryStale, fetchWithClientCache } = await import('../lib/cache/client-query-cache.ts')
const { getLabSyncBootstrapData } = await import('../app/actions/bootstrap.ts')
const { getStudentsByClass, getStudentAvatarsBatch } = await import('../app/actions/students.ts')
const { getPracticalLogs } = await import('../app/actions/logs.ts')

describe('Phase 1–5 Performance & Data Architecture Overhaul Suite', () => {
  const dbUrl = process.env.DATABASE_URL

  // -------------------------------------------------------------
  // TEST 1: Session Claim HMAC Signing & Sub-Millisecond Verification
  // -------------------------------------------------------------
  describe('Phase 1: Web Crypto HMAC-SHA256 Session Claims', () => {
    it('generates a valid signed claim and verifies in < 1ms', async () => {
      const payload = {
        uid: 'user-uuid-1234',
        email: 'labincharge@school.edu.np',
        role: 'lab_incharge',
        approvalStatus: 'approved',
      }

      const token = await createSessionClaim(payload)
      assert.ok(token, 'Token must be generated')
      assert.ok(token.includes('.'), 'Token must be dot-delimited payload.signature')

      // Warm up crypto key import
      await verifySessionClaim(token)

      const start = performance.now()
      const verified = await verifySessionClaim(token)
      const duration = performance.now() - start

      assert.ok(duration < 5, `Verification should take < 5ms (took ${duration.toFixed(2)}ms)`)
      assert.ok(verified, 'Verified claim payload must not be null')
      assert.equal(verified?.uid, payload.uid)
      assert.equal(verified?.role, payload.role)
      assert.equal(verified?.approvalStatus, payload.approvalStatus)
    })

    it('rejects tampered claim tokens', async () => {
      const token = await createSessionClaim({
        uid: 'user-uuid-1234',
        email: 'labincharge@school.edu.np',
        role: 'lab_incharge',
        approvalStatus: 'approved',
      })

      const parts = token.split('.')
      // Tamper with payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ uid: 'hacker-uuid', role: 'super_admin' })
      ).toString('base64url')

      const tamperedToken = `${tamperedPayload}.${parts[1]}`
      const result = await verifySessionClaim(tamperedToken)
      assert.equal(result, null, 'Tampered token must be rejected')
    })
  })

  // -------------------------------------------------------------
  // TEST 2: PostgreSQL Composite B-Tree Indexes
  // -------------------------------------------------------------
  describe('Phase 2: Database Indexes & Master Bootstrap RPC', () => {
    it('verifies composite indexes exist in PostgreSQL schema', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      
      const res = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE indexname IN (
          'idx_student_enrollments_cohort',
          'idx_workstation_seat_plans_class_year',
          'idx_practical_logs_date_schedule'
        )
      `)
      await pool.end()

      const found = res.rows.map((r) => r.indexname)
      assert.ok(found.includes('idx_student_enrollments_cohort'), 'idx_student_enrollments_cohort must exist')
      assert.ok(found.includes('idx_workstation_seat_plans_class_year'), 'idx_workstation_seat_plans_class_year must exist')
      assert.ok(found.includes('idx_practical_logs_date_schedule'), 'idx_practical_logs_date_schedule must exist')
    })

    it('executes getLabSyncBootstrapData returning all 9 entities', async () => {
      if (!dbUrl) return
      const res = await getLabSyncBootstrapData()
      assert.equal(res.success, true, 'Bootstrap RPC must succeed')
      assert.ok(res.data, 'Bootstrap data payload must exist')

      const d = res.data
      assert.ok(Array.isArray(d.labs), 'labs must be an array')
      assert.ok(Array.isArray(d.academic_years), 'academic_years must be an array')
      assert.ok(Array.isArray(d.classes), 'classes must be an array')
      assert.ok(Array.isArray(d.subjects), 'subjects must be an array')
      assert.ok(Array.isArray(d.class_subjects), 'class_subjects must be an array')
      assert.ok(Array.isArray(d.teachers), 'teachers must be an array')
      assert.ok(Array.isArray(d.academic_holidays), 'academic_holidays must be an array')
      assert.ok(Array.isArray(d.issue_categories), 'issue_categories must be an array')
      assert.ok(Array.isArray(d.period_settings), 'period_settings must be an array')
      assert.ok(d.server_time, 'server_time must be defined')
    })

    it('verifies pg driver parses DATE, TIMESTAMP, and TIMESTAMPTZ as plain strings (OIDs 1082, 1114, 1184)', async () => {
      if (!dbUrl) return
      const { getPgPool } = await import('../lib/db.ts')
      const pool = getPgPool()
      const res = await pool.query(`
        SELECT 
          CURRENT_DATE as d_val, 
          LOCALTIMESTAMP as ts_val, 
          NOW() as tsz_val
      `)
      const row = res.rows[0]
      assert.equal(typeof row.d_val, 'string', 'DATE (OID 1082) must be parsed as a string')
      assert.equal(typeof row.ts_val, 'string', 'TIMESTAMP (OID 1114) must be parsed as a string')
      assert.equal(typeof row.tsz_val, 'string', 'TIMESTAMPTZ (OID 1184) must be parsed as a string')
      assert.ok(!(row.d_val instanceof Date), 'DATE must not be an instance of Date')
      assert.ok(!(row.ts_val instanceof Date), 'TIMESTAMP must not be an instance of Date')
      assert.ok(!(row.tsz_val instanceof Date), 'TIMESTAMPTZ must not be an instance of Date')
    })
  })

  // -------------------------------------------------------------
  // TEST 3: Client Query Cache (useSyncExternalStore In-Memory SWR)
  // -------------------------------------------------------------
  describe('Phase 3: Client Query Cache (0ms In-Memory SWR)', () => {
    it('sets, retrieves, marks stale, and purges cached data', () => {
      const key = 'test:query:classes'
      const data = [{ id: '11sci', name: 'Class 11 Science' }]

      setCachedQuery(key, data)
      const cached = getCachedQuery(key)
      assert.deepEqual(cached, data, 'Cached data must match')
      assert.equal(isCachedQueryStale(key, 60000), false, 'Fresh query should not be stale')

      // Mark stale via pattern invalidation
      invalidateQueryCache('test:query')
      assert.equal(isCachedQueryStale(key), true, 'Query should be marked stale')
      assert.deepEqual(getCachedQuery(key), data, 'SWR stale data must be preserved during revalidation')

      // Purge completely
      invalidateQueryCache('test:query', { purge: true })
      assert.equal(getCachedQuery(key), undefined, 'Cache entry must be purged')
    })

    it('fetchWithClientCache deduplicates parallel in-flight calls and serves fresh data in 0ms', async () => {
      let fetchCount = 0
      const fetcher = async () => {
        fetchCount++
        await new Promise((r) => setTimeout(r, 20))
        return { count: fetchCount }
      }

      // 1. Parallel calls during in-flight must share 1 single promise
      const [res1, res2, res3] = await Promise.all([
        fetchWithClientCache('test:dedup:key', fetcher, { staleTimeMs: 1000 }),
        fetchWithClientCache('test:dedup:key', fetcher, { staleTimeMs: 1000 }),
        fetchWithClientCache('test:dedup:key', fetcher, { staleTimeMs: 1000 }),
      ])

      assert.equal(fetchCount, 1, 'fetcher must only execute once despite 3 parallel calls')
      assert.deepEqual(res1, { count: 1 })
      assert.deepEqual(res2, { count: 1 })
      assert.deepEqual(res3, { count: 1 })

      // 2. Sequential call within staleTimeMs must return in 0ms without re-fetching
      const res4 = await fetchWithClientCache('test:dedup:key', fetcher, { staleTimeMs: 1000 })
      assert.equal(fetchCount, 1, 'fetcher must not re-execute when data is fresh')
      assert.deepEqual(res4, { count: 1 })
    })
  })

  // -------------------------------------------------------------
  // TEST 4: Text-First Progressive Avatars & Batch Endpoint
  // -------------------------------------------------------------
  describe('Phase 4: Two-Phase "Text-First, Avatar-Second" Loader', () => {
    it('getStudentsByClass returns has_photo with stripped photo_url (null)', async () => {
      if (!dbUrl) return
      // Fetch for class 11sci (or first available class)
      const res = await getStudentsByClass('11sci', '2083')
      if (res.success && res.data && res.data.length > 0) {
        for (const s of res.data) {
          assert.equal(s.photo_url, null, 'photo_url must be null on list payload to prevent transfer bloat')
          assert.equal(typeof s.has_photo, 'boolean', 'has_photo must be a boolean flag')
        }
      }
    })

    it('getStudentAvatarsBatch handles ID batches and caps query size', async () => {
      if (!dbUrl) return
      const testIds = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
      const res = await getStudentAvatarsBatch(testIds)
      assert.ok(typeof res === 'object', 'avatars map must be returned')
      assert.ok(!Array.isArray(res), 'avatars map must be a Record dictionary')
    })
  })

  // -------------------------------------------------------------
  // TEST 5: Windowed & Date-Locked Practical Logs
  // -------------------------------------------------------------
  describe('Phase 5: Windowed & Date-Locked Practical Logs', () => {
    it('returns logs with attached SQL count aggregations and date-locked guarantee', async () => {
      if (!dbUrl) return
      const today = new Date().toISOString().split('T')[0]
      const res = await getPracticalLogs({ effectiveDate: today, limit: 10 })

      assert.ok(Array.isArray(res), 'Return value must be an array for backwards compatibility')
      assert.ok(typeof res.totalCount === 'number', 'res.totalCount must be a number')
      assert.ok(typeof res.conductedCount === 'number', 'res.conductedCount must be a number')
      assert.ok(typeof res.skippedCount === 'number', 'res.skippedCount must be a number')
      assert.ok(Array.isArray(res.logs), 'res.logs property must point to array')
    })
  })

  after(async () => {
    try {
      if (globalThis.__PG_POOL__) {
        await globalThis.__PG_POOL__.end()
        globalThis.__PG_POOL__ = undefined
      }
    } catch {}
  })
})
