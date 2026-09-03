'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getSchedules } from './schedules'

export interface FacultySubstitutionRecord {
  id: string
  schedule_id?: string | null
  date: string // YYYY-MM-DD
  slot_id: string
  lab_id: string
  original_teacher_id: string
  original_teacher_name: string
  substitute_teacher_id: string
  substitute_teacher_name: string
  reason?: string | null
  status: 'assigned' | 'completed' | 'cancelled'
  created_at?: string
}

const IN_MEMORY_SUBSTITUTIONS: FacultySubstitutionRecord[] = []

function getSubStore(): FacultySubstitutionRecord[] {
  if (!(globalThis as any).__FACULTY_SUBSTITUTIONS__) {
    ;(globalThis as any).__FACULTY_SUBSTITUTIONS__ = [...IN_MEMORY_SUBSTITUTIONS]
  }
  return (globalThis as any).__FACULTY_SUBSTITUTIONS__
}

export async function assignSubstitute(data: {
  id?: string
  schedule_id?: string | null
  date: string
  slot_id: string
  lab_id: string
  original_teacher_id: string
  original_teacher_name: string
  substitute_teacher_id: string
  substitute_teacher_name: string
  reason?: string
}): Promise<{ success: boolean; substitution?: FacultySubstitutionRecord; error?: string }> {
  try {
    // 1. COLLISION ENGINE: Verify substitute teacher isn't double-booked in another lab
    const allSchedules = await getSchedules()
    const targetSlotId = data.slot_id
    
    // Check if substitute teacher is already occupied in a scheduled lab during this slot
    const conflictingSchedule = allSchedules.find((s: any) => {
      const teacherMatches =
        s.teacher_id === data.substitute_teacher_id ||
        s.metadata?.teacher?.toLowerCase() === data.substitute_teacher_name.toLowerCase()
      if (!teacherMatches) return false

      // Check slot overlap (accounting for span)
      const slotNum = parseInt(s.slot_id?.replace('t', '') || '0', 10)
      const targetNum = parseInt(targetSlotId?.replace('t', '') || '0', 10)
      const span = s.span || 1
      return targetNum >= slotNum && targetNum < slotNum + span
    })

    if (conflictingSchedule) {
      return {
        success: false,
        error: `Conflict: ${data.substitute_teacher_name} is already teaching "${conflictingSchedule.subject_name}" (${conflictingSchedule.batch_name}) during this period.`,
      }
    }

    const recordId = data.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const record: FacultySubstitutionRecord = {
      id: recordId,
      schedule_id: data.schedule_id || null,
      date: data.date,
      slot_id: data.slot_id,
      lab_id: data.lab_id,
      original_teacher_id: data.original_teacher_id,
      original_teacher_name: data.original_teacher_name,
      substitute_teacher_id: data.substitute_teacher_id,
      substitute_teacher_name: data.substitute_teacher_name,
      reason: data.reason || 'Official Proxy Duty',
      status: 'assigned',
      created_at: new Date().toISOString(),
    }

    const store = getSubStore()
    const existingIdx = store.findIndex((s) => s.id === recordId)
    if (existingIdx !== -1) {
      store[existingIdx] = record
    } else {
      store.unshift(record)
    }

    // Write to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        const { error: dbError } = await (supabase.from('faculty_substitutions') as any).upsert(
          {
            id: record.id,
            schedule_id: record.schedule_id,
            date: record.date,
            slot_id: record.slot_id,
            lab_id: record.lab_id,
            original_teacher_id: record.original_teacher_id,
            original_teacher_name: record.original_teacher_name,
            substitute_teacher_id: record.substitute_teacher_id,
            substitute_teacher_name: record.substitute_teacher_name,
            reason: record.reason,
            status: record.status,
          },
          { onConflict: 'id' }
        )

        if (dbError) {
          console.error('❌ Supabase substitution upsert error:', dbError)
        }
      } catch (err) {
        console.warn('Supabase substitution write skipped:', err)
      }
    }

    revalidatePath('/schedules')
    revalidatePath('/')

    return { success: true, substitution: record }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to assign substitute' }
  }
}

export async function getSubstitutions(filters?: {
  date?: string
  schedule_id?: string
  lab_id?: string
}): Promise<FacultySubstitutionRecord[]> {
  const store = getSubStore()
  let list = [...store]

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase.from('faculty_substitutions').select('*').order('date', { ascending: false })

      if (filters?.date) query = query.eq('date', filters.date)
      if (filters?.schedule_id) query = query.eq('schedule_id', filters.schedule_id)
      if (filters?.lab_id && filters.lab_id !== 'all') query = query.eq('lab_id', filters.lab_id)

      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data as FacultySubstitutionRecord[]
      }
    } catch (e) {}
  }

  if (filters?.date) {
    list = list.filter((s) => s.date === filters.date)
  }
  if (filters?.schedule_id) {
    list = list.filter((s) => s.schedule_id === filters.schedule_id)
  }
  if (filters?.lab_id && filters.lab_id !== 'all') {
    list = list.filter((s) => s.lab_id === filters.lab_id)
  }

  return list
}

export async function cancelSubstitution(id: string): Promise<{ success: boolean }> {
  const store = getSubStore()
  ;(globalThis as any).__FACULTY_SUBSTITUTIONS__ = store.filter((s) => s.id !== id)

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await (supabase.from('faculty_substitutions') as any).delete().eq('id', id)
    } catch (e) {}
  }

  revalidatePath('/schedules')
  revalidatePath('/')

  return { success: true }
}
