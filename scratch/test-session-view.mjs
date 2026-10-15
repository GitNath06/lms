import fs from 'node:fs'
import path from 'node:path'

process.env.NODE_ENV = 'test'

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

// Er. Anish Karki teacher profile (assigned to 9C and 10C)
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: '4911cee7-dae4-48a2-90de-9b039712de35',
  email: 'a.karki@rrl.edu.np',
  full_name: 'Er. Anish Karki',
  role: 'teacher',
  is_active: true,
  permissions: {},
})

const { getSessionSeatPlan, assignStudentToSeat } = await import('../app/actions/seat-plans.ts')

console.log('--- 1. Testing Teacher Er. Anish Karki viewing own 9C session ---')
const view9c = await getSessionSeatPlan({
  scheduleId: 'sched-9c-anish',
  sessionDate: '2026-09-24',
})
console.log('View 9C result:', view9c.success, view9c.data?.class_name, view9c.error)

console.log('--- 2. Testing Teacher Er. Anish Karki viewing own 10C session ---')
const view10c = await getSessionSeatPlan({
  scheduleId: 'sched-10c-anish',
  sessionDate: '2026-09-24',
})
console.log('View 10C result:', view10c.success, view10c.data?.class_name, view10c.data?.teacher_name)

console.log('--- 3. Testing Teacher Er. Anish Karki viewing Dr. Prakash Adhikari 12C session (UNAUTHORIZED) ---')
const view12c = await getSessionSeatPlan({
  scheduleId: 'sched-12c-prakash',
  sessionDate: '2026-09-24',
})
console.log('View 12C result:', view12c.success, view12c.error)

console.log('--- 4. Testing Teacher Er. Anish Karki trying to write a seat plan (UNAUTHORIZED) ---')
const writeRes = await assignStudentToSeat({
  lab_id: 'comp',
  academic_year_id: '2083',
  class_id: '9eng',
  workstation_id: '00000000-0000-0000-0000-000000000000',
  enrollment_id: '00000000-0000-0000-0000-000000000000',
})
console.log('Teacher write result:', writeRes.success, writeRes.error)

// Lab Incharge profile
process.env.TEST_USER_OVERRIDE = JSON.stringify({
  id: 'b7c832c9-4616-4eac-8402-2936caa1b948',
  email: 'incharge@rrl.edu.np',
  full_name: 'Dr. Rajesh Sharma',
  role: 'lab_incharge',
  is_active: true,
  permissions: {},
})

console.log('--- 5. Testing Lab Incharge viewing any session ---')
const inchargeView = await getSessionSeatPlan({
  scheduleId: 'sched-12c-prakash',
  sessionDate: '2026-09-24',
})
console.log('Incharge view result:', inchargeView.success, inchargeView.data?.class_name)
