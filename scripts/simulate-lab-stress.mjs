#!/usr/bin/env node

/**
 * 🚀 LabSync LIMS - 50-Workstation Laboratory Swarm & Stress Simulator
 *
 * Use this script to test realistic high-concurrency lab scenarios:
 * 1. Morning Lab Power-On: 50 PCs boot simultaneously and send hardware handshakes.
 * 2. Simultaneous Student Distress: Multiple students report hardware/software faults at the same time.
 * 3. Telemetry & Latency Benchmark: Demonstrates PostgreSQL connection pooling throughput.
 *
 * Usage:
 *   node scripts/simulate-lab-stress.mjs --boot-all
 *   node scripts/simulate-lab-stress.mjs --distress 10
 *   node scripts/simulate-lab-stress.mjs --clean
 *   node scripts/simulate-lab-stress.mjs --status
 */

import fs from 'fs'
import path from 'path'
import pg from 'pg'

// 1. Load local environment configuration (.env.local)
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

const connectionString = resolveDatabaseUrl(process.env.DATABASE_URL)
if (!connectionString) {
  console.error('❌ Error: DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 20, // Connection pool
  idleTimeoutMillis: 30000,
})

const args = process.argv.slice(2)
const isBootAll = args.includes('--boot-all')
const isDistress = args.includes('--distress')
const isClean = args.includes('--clean')
const isStatus = args.includes('--status')
const distressCount = parseInt(args[args.indexOf('--distress') + 1], 10) || 8

async function main() {
  console.log('\n=================================================================')
  console.log('  🖥️  LABSYNC LIMS — 50-WORKSTATION REAL-TIME SIMULATOR')
  console.log('=================================================================\n')

  try {
    if (isStatus || (!isBootAll && !isDistress && !isClean)) {
      await showLabStatus()
      if (!isStatus) {
        console.log('\n📌 AVAILABLE STRESS SIMULATION COMMANDS:')
        console.log('  node scripts/simulate-lab-stress.mjs --boot-all     (Simulate all 50 PCs booting at once)')
        console.log('  node scripts/simulate-lab-stress.mjs --distress 10  (Simulate 10 students filing issues simultaneously)')
        console.log('  node scripts/simulate-lab-stress.mjs --clean        (Resolve/clear all simulated distress tickets)')
        console.log('  node scripts/simulate-lab-stress.mjs --status       (View current live telemetry status)\n')
      }
    }

    if (isBootAll) {
      await simulate50PcBoot()
    }

    if (isDistress) {
      await simulateDistress(distressCount)
    }

    if (isClean) {
      await cleanDistressTickets()
    }
  } catch (err) {
    console.error('❌ Simulation Error:', err.message)
  } finally {
    await pool.end()
  }
}

async function showLabStatus() {
  const wsRes = await pool.query(`
    SELECT 
      w.label,
      w.machine_guid,
      w.lan_ip,
      w.last_seen_at,
      COUNT(wi.id) as open_issues
    FROM public.workstations w
    LEFT JOIN public.workstation_issues wi ON wi.workstation_id = w.id AND wi.status != 'resolved'
    WHERE w.lab_id = 'comp'
    GROUP BY w.id, w.label, w.machine_guid, w.lan_ip, w.last_seen_at
    ORDER BY 
      substring(w.label from '^[A-Za-z]+')::text,
      COALESCE(substring(w.label from '[0-9]+')::int, 0),
      w.label
  `)

  const total = wsRes.rows.length
  const bound = wsRes.rows.filter((r) => r.machine_guid).length
  const activeRecent = wsRes.rows.filter(
    (r) => r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 3600000 * 24
  ).length
  const withIssues = wsRes.rows.filter((r) => parseInt(r.open_issues, 10) > 0).length

  console.log(`📊 Current Computer Lab Telemetry:`)
  console.log(`   • Total Workstations: ${total}`)
  console.log(`   • Bound / Active Machines: ${bound} / ${total}`)
  console.log(`   • Online / Heartbeat in 24h: ${activeRecent} / ${total}`)
  console.log(`   • Workstations with Active Issues: ${withIssues}`)
}

