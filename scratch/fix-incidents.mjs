import fs from 'node:fs'

const filePath = 'd:/Projects/LMR/app/actions/incidents.ts'
let content = fs.readFileSync(filePath, 'utf8')

const startMarker = 'const IN_MEMORY_INCIDENTS: LabIncidentRecord[] = ['
const endMarker = 'declare global {'

const startIdx = content.indexOf(startMarker)
const endIdx = content.indexOf(endMarker)

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers in incidents.ts', { startIdx, endIdx })
  process.exit(1)
}

const clean = `const IN_MEMORY_INCIDENTS: LabIncidentRecord[] = []
const IN_MEMORY_NOTIFICATIONS: LabNotificationRecord[] = []

`

content = content.slice(0, startIdx) + clean + content.slice(endIdx)
fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated incidents.ts!')
