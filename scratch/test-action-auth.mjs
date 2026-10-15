import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
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
}

const { assignStudentToSeat, swapStudents, clearSeatAssignment, autoAssignRemainingSeats, createSessionSeatOverride } = await import('../app/actions/seat-plans.ts')

console.log('Testing server action rejection without privileged session...')
const assignRes = await assignStudentToSeat({
  lab_id: 'comp',
  academic_year_id: '2083',
  class_id: '12eng',
  workstation_id: '00000000-0000-0000-0000-000000000000',
  enrollment_id: '00000000-0000-0000-0000-000000000000',
})
console.log('assignStudentToSeat result:', assignRes)

const swapRes = await swapStudents({
  lab_id: 'comp',
  academic_year_id: '2083',
  class_id: '12eng',
  workstation_id_a: '00000000-0000-0000-0000-000000000000',
  workstation_id_b: '11111111-1111-1111-1111-111111111111',
})
console.log('swapStudents result:', swapRes)

const clearRes = await clearSeatAssignment('00000000-0000-0000-0000-000000000000')
console.log('clearSeatAssignment result:', clearRes)

const autoRes = await autoAssignRemainingSeats({
  lab_id: 'comp',
  academic_year_id: '2083',
  class_id: '12eng',
})
console.log('autoAssignRemainingSeats result:', autoRes)

const overrideRes = await createSessionSeatOverride({
  session_date: '2026-09-24',
  enrollment_id: '00000000-0000-0000-0000-000000000000',
  workstation_id: '00000000-0000-0000-0000-000000000000',
  reason: 'Test reason',
})
console.log('createSessionSeatOverride result:', overrideRes)
