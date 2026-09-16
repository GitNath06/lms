'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_HOLIDAYS, HolidayItem } from '@/lib/master-data'

let cachedHolidays: { data: HolidayItem[]; timestamp: number } | null = null

export async function getAcademicHolidays(): Promise<HolidayItem[]> {
  if (cachedHolidays && Date.now() - cachedHolidays.timestamp < 300000) {
    return cachedHolidays.data
  }

  if (!isSupabaseConfigured()) {
    return DEFAULT_HOLIDAYS
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('academic_holidays')
      .select('*')
      .order('date_start', { ascending: true })

    if (error || !data || data.length === 0) {
      return DEFAULT_HOLIDAYS
    }

    const mapped = data.map((row: any) => ({
      id: row.id,
      title: row.title,
      name: row.name || row.title,
      titleNp: row.title_np,
      dateStr: row.date_start,
      endDateStr: row.date_end || row.date_start,
      bsDateStr: row.bs_date_str,
      type: row.holiday_type || 'cultural',
      description: row.description,
    }))

    cachedHolidays = { data: mapped, timestamp: Date.now() }
    return mapped
  } catch (err) {
    console.warn('[LMR] Failed to fetch academic holidays from Supabase, using default fallback:', err)
    return DEFAULT_HOLIDAYS
  }
}

export async function addAcademicHoliday(
  holiday: HolidayItem
): Promise<{ success: boolean; holiday?: HolidayItem; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true, holiday }
  }

  try {
    const supabase = await createClient()
    const { error } = await (supabase.from('academic_holidays') as any).upsert({
      id: holiday.id,
      title: holiday.title,
      name: holiday.name || holiday.title,
      title_np: holiday.titleNp || null,
      date_start: holiday.dateStr,
      date_end: holiday.endDateStr || holiday.dateStr,
      bs_date_str: holiday.bsDateStr || null,
      holiday_type: holiday.type || 'cultural',
      description: holiday.description || null,
      practicals_suspended: true,
      is_national: holiday.type === 'state' || holiday.type === 'cultural',
    }, { onConflict: 'date_start,title' })

    if (error) {
      console.error('❌ Failed to insert academic holiday:', error)
      return { success: false, error: error.message }
    }

    cachedHolidays = null
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true, holiday }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function updateAcademicHoliday(
  id: string,
  updates: Partial<HolidayItem>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true }
  }

  try {
    const supabase = await createClient()
    const payload: any = {}
    if (updates.title) payload.title = updates.title
    if (updates.name) payload.name = updates.name
    if (updates.titleNp) payload.title_np = updates.titleNp
    if (updates.dateStr) payload.date_start = updates.dateStr
    if (updates.endDateStr) payload.date_end = updates.endDateStr
    if (updates.bsDateStr) payload.bs_date_str = updates.bsDateStr
    if (updates.type) payload.holiday_type = updates.type
    if (updates.description) payload.description = updates.description

    const { error } = await (supabase.from('academic_holidays') as any)
      .update(payload)
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    cachedHolidays = null
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function deleteAcademicHoliday(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('academic_holidays')
      .delete()
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    cachedHolidays = null
    revalidatePath('/schedules')
    revalidatePath('/admin')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
