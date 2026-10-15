import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load environment variables for database connection
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

process.env.NODE_ENV = 'test'
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: '17d03665-dfaa-4edc-ab54-585057315a0b',
  email: 'admin@rrl.edu.np',
  full_name: 'System Administrator',
  role: 'super_admin',
  is_active: true,
  permissions: { all: true },
})

test('Phase 4: Multi-Year Historical Audit & Print Synchronization Test Suite', async (t) => {
  const {
    getPracticalRecords,
    getAcademicYearsForFilterAction,
    exportPracticalRecordsAction,
  } = await import('../app/actions/records.ts')
  const { filtersToSearchParams, searchParamsToFilters } = await import(
    '../lib/report-spec/filter-codec.ts'
  )
  const { getPgPool } = await import('../lib/db.ts')
  const pool = getPgPool()

  let knownYears = []
  let activeYearId = null

  await t.test('1. getAcademicYearsForFilterAction: Returns live academic cycles', async () => {
    const res = await getAcademicYearsForFilterAction()
    assert.equal(res.success, true, 'getAcademicYearsForFilterAction succeeded')
    assert.ok(Array.isArray(res.data), 'Returns an array of academic cycles')
    assert.ok(res.data.length > 0, 'Database contains at least one academic year')

    knownYears = res.data
    const currentYear = res.data.find((y) => y.isCurrent)
    assert.ok(currentYear, 'One cycle is flagged as current (isCurrent = true)')
    activeYearId = currentYear.id

    for (const cycle of res.data) {
      assert.ok(cycle.id, 'Cycle has an id')
      assert.ok(cycle.name, 'Cycle has a formatted name')
      assert.equal(typeof cycle.isCurrent, 'boolean', 'isCurrent is boolean')
    }
  })

  await t.test('2. Filter Codec: Bidirectional URL search params preserve academic_year_id', async () => {
    // Serialization
    const searchParams = filtersToSearchParams({
      academic_year_id: activeYearId,
      lab_id: 'comp',
      status: 'conducted',
    })
    assert.equal(
      searchParams.get('academic_year_id'),
      activeYearId,
      'filtersToSearchParams includes academic_year_id'
    )

    // Deserialization with primary key
    const parsed = searchParamsToFilters(searchParams)
    assert.equal(
      parsed.academic_year_id,
      activeYearId,
      'searchParamsToFilters decodes academic_year_id'
    )

    // Deserialization with legacy alias key 'year'
    const legacyParams = new URLSearchParams('year=2082&lab_id=phys')
    const parsedLegacy = searchParamsToFilters(legacyParams)
    assert.equal(
      parsedLegacy.academic_year_id,
      '2082',
      'searchParamsToFilters supports legacy alias ?year=2082'
    )
  })

  await t.test('3. getPracticalRecords: Scopes queries and metrics to specified academic year', async () => {
    // Query for active year
    const resActive = await getPracticalRecords(
      {
        academic_year_id: activeYearId,
        page: 1,
        pageSize: 10,
      },
      'none'
    )

    assert.equal(resActive.success, true, 'Query for active year succeeded')
    assert.ok(resActive.metrics, 'Summary metrics returned')
    assert.ok(Array.isArray(resActive.academicYears), 'Academic years list returned to caller')
    assert.equal(resActive.activeAcademicYearId, activeYearId, 'Active academic year id identified')

    // Verify all records returned belong to the requested year
    const flatRecords = resActive.sections.flatMap((s) => s.records)
    for (const record of flatRecords) {
      if (record.academic_year_id) {
        assert.equal(
          record.academic_year_id,
          activeYearId,
          'Record academic_year_id matches filter'
        )
      }
    }

    // Query for all years (consolidated)
    const resAll = await getPracticalRecords(
      {
        academic_year_id: 'all',
        page: 1,
        pageSize: 10,
      },
      'none'
    )

    assert.equal(resAll.success, true, 'Query for consolidated all cycles succeeded')
    assert.ok(resAll.totalCount >= flatRecords.length, 'Consolidated count >= single year count')
  })

  await t.test('4. exportPracticalRecordsAction: Excel and CSV exports include year metadata', async () => {
    // Excel export
    const xlsxRes = await exportPracticalRecordsAction(
      {
        academic_year_id: activeYearId,
      },
      'none',
      'xlsx',
      {
        visibleColumns: ['date', 'period', 'facility', 'class_batch', 'subject', 'attendance', 'status'],
      }
    )

    assert.equal(xlsxRes.success, true, 'Excel export succeeded')
    assert.ok(xlsxRes.base64, 'Base64 buffer returned')
    assert.ok(
      xlsxRes.filename.includes(`ay-${activeYearId}`),
      `Filename contains academic year tag: ${xlsxRes.filename}`
    )

    // CSV export
    const csvRes = await exportPracticalRecordsAction(
      {
        academic_year_id: activeYearId,
      },
      'none',
      'csv',
      {
        visibleColumns: ['date', 'period', 'facility', 'class_batch', 'subject', 'attendance', 'status'],
      }
    )

    assert.equal(csvRes.success, true, 'CSV export succeeded')
    assert.ok(csvRes.base64, 'Base64 text returned')
    assert.ok(
      csvRes.filename.includes(`ay-${activeYearId}`),
      `Filename contains academic year tag: ${csvRes.filename}`
    )
  })

  await t.test('5. Foreign Key Protection Invariant: practical_logs reference academic_years', async () => {
    const fkeyCheck = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'practical_logs'
        AND kcu.column_name = 'academic_year_id';
    `)

    assert.ok(fkeyCheck.rows.length > 0, 'Foreign key constraint exists on practical_logs.academic_year_id')
    assert.equal(
      fkeyCheck.rows[0].foreign_table_name,
      'academic_years',
      'Foreign key targets academic_years table'
    )
    assert.equal(
      fkeyCheck.rows[0].delete_rule,
      'RESTRICT',
      'Foreign key delete rule is RESTRICT (protecting historical log records from cascade deletion)'
    )
  })
})
