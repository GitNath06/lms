import fs from 'node:fs'
import path from 'node:path'

const filePath = path.resolve('lib/master-data.ts')
const content = fs.readFileSync(filePath, 'utf8')

// Extract MASTER_ROUTINE block
const start = content.indexOf('export const MASTER_ROUTINE: MasterRoutineItem[] = [')
const end = content.indexOf('export const RECENT_LOGS:', start)
const routineText = content.slice(start, end)

const items = []
const regex = /id:\s*'([^']+)',[\s\S]*?subjectCode:\s*'([^']+)',[\s\S]*?subjectTitle:\s*'([^']+)',[\s\S]*?grade:\s*'([^']+)',[\s\S]*?teacher:\s*'([^']+)',[\s\S]*?labKey:\s*'([^']+)'/g

let m
while ((m = regex.exec(routineText)) !== null) {
  items.push({
    id: m[1],
    subjectCode: m[2],
    subjectTitle: m[3],
    grade: m[4],
    teacher: m[5],
    labKey: m[6]
  })
}

console.log('Total Master Routine items parsed:', items.length)

const uniqueSubjects = new Map()
for (const it of items) {
  const key = it.subjectCode
  if (!uniqueSubjects.has(key)) {
    uniqueSubjects.set(key, {
      code: it.subjectCode,
      title: it.subjectTitle,
      grade: it.grade,
      teacher: it.teacher,
      labKey: it.labKey
    })
  }
}

console.log('Unique Subjects in Routine:', JSON.stringify(Array.from(uniqueSubjects.values()), null, 2))
