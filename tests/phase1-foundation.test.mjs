import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import {
  normalizeStudentName,
  formatStudentDisplayName,
  calculateNameSimilarity,
  isNameMatch,
} from '../lib/imports/string-normalization.ts'

function loadDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.split('=')[1].trim().replace(/^["']|["']$/g, '')
    }
  }
  return null
}

describe('Phase 1 Foundation: Schema & String Normalization Suite', () => {
  const dbUrl = loadDbUrl()

  describe('Database Tables & Structural Integrity', () => {
    it('All Phase 1 tables exist in public schema', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN (
              'academic_years', 
              'students', 
              'student_enrollments', 
              'workstation_seat_plans', 
              'session_seat_overrides', 
              'lab_floor_elements'
            );
        `)
        const tables = res.rows.map(r => r.table_name)
        assert.ok(tables.includes('academic_years'), 'academic_years must exist')
        assert.ok(tables.includes('students'), 'students must exist')
        assert.ok(tables.includes('student_enrollments'), 'student_enrollments must exist')
        assert.ok(tables.includes('workstation_seat_plans'), 'workstation_seat_plans must exist')
        assert.ok(tables.includes('session_seat_overrides'), 'session_seat_overrides must exist')
        assert.ok(tables.includes('lab_floor_elements'), 'lab_floor_elements must exist')
      } finally {
        client.release()
        await pool.end()
      }
    })

    it('Academic Year 2083 is seeded and marked as is_current = true', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT id, name, is_current 
          FROM public.academic_years 
          WHERE id = '2083';
        `)
        assert.equal(res.rows.length, 1, 'Academic year 2083 must exist')
        assert.equal(res.rows[0].is_current, true, 'Academic year 2083 must be current')
        assert.equal(res.rows[0].name, '2083 B.S. (2026/27 A.D.)', 'Standard dual-calendar name format')
      } finally {
        client.release()
        await pool.end()
      }
    })

    it('Session override workstation collision constraint exists', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT conname 
          FROM pg_constraint 
          WHERE conname = 'uq_session_override_workstation';
        `)
        assert.equal(res.rows.length, 1, 'uq_session_override_workstation constraint must exist')
      } finally {
        client.release()
        await pool.end()
      }
    })

    it('Attendance bridge column exists in log_attendance', async () => {
      if (!dbUrl) return
      const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      const client = await pool.connect()
      try {
        const res = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'log_attendance' 
            AND column_name = 'student_id';
        `)
        assert.equal(res.rows.length, 1, 'student_id must exist in log_attendance')
        assert.equal(res.rows[0].data_type, 'uuid', 'student_id must be uuid')
      } finally {
        client.release()
        await pool.end()
      }
    })
  })

  describe('String Normalization & Nepali Abbreviations', () => {
    it('Normalizes Nepali abbreviation K.C. to kc', () => {
      assert.equal(normalizeStudentName('Ram K.C.'), 'ram kc')
      assert.equal(normalizeStudentName('Ram KC'), 'ram kc')
      assert.equal(normalizeStudentName('  Ram   K.C.  '), 'ram kc')
    })

    it('Normalizes B.K. abbreviation to bk', () => {
      assert.equal(normalizeStudentName('Sita B.K.'), 'sita bk')
      assert.equal(normalizeStudentName('Sita BK'), 'sita bk')
    })

    it('Strips non-alphanumeric punctuation cleanly', () => {
      assert.equal(normalizeStudentName('Bikash Shrestha-Magar'), 'bikash shresthamagar')
      assert.equal(normalizeStudentName('Aayush "Tony" Sharma'), 'aayush tony sharma')
    })

    it('Identifies name match between abbreviated and non-abbreviated variants', () => {
      assert.ok(isNameMatch('Ram K.C.', 'Ram KC'))
      assert.ok(isNameMatch('Sita B.K.', 'Sita BK'))
      assert.ok(isNameMatch('Hari Prasad Sharma', 'Sharma Hari Prasad')) // token permutation
    })

    it('Formats display name nicely in Title Case', () => {
      assert.equal(formatStudentDisplayName('RAM BAHADUR K.C.'), 'Ram Bahadur K.C.')
      assert.equal(formatStudentDisplayName('sita kumari bk'), 'Sita Kumari Bk')
    })
  })
})
