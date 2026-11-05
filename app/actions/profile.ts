'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { invalidateUserProfileCache } from '@/app/actions/auth'
import { uploadProfilePhotoToStorage } from '@/lib/storage/supabase-storage'

export async function updateTeacherProfile(payload: {
  full_name: string
  phone?: string | null
  honorific?: string | null
  bio?: string | null
  teaching_preferences?: Record<string, any> | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized: Session not found.' }
    }

    const trimmedName = payload.full_name?.trim()
    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters long.' }
    }

    const pool = getPgPool()
    await pool.query(
      `
      UPDATE public.profiles
      SET
        full_name = $1,
        phone = $2,
        honorific = $3,
        bio = $4,
        teaching_preferences = $5
      WHERE id = $6
    `,
      [
        trimmedName,
        payload.phone?.trim() || null,
        payload.honorific?.trim() || null,
        payload.bio?.trim() || null,
        JSON.stringify(payload.teaching_preferences || {}),
        user.id,
      ]
    )

    await invalidateUserProfileCache(user.id)
    revalidatePath('/profile')
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err: any) {
    console.error('Error updating profile:', err)
    return { success: false, error: err.message || 'Failed to update profile.' }
  }
}

export async function updateTeacherAvatar(
  base64OrBuffer: string
): Promise<{ success: boolean; photo_url?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized: Session not found.' }
    }

    let publicUrl: string | null = null
    if (base64OrBuffer && base64OrBuffer.trim().length > 0) {
      publicUrl = await uploadProfilePhotoToStorage(user.id, base64OrBuffer)
    }

    const pool = getPgPool()
    await pool.query(
      `
      UPDATE public.profiles
      SET photo_url = $1, avatar_url = $1
      WHERE id = $2
    `,
      [publicUrl, user.id]
    )

    await invalidateUserProfileCache(user.id)
    revalidatePath('/profile')
    revalidatePath('/', 'layout')

    return { success: true, photo_url: publicUrl || undefined }
  } catch (err: any) {
    console.error('Error updating avatar:', err)
    return { success: false, error: err.message || 'Failed to update photo.' }
  }
}
