import test from 'node:test'
import assert from 'node:assert/strict'

test('Navigation Safety & Open-Redirect Protection Suite', async (t) => {
  // Simulating the BackButton resolution logic:
  function resolveBackDestination(fromParam, historyLength, fallbackHref = '/records') {
    if (fromParam && fromParam.startsWith('/') && !fromParam.startsWith('//')) {
      return { action: 'push', destination: fromParam }
    } else if (historyLength > 2) {
      return { action: 'back' }
    } else {
      return { action: 'push', destination: fallbackHref }
    }
  }

  await t.test('Respects legitimate internal from parameter', () => {
    const res = resolveBackDestination('/records?view=compact', 1, '/records')
    assert.deepEqual(res, { action: 'push', destination: '/records?view=compact' })
  })

  await t.test('Rejects malicious protocol-relative open-redirect URLs', () => {
    // //evil.com must not be treated as a valid internal path
    const res = resolveBackDestination('//evil.com', 1, '/records')
    assert.deepEqual(res, { action: 'push', destination: '/records' })
  })

  await t.test('Rejects external URLs passed via from parameter', () => {
    const res = resolveBackDestination('https://phishing.site', 1, '/records')
    assert.deepEqual(res, { action: 'push', destination: '/records' })
  })

  await t.test('Invokes router.back() when history length > 2 and no from param', () => {
    const res = resolveBackDestination(null, 3, '/records')
    assert.deepEqual(res, { action: 'back' })
  })

  await t.test('Safely falls back to fallbackHref when history <= 2 (direct bookmark/link access)', () => {
    const res = resolveBackDestination(null, 1, '/records')
    assert.deepEqual(res, { action: 'push', destination: '/records' })
  })
})

test('Supabase Storage Bucket & Attachment Constraint Suite', async (t) => {
  const BUCKET_CONFIG = {
    bucketName: 'incident-attachments',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 5242880, // 5MB post-compression ceiling
  }

  function validateUploadConstraint(mimeType, sizeBytes) {
    if (!BUCKET_CONFIG.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid MIME type: ${mimeType}`)
    }
    if (sizeBytes > BUCKET_CONFIG.fileSizeLimit) {
      throw new Error(`File size ${sizeBytes} exceeds limit of ${BUCKET_CONFIG.fileSizeLimit}`)
    }
    return true
  }

  function generateScopedStoragePath(incidentId, uuid) {
    assert.match(incidentId, /^[a-zA-Z0-9_-]+$/, 'Incident ID must be alphanumeric')
    assert.match(uuid, /^[a-f0-9-]+$/, 'Must be valid UUID')
    return `${incidentId}/${uuid}.jpg`
  }

  await t.test('Enforces allowed MIME types (JPEG, PNG, WebP)', () => {
    assert.ok(validateUploadConstraint('image/jpeg', 1024 * 500))
    assert.ok(validateUploadConstraint('image/png', 1024 * 500))
    assert.ok(validateUploadConstraint('image/webp', 1024 * 500))
    assert.throws(() => validateUploadConstraint('application/pdf', 1024))
    assert.throws(() => validateUploadConstraint('application/x-msdownload', 1024))
  })

  await t.test('Enforces 5MB file size ceiling', () => {
    assert.ok(validateUploadConstraint('image/jpeg', 5 * 1024 * 1024))
    assert.throws(() => validateUploadConstraint('image/jpeg', 5 * 1024 * 1024 + 1))
  })

  await t.test('Generates secure scoped folder path scoped to incidentId', () => {
    const path = generateScopedStoragePath('inc-12345', 'e3b0c442-98fc-1c14-9afb-4c760667c5e3')
    assert.equal(path, 'inc-12345/e3b0c442-98fc-1c14-9afb-4c760667c5e3.jpg')
  })
})
