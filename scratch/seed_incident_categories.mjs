import fs from 'node:fs'
import { getPgPool } from '../lib/db.ts'

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
} catch (e) {}

const ADDITIONAL_LAB_CATEGORIES = [
  {
    name: 'Equipment / Glassware Breakage',
    type: 'hardware',
    icon: 'AlertTriangle',
    color: '#EF4444',
    default_severity: 'medium',
    sort_order: 11,
  },
  {
    name: 'Equipment Fault / Malfunction',
    type: 'hardware',
    icon: 'AlertCircle',
    color: '#F59E0B',
    default_severity: 'low',
    sort_order: 12,
  },
  {
    name: 'Burnt Component / Circuit Short',
    type: 'hardware',
    icon: 'Flame',
    color: '#DC2626',
    default_severity: 'high',
    sort_order: 13,
  },
  {
    name: 'Chemical Spill / Acid Hazard',
    type: 'other',
    icon: 'Biohazard',
    color: '#7C3AED',
    default_severity: 'critical',
    sort_order: 14,
  },
  {
    name: 'Missing / Unreturned Equipment',
    type: 'other',
    icon: 'HelpCircle',
    color: '#6366F1',
    default_severity: 'low',
    sort_order: 15,
  },
  {
    name: 'Safety Hazard / Physical Injury',
    type: 'other',
    icon: 'ShieldAlert',
    color: '#B91C1C',
    default_severity: 'critical',
    sort_order: 16,
  },
]

async function seed() {
  const pool = getPgPool()
  try {
    console.log('Checking existing categories in public.issue_categories...')
    const existing = await pool.query('SELECT name FROM public.issue_categories;')
    const existingNames = new Set(existing.rows.map((r) => r.name.toLowerCase().trim()))

    for (const cat of ADDITIONAL_LAB_CATEGORIES) {
      if (!existingNames.has(cat.name.toLowerCase().trim())) {
        await pool.query(
          `INSERT INTO public.issue_categories (name, type, color, icon, default_severity, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, true, $6);`,
          [cat.name, cat.type, cat.color, cat.icon, cat.default_severity, cat.sort_order]
        )
        console.log(`+ Added category: ${cat.name}`)
      } else {
        console.log(`- Already exists: ${cat.name}`)
      }
    }

    const total = await pool.query('SELECT count(*)::int AS count FROM public.issue_categories;')
    console.log(`Total categories in public.issue_categories: ${total.rows[0].count}`)
  } catch (err) {
    console.error('Error:', err)
  } finally {
    process.exit(0)
  }
}

seed()
