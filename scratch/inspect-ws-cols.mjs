import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

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

async function run() {
  const dbUrl = loadDbUrl()
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  const slots = []
  // Left Wing: s=0, rows=6, cols=4
  // xStart: 6, xEnd: 42 (step = 12: 6, 18, 30, 42)
  // yStart: 26, yEnd: 88 (step = 12.4: 26, 38.4, 50.8, 63.2, 75.6, 88)
  const yVals = [26, 38, 51, 63, 76, 88]
  const leftXVals = [6, 18, 30, 42]
  const rightXVals = [58, 70, 82, 94]

  let pcNum = 1
  // Left: Rows A..F
  const leftRows = ['A', 'B', 'C', 'D', 'E', 'F']
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const pcLabel = `PC-${String(pcNum).padStart(2, '0')}`
      const posId = `${leftRows[r]}${c + 1}`
      await pool.query(
        `UPDATE public.workstations 
         SET pos_x = $1, pos_y = $2, position_id = $3, row_label = $4 
         WHERE lab_id = 'comp' AND label = $5`,
        [leftXVals[c], yVals[r], posId, `Row ${leftRows[r]} (Left)`, pcLabel]
      )
      pcNum++
    }
  }

  // Right: Rows G..L
  const rightRows = ['G', 'H', 'I', 'J', 'K', 'L']
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const pcLabel = `PC-${String(pcNum).padStart(2, '0')}`
      const posId = `${rightRows[r]}${c + 1}`
      await pool.query(
        `UPDATE public.workstations 
         SET pos_x = $1, pos_y = $2, position_id = $3, row_label = $4 
         WHERE lab_id = 'comp' AND label = $5`,
        [rightXVals[c], yVals[r], posId, `Row ${rightRows[r]} (Right)`, pcLabel]
      )
      pcNum++
    }
  }

  // Teacher Podium
  await pool.query(
    `UPDATE public.workstations 
     SET pos_x = 50, pos_y = 10, position_id = 'PODIUM', row_label = 'Teacher Podium' 
     WHERE lab_id = 'comp' AND label ILIKE '%teacher%'`
  )

  const check = await pool.query(`
    SELECT label, position_id, row_label, pos_x, pos_y 
    FROM public.workstations 
    WHERE lab_id = 'comp' AND is_active = true 
    ORDER BY label ASC
  `)
  console.log(`Updated ${check.rows.length} workstations:`)
  console.table(check.rows.slice(0, 10))
  console.table(check.rows.slice(24, 34))
  await pool.end()
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
