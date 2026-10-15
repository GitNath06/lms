import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const envPath = path.resolve(process.cwd(), '.env.local')
const content = fs.readFileSync(envPath, 'utf8')
const dbUrl = content.split('\n').find(l => l.startsWith('DATABASE_URL=')).split('=')[1].trim().replace(/^['"]|['"]$/g, '')

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function fixPolicies() {
  const client = await pool.connect()
  try {
    console.log('Updating workstation and issue_categories read policies to public/anon/authenticated read...')
    await client.query(`
      DROP POLICY IF EXISTS "Allow read workstations" ON public.workstations;
      CREATE POLICY "Allow read workstations" ON public.workstations FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Allow read categories" ON public.issue_categories;
      CREATE POLICY "Allow read categories" ON public.issue_categories FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Allow read floor elements" ON public.lab_floor_elements;
      CREATE POLICY "Allow read floor elements" ON public.lab_floor_elements FOR SELECT USING (true);
    `)
    console.log('✓ Successfully updated read policies on workstations, categories, and floor elements to USING (true)!')
  } finally {
    client.release()
    await pool.end()
  }
}

fixPolicies()
