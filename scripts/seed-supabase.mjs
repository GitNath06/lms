import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Parse .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (let line of lines) {
    let trimmed = line.trim()
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      trimmed = trimmed.slice(1, -1).trim()
    }
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    let v = trimmed.slice(eqIdx + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) {
      process.env[k] = v
    }
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / PUBLISHABLE_KEY in .env')
  process.exit(1)
}

console.log('📡 Connecting to Supabase project at:', supabaseUrl)
const supabase = createClient(supabaseUrl, supabaseKey)

const DEFAULT_LABS = [
  { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01', type: 'computer_lab', capacity: 40 },
  { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01', type: 'physics_lab', capacity: 38 },
  { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01', type: 'chemistry_lab', capacity: 40 },
  { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01', type: 'biology_lab', capacity: 35 },
  { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01', type: 'electronics_lab', capacity: 30 },
]

const DEFAULT_CALENDAR_SETTINGS = {
  id: 'default',
  start_day: 'sun',
  sunday_weekend: false,
  saturday_weekend: true,
  academic_year: '2083',
}

async function runSeed() {
  console.log('\n--- 1. Testing Connection & Checking Tables ---')
  const { data: testLabs, error: testError } = await supabase.from('labs').select('id').limit(1)

  if (testError) {
    console.error('⚠️ Could not query "labs" table:')
    console.error('Code:', testError.code, '| Message:', testError.message)
    console.log('\n📋 REQUIRED STEP:')
    console.log('Your Supabase database tables have not been created yet in PostgreSQL.')
    console.log('To create all tables, policies, and initial records:')
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/xysdrtbomtqgqtiojcev')
    console.log('2. Click on the "SQL Editor" tab (icon with >_ on the left menu).')
    console.log('3. Open the file "supabase/schema.sql" in this project, copy all its content.')
    console.log('4. Paste into the Supabase SQL Editor and click "RUN".')
    console.log('5. Once executed, all tables, security policies, and initial records are ready!\n')
    return false
  }

  console.log('✅ Connected! Tables exist. Starting seed...')

  // 1. Seed Labs
  console.log('\n--- 2. Seeding Labs ---')
  for (const lab of DEFAULT_LABS) {
    const { error } = await supabase.from('labs').upsert(lab, { onConflict: 'id' })
    if (error) {
      console.warn(`⚠️ Warning seeding lab ${lab.id}:`, error.message)
    } else {
      console.log(`✓ Lab seeded: ${lab.name} (${lab.id})`)
    }
  }

  // 2. Seed Calendar Settings
  console.log('\n--- 3. Seeding Calendar Settings ---')
  const { error: calError } = await supabase.from('calendar_settings').upsert(DEFAULT_CALENDAR_SETTINGS, { onConflict: 'id' })
  if (calError) {
    console.warn('⚠️ Warning seeding calendar settings:', calError.message)
  } else {
    console.log('✓ Calendar settings seeded: Academic Year 2083 B.S., Start Day: Sunday')
  }

  console.log('\n🎉 Supabase seeding complete!')
  return true
}

runSeed().catch((err) => {
  console.error('Fatal error during seed:', err)
  process.exit(1)
})
