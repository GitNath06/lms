import fs from 'node:fs'

const filePath = 'd:/Projects/LMR/app/actions/logs.ts'
let content = fs.readFileSync(filePath, 'utf8')

// 1. Purge SEED_PRACTICAL_LOGS & getStore
const startSeed = 'const SEED_PRACTICAL_LOGS = ['
const endSeed = 'const LAB_NAME_MAP: Record<string, { id: string; name: string; type: string }> = {'

const seedIdx = content.indexOf(startSeed)
const labMapIdx = content.indexOf(endSeed)

if (seedIdx === -1 || labMapIdx === -1) {
  console.error('Could not find seed markers in logs.ts', { seedIdx, labMapIdx })
  process.exit(1)
}

const cleanStoreFunc = `function getStore(): any[] {
  if (!globalThis.__PRACTICAL_LOGS_STORE__) {
    globalThis.__PRACTICAL_LOGS_STORE__ = []
  }
  return globalThis.__PRACTICAL_LOGS_STORE__
}

`

content = content.slice(0, seedIdx) + cleanStoreFunc + content.slice(labMapIdx)

// 2. Remove TEACHER_NAME_MAP
const teacherMapStart = 'const TEACHER_NAME_MAP: Record<string, string> = {'
const teacherMapEnd = 'export async function createPracticalLog('
const tMapStartIdx = content.indexOf(teacherMapStart)
const tMapEndIdx = content.indexOf(teacherMapEnd)

if (tMapStartIdx !== -1 && tMapEndIdx !== -1) {
  content = content.slice(0, tMapStartIdx) + content.slice(tMapEndIdx)
}

// 3. Remove Period 1 and teacher fallbacks in FormData block
content = content.replace(
  "teacher_id: (data.get('teacher_id') as string) || 't1',",
  "teacher_id: (data.get('teacher_id') as string) || null,"
)
content = content.replace(
  "period_label: (data.get('period_label') as string) || 'Period 1 (10:10 - 11:00)',",
  "period_label: (data.get('period_label') as string) || '',"
)

// 4. Remove Period 1 and teacher fallbacks in Object block
content = content.replace(
  "teacher_id: data.teacher_id || 't1',",
  "teacher_id: data.teacher_id || null,"
)
content = content.replace(
  "period_label: data.period_label || data.timeSlot || 'Period 1',",
  "period_label: data.period_label || data.timeSlot || '',"
)

// 5. Replace TEACHER_NAME_MAP lookup
content = content.replace(
  "TEACHER_NAME_MAP[logPayload.teacher_id] || (data.teacher as string) || 'Assigned Subject Teacher'",
  "(data.teacher as string) || (data.teacher_name as string) || 'Assigned Subject Teacher'"
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated logs.ts!')
