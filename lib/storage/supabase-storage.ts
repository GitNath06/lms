import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Utility to parse a data URL or raw Base64 string into a Buffer and MIME type.
 */
export function parseBase64Image(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null

  // Match standard Data URL: data:image/webp;base64,AAAA...
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    const mimeType = match[1].toLowerCase()
    const buffer = Buffer.from(match[2], 'base64')
    return { buffer, mimeType }
  }

  // If raw base64 string without data prefix
  try {
    const buffer = Buffer.from(dataUrl, 'base64')
    return { buffer, mimeType: 'image/webp' }
  } catch {
    return null
  }
}

/**
 * Uploads an image buffer or base64 string to a specified Supabase Storage bucket.
 * Returns the permanent public CDN URL on success, or the original input on failure/fallback.
 */
export async function uploadImageToStorage(params: {
  bucket: 'avatars' | 'incident-photos'
  path: string
  imageData: string | Buffer
  supabaseClient?: SupabaseClient
}): Promise<string> {
  const { bucket, path, imageData } = params

  // 1. If it's already an external or CDN HTTP URL, return as-is
  if (typeof imageData === 'string') {
    const trimmed = imageData.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed
    }
  }

  // 2. Extract binary buffer and MIME type
  let buffer: Buffer
  let mimeType = 'image/webp'

  if (Buffer.isBuffer(imageData)) {
    buffer = imageData
  } else {
    const parsed = parseBase64Image(imageData)
    if (!parsed) {
      console.warn(`[storage] Invalid base64 image data for path "${path}". Returning original string.`)
      return imageData
    }
    buffer = parsed.buffer
    mimeType = parsed.mimeType
  }

  // Normalize extension according to MIME
  let contentType = 'image/webp'
  if (mimeType.includes('png')) contentType = 'image/png'
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) contentType = 'image/jpeg'

  try {
    // 3. Resolve Supabase Client (custom passed client or server cookies client)
    const supabase = params.supabaseClient || (await createClient())

    // 4. Upload to storage bucket with upsert = true
    const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    })

    if (error) {
      console.error(`[storage] Failed to upload image to bucket "${bucket}" at "${path}":`, error.message)
      // Return original input as safe fallback to ensure zero data loss
      return typeof imageData === 'string' ? imageData : ''
    }

    // 5. Retrieve and return permanent public CDN URL
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
    return publicData.publicUrl
  } catch (err) {
    console.error(`[storage] Unexpected error uploading to "${bucket}/${path}":`, err)
    return typeof imageData === 'string' ? imageData : ''
  }
}

/**
 * Uploads a student avatar to avatars/students/{studentId}.webp
 */
export async function uploadStudentPhotoToStorage(
  studentId: string,
  photoData: string | Buffer,
  client?: SupabaseClient
): Promise<string> {
  return uploadImageToStorage({
    bucket: 'avatars',
    path: `students/${studentId}.webp`,
    imageData: photoData,
    supabaseClient: client,
  })
}

/**
 * Uploads a staff/user profile avatar to avatars/profiles/{userId}.webp
 */
export async function uploadProfilePhotoToStorage(
  userId: string,
  photoData: string | Buffer,
  client?: SupabaseClient
): Promise<string> {
  return uploadImageToStorage({
    bucket: 'avatars',
    path: `profiles/${userId}.webp`,
    imageData: photoData,
    supabaseClient: client,
  })
}

/**
 * Uploads a laboratory incident photo to incident-photos/incidents/{incidentId}.webp
 */
export async function uploadIncidentPhotoToStorage(
  incidentId: string,
  photoData: string | Buffer,
  client?: SupabaseClient
): Promise<string> {
  return uploadImageToStorage({
    bucket: 'incident-photos',
    path: `incidents/${incidentId}.webp`,
    imageData: photoData,
    supabaseClient: client,
  })
}

/**
 * Safely removes a file from storage if present.
 */
export async function deleteImageFromStorage(
  bucket: 'avatars' | 'incident-photos',
  path: string,
  client?: SupabaseClient
): Promise<boolean> {
  try {
    const supabase = client || (await createClient())
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (error) {
      console.warn(`[storage] Could not delete "${bucket}/${path}":`, error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[storage] Failed to remove "${bucket}/${path}":`, err)
    return false
  }
}
