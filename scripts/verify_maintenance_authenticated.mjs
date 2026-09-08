import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    let v = trimmed.slice(eqIdx + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

async function verify() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345',
  })

  if (error) {
    console.error('Sign-in error:', error.message)
    process.exit(1)
  }

  console.log('✓ Signed in as:', data.user.email)
  const session = data.session

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const cookieVal = encodeURIComponent(JSON.stringify(session))
  const cookieHeader = `${cookieName}=${cookieVal}; ${cookieName}.0=${encodeURIComponent(
    JSON.stringify(session)
  )}`

  // 1. Verify /maintenance
  console.log('\n--- 1. Testing /maintenance (Authenticated) ---')
  const maintRes = await fetch('http://localhost:3000/maintenance', {
    headers: { Cookie: cookieHeader },
  })
  const maintHtml = await maintRes.text()
  console.log('/maintenance status:', maintRes.status)
  console.log('Has "Lab Maintenance":', maintHtml.includes('Lab Maintenance'))
  console.log('Has "Computer & Science Labs":', maintHtml.includes('Computer &amp; Science Labs') || maintHtml.includes('Computer & Science Labs'))
  console.log('Has "Lab Maintenance Status Matrix":', maintHtml.includes('Lab Maintenance Status Matrix'))
  console.log('Has "Pinned Maintenance Reminders":', maintHtml.includes('Pinned Maintenance Reminders'))
  console.log('Has "Lab Maintenance & Servicing Records":', maintHtml.includes('Lab Maintenance &amp; Servicing Records') || maintHtml.includes('Lab Maintenance & Servicing Records'))
  console.log('Has Sidebar "Lab Maintenance":', maintHtml.includes('Lab Maintenance'))
  console.log('Has NO "Total Care Expense":', !maintHtml.includes('TOTAL CARE EXPENSE') && !maintHtml.includes('Total Care Expense'))
  console.log('Has NO "Apparatus Servicing":', !maintHtml.includes('Apparatus Servicing'))

  // 2. Verify /print/maintenance
  console.log('\n--- 2. Testing /print/maintenance (Authenticated) ---')
  const printRes = await fetch('http://localhost:3000/print/maintenance', {
    headers: { Cookie: cookieHeader },
  })
  const printHtml = await printRes.text()
  console.log('/print/maintenance status:', printRes.status)
  console.log('Has Official Letterhead:', printHtml.includes('RATNA RAJYA LAXMI'))
  console.log('Has Official Title:', printHtml.includes('Lab Maintenance'))
  console.log('Has 3-Tier Signatures:')
  console.log('  - Laboratory In-Charge:', printHtml.includes('Laboratory In-Charge'))
  console.log('  - Academic Coordinator:', printHtml.includes('Academic Coordinator'))
  console.log('  - Campus Chief / Principal:', printHtml.includes('Campus Chief / Principal'))
}

verify()
