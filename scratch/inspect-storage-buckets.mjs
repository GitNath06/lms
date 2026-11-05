import pg from 'pg'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/)
const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } })

async function main() {
  try {
    const res = await pool.query('SELECT id, name, public, created_at FROM storage.buckets;')
    console.log('Buckets found:', res.rows)

    const studentsWithPhotos = await pool.query(
      `SELECT count(*) FROM public.students WHERE photo_url IS NOT NULL AND photo_url != '';`
    )
    console.log('Students with photo_url:', studentsWithPhotos.rows[0].count)

    const base64Students = await pool.query(
      `SELECT count(*) FROM public.students WHERE photo_url LIKE 'data:image%';`
    )
    console.log('Students with base64 photo_url:', base64Students.rows[0].count)

    const profilesWithPhotos = await pool.query(
      `SELECT count(*) FROM public.profiles WHERE avatar_url IS NOT NULL AND avatar_url != '';`
    )
    console.log('Profiles with avatar_url:', profilesWithPhotos.rows[0].count)

    const base64Profiles = await pool.query(
      `SELECT count(*) FROM public.profiles WHERE avatar_url LIKE 'data:image%';`
    )
    console.log('Profiles with base64 avatar_url:', base64Profiles.rows[0].count)

    const incidentsWithPhotos = await pool.query(
      `SELECT count(*) FROM public.lab_incidents WHERE photo_url IS NOT NULL AND photo_url != '';`
    )
    console.log('Incidents with photo_url:', incidentsWithPhotos.rows[0].count)

    const base64Incidents = await pool.query(
      `SELECT count(*) FROM public.lab_incidents WHERE photo_url LIKE 'data:image%';`
    )
    console.log('Incidents with base64 photo_url:', base64Incidents.rows[0].count)
    const storageStats = await pool.query(`
      SELECT 
        bucket_id,
        count(*) as total_files,
        round(sum((metadata->>'size')::numeric) / 1024.0, 2) as total_size_kb,
        round(sum((metadata->>'size')::numeric) / (1024.0 * 1024.0), 4) as total_size_mb,
        round(sum((metadata->>'size')::numeric) / (1024.0 * 1024.0 * 1024.0), 6) as total_size_gb
      FROM storage.objects
      GROUP BY bucket_id;
    `)
    console.log('\n--- Live Supabase Storage Objects Summary ---')
    console.table(storageStats.rows)

    const sampleFiles = await pool.query(`
      SELECT bucket_id, name, (metadata->>'mimetype') as mimetype, (metadata->>'size')::numeric as size_bytes, created_at
      FROM storage.objects
      ORDER BY created_at DESC
      LIMIT 10;
    `)
    console.log('\n--- 10 Most Recent Uploaded Files in Storage ---')
    console.table(sampleFiles.rows)
  } catch (err) {
    console.error('Error querying storage and photo counts:', err)
  } finally {
    await pool.end()
  }
}

main()

