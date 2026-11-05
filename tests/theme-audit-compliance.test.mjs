import { test } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const FORBIDDEN_UNPREFIXED = [
  'bg-[#0B0F19]',
  'bg-[#101726]',
  'bg-[#151E32]',
  'bg-[#070A12]',
]

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walkDir(fullPath, fileList)
      }
    } else if (file.endsWith('.tsx')) {
      fileList.push(fullPath)
    }
  }
  return fileList
}

test('Theme Audit Compliance: Zero un-prefixed dark hex backgrounds in components/ and app/', () => {
  const root = process.cwd()
  const filesToScan = [
    ...walkDir(path.join(root, 'components')),
    ...walkDir(path.join(root, 'app')),
  ]

  const violations = []

  for (const filePath of filesToScan) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    lines.forEach((line, idx) => {
      const lineNum = idx + 1

      // Check 1: Option with bg-[#101726]
      if (line.includes('<option') && line.includes('bg-[#101726]')) {
        violations.push({
          file: path.relative(root, filePath),
          line: lineNum,
          type: 'OPTION_DARK_BG',
          detail: line.trim(),
        })
      }

      // Check 2: Unprefixed dark hex backgrounds
      for (const pattern of FORBIDDEN_UNPREFIXED) {
        let searchIndex = 0
        while ((searchIndex = line.indexOf(pattern, searchIndex)) !== -1) {
          // Check if preceded immediately by "dark:" or a dark pseudo-variant chain (e.g. dark:hover:, dark:focus:, dark:group-hover:)
          const beforeStr = line.slice(0, searchIndex)
          const isDarkPrefixed = /(?:^|[\s"'`\[\]{}()])dark:(?:[a-z0-9\-]+:)*$/.test(beforeStr)

          if (!isDarkPrefixed) {
            violations.push({
              file: path.relative(root, filePath),
              line: lineNum,
              type: 'UNPREFIXED_DARK_BG',
              pattern,
              detail: line.trim(),
            })
          }
          searchIndex += pattern.length
        }
      }
    })
  }

  if (violations.length > 0) {
    console.error(`\n❌ Found ${violations.length} theme compliance violations:`)
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} [${v.type}] ${v.pattern || ''} -> ${v.detail}`)
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `Found ${violations.length} theme compliance violations across components/ and app/`
  )
})
