import fs from 'node:fs'
import path from 'node:path'

process.env.NODE_ENV = 'test'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim()
      const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      process.env[k] = v
    }
  }
}

const { createClient } = await import('../lib/supabase/server.ts')

async function testQuery() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workstation_seat_plans')
    .select(`
      id,
      workstation_id,
      enrollment_id,
      notes,
      student_enrollments!inner (
        id,
        roll_number,
        student_id,
        students!inner (
          id,
          full_name
        )
      )
    `)
    .eq('lab_id', 'comp')
    .eq('academic_year_id', '2083')
    .eq('class_id', '12eng')

  console.log('Query result count:', data?.length)
  console.log('Error if any:', error)
  if (data && data.length > 0) {
    console.log('Sample row:', JSON.stringify(data[0], null, 2))
  }
}

testQuery()
