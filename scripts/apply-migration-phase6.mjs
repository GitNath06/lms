import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

// 1. Load .env.local
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

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('DATABASE_URL is missing')
  process.exit(1)
}

const sqlPath = path.resolve(process.cwd(), 'scripts', 'migration-phase6-engine-integrity.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

async function run() {
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    console.log('Applying migration scripts/migration-phase6-engine-integrity.sql...')
    await client.query(sql)
    console.log('Migration successfully applied!')

    // Verify foreign key constraint confdeltype
    const fkRes = await client.query(`
      SELECT conname, confdeltype 
      FROM pg_constraint 
      WHERE conname = 'fk_log_attendance_enrollment_student';
    `)
    console.log('Constraint fk_log_attendance_enrollment_student:', fkRes.rows)
    // confdeltype: 'r' = RESTRICT, 'c' = CASCADE, 'a' = NO ACTION, 'n' = SET NULL, 'd' = SET DEFAULT
    if (fkRes.rows[0]?.confdeltype === 'r') {
      console.log('SUCCESS: confdeltype is "r" (ON DELETE RESTRICT)!')
    } else {
      console.error('WARNING: confdeltype is not "r":', fkRes.rows[0]?.confdeltype)
    }

    // Verify uq_enrollment_roll condeferrable
    const uqRes = await client.query(`
      SELECT conname, condeferrable, condeferred 
      FROM pg_constraint 
      WHERE conname = 'uq_enrollment_roll';
    `)
    console.log('Constraint uq_enrollment_roll:', uqRes.rows)
    if (uqRes.rows[0]?.condeferrable && uqRes.rows[0]?.condeferred) {
      console.log('SUCCESS: uq_enrollment_roll is DEFERRABLE INITIALLY DEFERRED!')
    } else {
      console.error('WARNING: uq_enrollment_roll deferrability check failed:', uqRes.rows[0])
    }
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()

