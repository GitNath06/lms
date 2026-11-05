import fs from 'node:fs'

const filePath = 'd:/Projects/LMR/app/actions/records.ts'
let content = fs.readFileSync(filePath, 'utf8')

const startMarker = '// Fallback seed practical records'
const endMarker = 'function getPrintTokenStore(): Map<string, { ids: string[]; expiresAt: number }> {'

const startIdx = content.indexOf(startMarker)
const endIdx = content.indexOf(endMarker)

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers in records.ts', { startIdx, endIdx })
  process.exit(1)
}

const replacement = `declare global {
  var __PRACTICAL_RECORDS_STORE__: any[] | undefined
  var __INCIDENT_RECORDS_STORE__: any[] | undefined
  var __PRINT_SELECTION_TOKENS__: Map<string, { ids: string[]; expiresAt: number }> | undefined
}

function getPracticalStore(): any[] {
  if (!globalThis.__PRACTICAL_RECORDS_STORE__) {
    globalThis.__PRACTICAL_RECORDS_STORE__ = []
  }
  return globalThis.__PRACTICAL_RECORDS_STORE__
}

function getIncidentStore(): any[] {
  if (!globalThis.__INCIDENT_RECORDS_STORE__) {
    globalThis.__INCIDENT_RECORDS_STORE__ = []
  }
  return globalThis.__INCIDENT_RECORDS_STORE__
}

`

content = content.slice(0, startIdx) + replacement + content.slice(endIdx)
fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully updated records.ts!')
