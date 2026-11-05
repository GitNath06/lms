import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import fs from 'fs'
import { parseBase64Image, uploadImageToStorage } from '../lib/storage/supabase-storage.ts'

const env = fs.readFileSync('.env.local', 'utf8')
const match = env.match(/DATABASE_URL=["']?([^"'\r\n]+)/)

test('Storage & Streaming Export Suite', async (t) => {
  await t.test('1. parseBase64Image extracts buffer and mimeType accurately', () => {
    const webpDataUrl = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
    const parsedWebp = parseBase64Image(webpDataUrl)
    assert.ok(parsedWebp, 'Parsed WebP result should not be null')
    assert.equal(parsedWebp.mimeType, 'image/webp')
    assert.ok(Buffer.isBuffer(parsedWebp.buffer))

    const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/'
    const parsedJpeg = parseBase64Image(jpegDataUrl)
    assert.ok(parsedJpeg, 'Parsed JPEG result should not be null')
    assert.equal(parsedJpeg.mimeType, 'image/jpeg')
    assert.ok(Buffer.isBuffer(parsedJpeg.buffer))

    assert.equal(parseBase64Image(''), null)
    assert.equal(parseBase64Image(null), null)
  })

  await t.test('2. uploadImageToStorage returns existing HTTP URLs without re-uploading', async () => {
    const existingUrl = 'https://ygnhtwdsioeuybmlrvgj.supabase.co/storage/v1/object/public/avatars/students/test-123.webp'
    const result = await uploadImageToStorage({
      bucket: 'avatars',
      path: 'students/test-123.webp',
      imageData: existingUrl,
    })
    assert.equal(result, existingUrl)
  })

  await t.test('3. uploadImageToStorage falls back gracefully on storage failure without throwing', async () => {
    const mockClient = {
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: new Error('Network error') }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    }

    const base64 = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
    const result = await uploadImageToStorage({
      bucket: 'avatars',
      path: 'students/test-fail.webp',
      imageData: base64,
      supabaseClient: mockClient,
    })

    assert.equal(result, base64, 'Should return original string on failure as safe fallback')
  })

  await t.test('4. Live PostgreSQL database contains ZERO Base64 image records', async () => {
    if (!match) return

    const pool = new pg.Pool({ connectionString: match[1], ssl: { rejectUnauthorized: false } })
    const client = await pool.connect()

    try {
      const studentBase64 = (
        await client.query(`SELECT count(*) FROM public.students WHERE photo_url LIKE 'data:image%';`)
      ).rows[0].count

      const profileBase64 = (
        await client.query(
          `SELECT count(*) FROM public.profiles WHERE avatar_url LIKE 'data:image%' OR photo_url LIKE 'data:image%';`
        )
      ).rows[0].count

      const incidentBase64 = (
        await client.query(`SELECT count(*) FROM public.lab_incidents WHERE photo_url LIKE 'data:image%';`)
      ).rows[0].count

      assert.equal(studentBase64, '0', 'students.photo_url must contain 0 Base64 strings')
      assert.equal(profileBase64, '0', 'profiles.avatar_url must contain 0 Base64 strings')
      assert.equal(incidentBase64, '0', 'lab_incidents.photo_url must contain 0 Base64 strings')

      const sampleStudent = await client.query(
        `SELECT photo_url FROM public.students WHERE photo_url IS NOT NULL AND photo_url != '' LIMIT 1;`
      )
      if (sampleStudent.rows.length > 0) {
        assert.ok(
          sampleStudent.rows[0].photo_url.startsWith('https://'),
          `Student photo_url should start with https://, got: ${sampleStudent.rows[0].photo_url}`
        )
      }
    } finally {
      client.release()
      await pool.end()
    }
  })
})
