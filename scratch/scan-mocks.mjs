import fs from 'node:fs'
import path from 'node:path'

const targetDirs = ['app', 'components', 'hooks', 'lib']
const patterns = [
  'Rajesh Sharma',
  'Prakash Adhikari',
  'Nirmala Poudel',
  'Anish Karki',
  'Sunita Thapa',
  'Science Department',
  'All 38 workstations functioning properly'
]

function scan(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scan(full)
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        patterns.forEach(pat => {
          if (line.includes(pat)) {
            console.log(`${full}:${idx + 1} [${pat}] -> ${line.trim()}`)
          }
        })
      })
    }
  }
}

targetDirs.forEach(d => {
  if (fs.existsSync(d)) scan(d)
})
