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

async function testSupabaseWorkstations() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('workstations').select('*').eq('lab_id', 'comp')
  console.log('Workstations count via Supabase client:', data?.length)
  console.log('Error if any:', error)
}

testSupabaseWorkstations()
