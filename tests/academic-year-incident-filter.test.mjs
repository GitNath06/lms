import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local into process.env if needed
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

import { formatIncidentCaseNumber } from '../lib/report-spec/incident-spec.ts'
import { getAcademicYearsForFilterAction, getIncidentRecords, getPracticalRecords } from '../app/actions/records.ts'

test('Academic Year and Incident Filters Resolution Suite', async (t) => {
  await t.test('1. formatIncidentCaseNumber: Disambiguates timestamp IDs and formats unique case hashes', () => {
    // Verify legacy IDs with unix timestamps (which start with 17...)
    assert.equal(formatIncidentCaseNumber('inc-1791040983236-x1h1'), '#INC-X1H1')
    assert.equal(formatIncidentCaseNumber('inc-1791040964741-gunx'), '#INC-GUNX')
    assert.equal(formatIncidentCaseNumber('inc-1791045779527-ogjx'), '#INC-OGJX')
    assert.equal(formatIncidentCaseNumber('inc-1791112338514-i0ie'), '#INC-I0IE')

    // Verify seed & 2-part IDs
    assert.equal(formatIncidentCaseNumber('inc-seed-1'), '#INC-1')
    assert.equal(formatIncidentCaseNumber('inc-999'), '#INC-999')

    // Verify custom incident_number overrides
    assert.equal(formatIncidentCaseNumber('inc-1791040983236-x1h1', 'INC-2083-04'), '#INC-2083-04')
    assert.equal(formatIncidentCaseNumber('inc-1791040983236-x1h1', '#INC-2083-04'), '#INC-2083-04')

    // Verify fallback on null/empty
    assert.equal(formatIncidentCaseNumber(null), '#INC-—')
    assert.equal(formatIncidentCaseNumber(''), '#INC-—')
  })

  await t.test('2. getAcademicYearsForFilterAction: Returns live DB academic cycles', async () => {
    const res = await getAcademicYearsForFilterAction()
    assert.equal(res.success, true, 'getAcademicYearsForFilterAction succeeded')
    assert.ok(Array.isArray(res.data), 'Returns an array of academic cycles')
    assert.ok(res.data.length >= 2, 'Has at least 2084 and 2083 cycles')
    const activeYear = res.data.find((y) => y.isCurrent)
    assert.ok(activeYear.id === '2083' || activeYear.id === '2084', `Current cycle is ${activeYear.id}`)
  })

  await t.test('3. getIncidentRecords: Supports academic_year_id filtering and returns real records', async () => {
    // 2083 has incidents in DB
    const res2083 = await getIncidentRecords({ academic_year_id: '2083', pageSize: 1000 })
    assert.equal(res2083.success, true, 'Query succeeded for 2083')
    assert.ok(res2083.incidents.length > 0, '2083 contains incident records')

    // 2084 has no incidents in DB yet -> should return 0, not fallback to mock seed
    const res2084 = await getIncidentRecords({ academic_year_id: '2084', pageSize: 1000 })
    assert.equal(res2084.success, true, 'Query succeeded for 2084')
    assert.equal(res2084.incidents.length, 0, '2084 legitimately has 0 incidents without fallback mock data')
    assert.equal(res2084.totalCount, 0, 'Total count for 2084 is 0')
  })

  await t.test('4. getPracticalRecords: PageSize 1000 (All) returns all records without fallback on empty cycle', async () => {
    // 2083 has practicals in DB
    const res2083 = await getPracticalRecords({ academic_year_id: '2083', pageSize: 1000 }, 'none')
    assert.equal(res2083.success, true, 'Query succeeded for 2083 practicals')
    assert.ok(res2083.totalCount >= 4, 'All 4 practical logs returned for 2083')

    // 2084 has 0 practicals -> should return 0, not fallback to mock seed
    const res2084 = await getPracticalRecords({ academic_year_id: '2084', pageSize: 1000 }, 'none')
    assert.equal(res2084.success, true, 'Query succeeded for 2084 practicals')
    assert.equal(res2084.totalCount, 0, 'Total count is 0 for 2084 without fake fallback')
    assert.equal(res2084.sections[0].records.length, 0, 'Records in section is empty for 2084')
  })
})
