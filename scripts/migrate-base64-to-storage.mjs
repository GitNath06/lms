import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// 1. Read environment config
const env = fs.readFileSync('.env.local', 'utf8')
const dbMatch = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/)
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\r\n]+)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=["']?([^"'\r\n]+)/)

if (!dbMatch || !urlMatch || !keyMatch) {
  throw new Error('Missing environment configuration in .env.local')
}

const DATABASE_URL = dbMatch[1]
const SUPABASE_URL = urlMatch[1]
const SUPABASE_KEY = keyMatch[1]

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function parseBase64(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return {
      mimeType: match[1].toLowerCase(),
      buffer: Buffer.from(match[2], 'base64'),
    }
  }
  try {
    return {
      mimeType: 'image/webp',
      buffer: Buffer.from(dataUrl, 'base64'),
    }
  } catch {
    return null
  }
}

async function runMigration() {
  console.log('='.repeat(70))
  console.log('--- Phase 3: Safe Base64-to-Supabase Storage Migration ---')
  console.log('='.repeat(70))

  const client = await pool.connect()

  try {
    // -------------------------------------------------------------
    // Step 1: Scan and Backup All Existing Base64 Records
    // -------------------------------------------------------------
    console.log('\n[1/5] Scanning PostgreSQL for existing Base64 images...')

    const studentRows = (
      await client.query(
        `SELECT id, admission_no, full_name, photo_url FROM public.students WHERE photo_url LIKE 'data:image%';`
      )
    ).rows

    const profileRows = (
      await client.query(
        `SELECT id, email, full_name, avatar_url, photo_url FROM public.profiles WHERE avatar_url LIKE 'data:image%' OR photo_url LIKE 'data:image%';`
      )
    ).rows

    const incidentRows = (
      await client.query(
        `SELECT id, title, lab_id, photo_url FROM public.lab_incidents WHERE photo_url LIKE 'data:image%';`
      )
    ).rows

    console.log(`Found:
  - Students with Base64: ${studentRows.length}
  - Staff Profiles with Base64: ${profileRows.length}
  - Incident Reports with Base64: ${incidentRows.length}
  Total records to migrate: ${studentRows.length + profileRows.length + incidentRows.length}`)

    const backupData = {
      timestamp: new Date().toISOString(),
      studentPhotos: studentRows,
      profilePhotos: profileRows,
      incidentPhotos: incidentRows,
    }

    const backupDir = path.resolve(process.cwd(), 'scratch')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
    const backupFilePath = path.join(backupDir, 'backup-base64-photos.json')
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8')
    console.log(`\n[2/5] ✅ Complete backup written to: ${backupFilePath}`)

    // -------------------------------------------------------------
    // Step 2: Authenticate Supabase SDK with Super Admin Account
    // -------------------------------------------------------------
    console.log('\n[3/5] Authenticating Supabase Storage Client...')
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'admin@rrl.edu.np',
      password: 'Admin@12345',
    })

    if (authErr || !authData.session) {
      throw new Error(`Supabase Admin authentication failed: ${authErr?.message}`)
    }
    console.log('✅ Storage client authenticated as Super Admin:', authData.user?.email)

    // -------------------------------------------------------------
    // Step 3: Migrate Student Avatars
    // -------------------------------------------------------------
    console.log('\n[4/5] Migrating student avatars to "avatars/students/"...')
    let studentMigrated = 0

    for (const student of studentRows) {
      const parsed = parseBase64(student.photo_url)
      if (!parsed) {
        console.warn(`  ⚠️ Skipping student ${student.admission_no} (${student.id}): invalid base64 data.`)
        continue
      }

      const storagePath = `students/${student.id}.webp`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(storagePath, parsed.buffer, {
        contentType: parsed.mimeType.includes('png') ? 'image/png' : 'image/webp',
        upsert: true,
      })

      if (uploadErr) {
        console.error(`  ❌ Failed uploading student ${student.id}:`, uploadErr.message)
        continue
      }

      const cdnUrl = supabase.storage.from('avatars').getPublicUrl(storagePath).data.publicUrl
      await client.query(`UPDATE public.students SET photo_url = $1, updated_at = NOW() WHERE id = $2;`, [
        cdnUrl,
        student.id,
      ])

      studentMigrated++
      console.log(`  ✓ Student ${student.admission_no} (${student.full_name}) -> CDN URL saved.`)
    }

    // -------------------------------------------------------------
    // Step 4: Migrate Staff Profile Avatars
    // -------------------------------------------------------------
    console.log('\nMigrating staff profile avatars to "avatars/profiles/"...')
    let profileMigrated = 0

    for (const profile of profileRows) {
      const photoSrc = profile.avatar_url || profile.photo_url
      const parsed = parseBase64(photoSrc)
      if (!parsed) {
        console.warn(`  ⚠️ Skipping profile ${profile.email}: invalid base64 data.`)
        continue
      }

      const storagePath = `profiles/${profile.id}.webp`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(storagePath, parsed.buffer, {
        contentType: parsed.mimeType.includes('png') ? 'image/png' : 'image/webp',
        upsert: true,
      })

      if (uploadErr) {
        console.error(`  ❌ Failed uploading profile ${profile.id}:`, uploadErr.message)
        continue
      }

      const cdnUrl = supabase.storage.from('avatars').getPublicUrl(storagePath).data.publicUrl
      await client.query(
        `UPDATE public.profiles SET photo_url = $1, avatar_url = $1 WHERE id = $2;`,
        [cdnUrl, profile.id]
      )

      profileMigrated++
      console.log(`  ✓ Profile ${profile.email} (${profile.full_name}) -> CDN URL saved.`)
    }

    // -------------------------------------------------------------
    // Step 5: Migrate Incident Photos
    // -------------------------------------------------------------
    console.log('\nMigrating incident photos to "incident-photos/incidents/"...')
    let incidentMigrated = 0

    for (const incident of incidentRows) {
      const parsed = parseBase64(incident.photo_url)
      if (!parsed) {
        console.warn(`  ⚠️ Skipping incident ${incident.id}: invalid base64 data.`)
        continue
      }

      const storagePath = `incidents/${incident.id}.webp`
      const { error: uploadErr } = await supabase.storage
        .from('incident-photos')
        .upload(storagePath, parsed.buffer, {
          contentType: parsed.mimeType.includes('png') ? 'image/png' : 'image/webp',
          upsert: true,
        })

      if (uploadErr) {
        console.error(`  ❌ Failed uploading incident ${incident.id}:`, uploadErr.message)
        continue
      }

      const cdnUrl = supabase.storage.from('incident-photos').getPublicUrl(storagePath).data.publicUrl
      await client.query(`UPDATE public.lab_incidents SET photo_url = $1 WHERE id = $2;`, [
        cdnUrl,
        incident.id,
      ])

      incidentMigrated++
      console.log(`  ✓ Incident ${incident.id} (${incident.title}) -> CDN URL saved.`)
    }

    // -------------------------------------------------------------
    // Verification & Final Database Telemetry
    // -------------------------------------------------------------
    console.log('\n[5/5] --- Verification Telemetry ---')
    const remainingStudents = (
      await client.query(`SELECT count(*) FROM public.students WHERE photo_url LIKE 'data:image%';`)
    ).rows[0].count

    const remainingProfiles = (
      await client.query(
        `SELECT count(*) FROM public.profiles WHERE avatar_url LIKE 'data:image%' OR photo_url LIKE 'data:image%';`
      )
    ).rows[0].count

    const remainingIncidents = (
      await client.query(`SELECT count(*) FROM public.lab_incidents WHERE photo_url LIKE 'data:image%';`)
    ).rows[0].count

    console.log(`Remaining Base64 in PostgreSQL:
  - Students: ${remainingStudents} (Expected: 0)
  - Profiles: ${remainingProfiles} (Expected: 0)
  - Incidents: ${remainingIncidents} (Expected: 0)`)

    console.log(`
Migration Summary:
  - Student photos successfully moved: ${studentMigrated}/${studentRows.length}
  - Profile photos successfully moved: ${profileMigrated}/${profileRows.length}
  - Incident photos successfully moved: ${incidentMigrated}/${incidentRows.length}
  - Total moved to Supabase Storage: ${studentMigrated + profileMigrated + incidentMigrated}`)

    if (remainingStudents === '0' && remainingProfiles === '0' && remainingIncidents === '0') {
      console.log('\n🎉 SUCCESS: All Base64 images have been completely purged from PostgreSQL!')
    } else {
      console.warn('\n⚠️ Note: Some records still retain Base64 data. Review errors above.')
    }
  } catch (err) {
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
