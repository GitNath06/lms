import fs from 'node:fs'
import pg from 'pg'

if (fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
} else if (fs.existsSync('.env')) {
  process.loadEnvFile('.env')
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

function parseSlotTimeRange(labelOrSlot) {
  if (!labelOrSlot) {
    return { startTime: '10:10', endTime: '11:00' }
  }
  let timeSegment = labelOrSlot
  const parenMatch = labelOrSlot.match(/\(([^)]+)\)/)
  if (parenMatch) {
    timeSegment = parenMatch[1]
  }
  const parts = timeSegment.split('-').map((s) => s.trim())
  if (parts.length >= 2) {
    return { startTime: parts[0], endTime: parts[1] }
  }
  return { startTime: '10:10', endTime: '11:00' }
}

async function runSeed() {
  console.log('Ensuring all standard laboratory rooms exist in public.labs...')
  const standardLabs = [
    { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01', type: 'computer_lab', capacity: 40 },
    { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01', type: 'physics_lab', capacity: 38 },
    { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01', type: 'chemistry_lab', capacity: 40 },
    { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01', type: 'biology_lab', capacity: 35 },
    { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01', type: 'electronics_lab', capacity: 30 },
  ]

  for (const lab of standardLabs) {
    await pool.query(`
      INSERT INTO public.labs (id, name, code, type, capacity, status, is_active)
      VALUES ($1, $2, $3, $4, $5, 'Operational', true)
      ON CONFLICT (id) DO NOTHING;
    `, [lab.id, lab.name, lab.code, lab.type, lab.capacity])
  }
  console.log('✓ Standard laboratory rooms verified.')

  console.log('Extracting MASTER_ROUTINE from lib/master-data.ts...')
  const fileContent = fs.readFileSync('lib/master-data.ts', 'utf-8')

  const startMarker = 'export const MASTER_ROUTINE: MasterRoutineItem[] = ['
  const startIdx = fileContent.indexOf(startMarker)
  if (startIdx === -1) {
    throw new Error('Could not find MASTER_ROUTINE start marker!')
  }

  const arrayCode = fileContent.substring(startIdx + startMarker.length - 1).trim()
  // Evaluate the array safely
  const fn = new Function(`return ${arrayCode};`)
  const masterRoutine = fn()

  console.log(`Successfully parsed ${masterRoutine.length} sessions from MASTER_ROUTINE.`)

  let inserted = 0
  let updated = 0

  for (const item of masterRoutine) {
    const { startTime, endTime } = parseSlotTimeRange(item.timeSlot)
    const labId =
      item.labKey === 'comp'
        ? 'comp'
        : item.labKey === 'phys'
        ? 'phys'
        : item.labKey === 'chem'
        ? 'chem'
        : item.labKey === 'bio'
        ? 'bio'
        : 'elec'

    const subjectName = `${item.subjectCode} - ${item.subjectTitle}`
    const batchName = item.grade || 'Class 12'
    const span = item.span || 1
    const isMerged = Boolean(item.mergedParts && item.mergedParts.length > 0)
    const status = item.status || 'scheduled'
    const metadata = {
      teacher: item.teacher,
      labName: item.lab,
      studentsCount: item.defaultStudents,
      category: item.category,
      dotColor: item.dotColor,
      badgeColor: item.badgeColor,
      accentColor: item.accentColor,
      secondaryLab: item.secondaryLab,
      secondaryLabKey: item.secondaryLabKey,
      isDualLab: item.isDualLab,
      coTeacher: item.coTeacher,
      mergedParts: item.mergedParts,
    }

    const query = `
      INSERT INTO public.schedules (
        id, lab_id, subject_name, batch_name, start_time, end_time, slot_id, day_key, span, is_merged, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        lab_id = EXCLUDED.lab_id,
        subject_name = EXCLUDED.subject_name,
        batch_name = EXCLUDED.batch_name,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        slot_id = EXCLUDED.slot_id,
        day_key = EXCLUDED.day_key,
        span = EXCLUDED.span,
        is_merged = EXCLUDED.is_merged,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata
      RETURNING (xmax = 0) AS is_insert;
    `

    const res = await pool.query(query, [
      item.id,
      labId,
      subjectName,
      batchName,
      startTime,
      endTime,
      item.slotId,
      item.dayKey,
      span,
      isMerged,
      status,
      JSON.stringify(metadata),
    ])

    if (res.rows[0]?.is_insert) {
      inserted++
    } else {
      updated++
    }
  }

  console.log(`✓ Master schedules synchronization complete: ${inserted} inserted, ${updated} updated. Total: ${masterRoutine.length}`)

  const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM public.schedules;')
  console.log(`Total schedules currently in PostgreSQL public.schedules: ${countRes.rows[0].total}`)

  await pool.end()
}

runSeed().catch((err) => {
  console.error('Failed to seed master schedules:', err)
  process.exit(1)
})