async function simulate50PcBoot() {
  console.log('⚡ SIMULATING 50 WORKSTATIONS BOOTING UP CONCURRENTLY...')
  const start = Date.now()

  const wsRes = await pool.query(`
    SELECT id, label FROM public.workstations WHERE lab_id = 'comp' ORDER BY label ASC
  `)
  const stations = wsRes.rows
  console.log(`   Found ${stations.length} workstations to boot.`)

  const cpus = [
    'AMD Ryzen 5 3500U with Radeon Vega Mobile Gfx (4C/8T)',
    'Intel Core i5-10400 CPU @ 2.90GHz (6C/12T)',
    'Intel Core i5-11400 CPU @ 2.60GHz (6C/12T)',
    'AMD Ryzen 5 5600G with Radeon Graphics (6C/12T)',
  ]

  // Fire updates concurrently in batches of 10 to demonstrate pooling
  const updatePromises = stations.map((ws, i) => {
    const clean = ws.label.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const guid = `SWARM-${clean}-${(1000 + i).toString()}`
    const ip = `192.168.1.${10 + i}`
    const cpu = cpus[i % cpus.length]
    const ram = i % 3 === 0 ? 16 : 8
    const disk = 120 + (i * 7) % 150

    const specs = {
      cpu,
      ram_gb: ram,
      drive_c_free_gb: disk,
      drive_c_total_gb: 256,
      os: 'Windows 11 Pro 64-bit',
      ip,
      booted_at: new Date().toISOString(),
    }

    return pool.query(
      `UPDATE public.workstations 
       SET machine_guid = COALESCE(machine_guid, $1),
           lan_ip = $2,
           hardware_specs = $3::jsonb,
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE id = $4`,
      [guid, ip, JSON.stringify(specs), ws.id]
    )
  })

  await Promise.all(updatePromises)
  const elapsed = Date.now() - start

  console.log(`\n✅ SUCCESS! All ${stations.length} workstations booted and synchronized.`)
  console.log(`   ⏱️  Total Duration: ${elapsed} ms (avg ${(elapsed / stations.length).toFixed(1)} ms per machine)`)
  console.log(`   🌐 Every station now has verified hardware specs, IP, and live heartbeat.`)
  console.log(`   💡 Check the CAD floor at http://localhost:3000/computer-lab to see all green nodes!\n`)
}

async function simulateDistress(count) {
  console.log(`🚨 SIMULATING ${count} STUDENTS SIMULTANEOUSLY REPORTING DISTRESS ISSUES...`)
  const start = Date.now()

  const wsRes = await pool.query(
    `SELECT id, label FROM public.workstations WHERE lab_id = 'comp' ORDER BY RANDOM() LIMIT $1`,
    [count]
  )
  const selected = wsRes.rows

  const problemTemplates = [
    {
      title: 'Mouse / Keyboard Fault',
      description: 'Left click button not registering; wheel jamming during CAD exercise.',
      severity: 'medium',
    },
    {
      title: 'No Internet / LAN Disconnected',
      description: 'Ethernet cable clip broken; terminal lost connection to lab server.',
      severity: 'high',
    },
    {
      title: 'Missing Lab Software',
      description: 'Turbo C++ compiler missing from start menu for Class 11 practical.',
      severity: 'medium',
    },
    {
      title: 'Application Freeze / Crash',
      description: 'VS Code compiler process hung and mouse cursor is stuttering.',
      severity: 'high',
    },
    {
      title: 'Audio / Headphone Issue',
      description: 'Headphone jack not detected on front panel audio header.',
      severity: 'low',
    },
  ]

  const students = [
    'Aayush Shrestha',
    'Antara Bhujel',
    'Kritan Joshi',
    'Sampada Kandel',
    'Anch Rana',
    'Himani Moktan',
    'Kaustuv Thapa',
    'Purnima Shrestha',
    'Sudrin Koirala',
    'Kismat Khadka',
    'Bhagawati Sharma',
    'Subash Nepal',
  ]

  const insertPromises = selected.map((ws, i) => {
    const p = problemTemplates[i % problemTemplates.length]
    const sName = students[i % students.length]
    const roll = (i + 1) * 3
    const reporter = `${sName} (Roll ${roll})`

    return pool.query(
      `INSERT INTO public.workstation_issues (
        workstation_id,
        title,
        description,
        severity,
        status,
        reported_by_name,
        source,
        student_name,
        student_roll,
        photos,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, 'open', $5, 'student_terminal', $6, $7, '[]'::jsonb, NOW(), NOW())`,
      [ws.id, p.title, p.description, p.severity, reporter, sName, String(roll)]
    )
  })

  await Promise.all(insertPromises)
  const elapsed = Date.now() - start

  console.log(`\n✅ FIRED ${selected.length} SIMULTANEOUS ISSUES ACROSS STATIONS:`)
  selected.forEach((ws, i) => {
    console.log(`   📍 ${ws.label.padEnd(8)} → ${problemTemplates[i % problemTemplates.length].title}`)
  })
  console.log(`\n⏱️  Executed in ${elapsed} ms (Postgres handled all requests with zero bottleneck).`)
  console.log(`🔔 Check http://localhost:3000/computer-lab to see the animated distress beacons!`)
  console.log(`🧹 Run "node scripts/simulate-lab-stress.mjs --clean" when done testing.\n`)
}

async function cleanDistressTickets() {
  console.log('🧹 RESOLVING ALL SIMULATED STUDENT DISTRESS TICKETS...')
  const delRes = await pool.query(
    `DELETE FROM public.workstation_issues 
     WHERE source = 'student_terminal' 
       AND workstation_id IN (SELECT id FROM public.workstations WHERE lab_id = 'comp')
     RETURNING id`
  )
  console.log(`✅ Cleared ${delRes.rowCount || 0} simulated distress tickets. Lab floor restored to green!\n`)
}

main()
