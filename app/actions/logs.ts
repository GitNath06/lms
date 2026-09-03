'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'

type PracticalLogInsert = Database['public']['Tables']['practical_logs']['Insert']
type PracticalLogUpdate = Database['public']['Tables']['practical_logs']['Update']
type LabRow = Database['public']['Tables']['labs']['Row']

declare global {
  var __PRACTICAL_LOGS_STORE__: any[] | undefined
}

const SEED_PRACTICAL_LOGS = [
  {
    id: 'log-seed-1',
    schedule_id: 'mon-1',
    lab_id: 'comp',
    teacher_id: 't1',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 1 & 2 (10:10 - 11:45)',
    subject_name: 'COMP-12 - Data Structures & Algorithms Lab',
    batch_group: '12C - Tech Stream Sec A',
    practical_title: 'Implementation of Binary Search Trees in C++',
    total_students: 38,
    present_students: 36,
    absent_students: 2,
    remarks: 'All 38 workstations functioning properly. Students completed traversal exercises.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Binary Search Trees & Traversal',
    logged_by: 'local-admin',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    labs: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
    profiles: { id: 't1', full_name: 'Dr. Rajesh Sharma' },
  },
  {
    id: 'log-seed-2',
    schedule_id: 'mon-2',
    lab_id: 'phys',
    teacher_id: 't2',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 3 & 4 (11:45 - 01:15)',
    subject_name: 'PHY-11 - Optics & Wave Mechanics',
    batch_group: '11 Sc - Science Stream Sec B',
    practical_title: 'Verification of Hooke’s Law and Spring Constant Calculation',
    total_students: 40,
    present_students: 38,
    absent_students: 2,
    remarks: 'Weights and spring sets verified. High student engagement.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Hooke’s Law & Spring Oscillations',
    logged_by: 'local-admin',
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    labs: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
    profiles: { id: 't2', full_name: 'Dr. Prakash Adhikari' },
  },
]

function getStore(): any[] {
  if (!globalThis.__PRACTICAL_LOGS_STORE__) {
    globalThis.__PRACTICAL_LOGS_STORE__ = [...SEED_PRACTICAL_LOGS]
  }
  return globalThis.__PRACTICAL_LOGS_STORE__
}

const LAB_NAME_MAP: Record<string, { id: string; name: string; type: string }> = {
  comp: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
  phys: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
  chem: { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab' },
  bio: { id: 'bio', name: 'Biology & Life Sciences Lab', type: 'biology_lab' },
  elec: { id: 'elec', name: 'Electronics & Hardware Lab', type: 'electronics_lab' },
}

const TEACHER_NAME_MAP: Record<string, string> = {
  t1: 'Dr. Rajesh Sharma',
  t2: 'Dr. Prakash Adhikari',
  t3: 'Ms. Sunita Thapa',
  t4: 'Er. Anish Karki',
  t5: 'Dr. Nirmala Poudel',
}

export async function createPracticalLog(
  data: FormData | any
): Promise<{ success: boolean; log?: any; error?: string }> {
  let logPayload: any

  if (data instanceof FormData) {
    const total = parseInt(data.get('total_students') as string, 10) || 0
    let present = parseInt(data.get('present_students') as string, 10) || 0
    // Strict clamp: present cannot exceed total
    present = Math.min(total, Math.max(0, present))
    const absent = Math.max(0, total - present)

    logPayload = {
      lab_id: (data.get('lab_id') as string) || 'comp',
      teacher_id: (data.get('teacher_id') as string) || 't1',
      date: (data.get('date') as string) || new Date().toISOString().split('T')[0],
      period_label: (data.get('period_label') as string) || 'Period 1 (10:10 - 11:00)',
      subject_name: (data.get('subject_name') as string) || 'Practical Session',
      batch_group: (data.get('batch_group') as string) || '12C',
      practical_title: (data.get('practical_title') as string) || 'Experiment Entry',
      total_students: total,
      present_students: present,
      absent_students: absent,
      remarks: (data.get('remarks') as string) || null,
      status: 'conducted',
      logged_by: 'faculty',
    }
  } else {
    const total = data.total_students || data.totalStudents || 0
    let present = data.present_students || data.presentStudents || 0
    present = Math.min(total, Math.max(0, present))
    const absent = Math.max(0, total - present)

    logPayload = {
      schedule_id: data.schedule_id || data.sessionId || null,
      lab_id: data.lab_id || data.labKey || data.lab || 'comp',
      teacher_id: data.teacher_id || 't1',
      date: data.date || new Date().toISOString().split('T')[0],
      period_label: data.period_label || data.timeSlot || 'Period 1',
      subject_name: data.subject_name || data.subjectTitle || data.subjectCode || 'Practical Session',
      batch_group: data.batch_group || data.grade || '12C',
      practical_title: data.practical_title || data.topicLearned || 'Laboratory Practical Experiment',
      total_students: total,
      present_students: present,
      absent_students: absent,
      remarks: data.remarks || null,
      status: data.status || 'conducted',
      skip_reason: data.skip_reason || data.skipReason || null,
      topic_learned: data.topic_learned || data.topicLearned || null,
      logged_by: 'faculty',
    }
  }

  const labKey = logPayload.lab_id.toLowerCase().includes('comp')
    ? 'comp'
    : logPayload.lab_id.toLowerCase().includes('phys')
    ? 'phys'
    : logPayload.lab_id.toLowerCase().includes('chem')
    ? 'chem'
    : logPayload.lab_id.toLowerCase().includes('bio')
    ? 'bio'
    : 'elec'

  const labInfo = LAB_NAME_MAP[labKey] || {
    id: logPayload.lab_id,
    name: logPayload.lab_id,
    type: 'laboratory',
  }

  const teacherName =
    TEACHER_NAME_MAP[logPayload.teacher_id] || logPayload.teacher_id || 'Faculty Member'

  const newLogRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...logPayload,
    created_at: new Date().toISOString(),
    labs: labInfo,
    profiles: { id: logPayload.teacher_id, full_name: teacherName },
  }

  // Prepend to persistent memory store
  const store = getStore()
  store.unshift(newLogRecord)

  // Try to also write to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()
      await (supabase.from('practical_logs') as any).insert({
        ...logPayload,
        logged_by: userData.user?.id || null,
      })
    } catch (err) {
      console.warn('Supabase log insert skipped (fallback active):', err)
    }
  }

  revalidatePath('/logs')
  revalidatePath('/print/daily-log')
  revalidatePath('/')

  return { success: true, log: newLogRecord }
}

export async function updatePracticalLog(id: string, data: Partial<PracticalLogUpdate>) {
  const store = getStore()
  const idx = store.findIndex((l) => l.id === id)
  if (idx !== -1) {
    store[idx] = { ...store[idx], ...data, updated_at: new Date().toISOString() }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await (supabase.from('practical_logs') as any).update(data).eq('id', id)
    } catch (e) {}
  }

  revalidatePath('/logs')
  revalidatePath('/print/daily-log')
  revalidatePath('/')

  return { success: true }
}

export async function getPracticalLogs(filters?: {
  search?: string
  lab_id?: string
  date?: string
}) {
  const store = getStore()
  let list = [...store]

  if (filters?.lab_id && filters.lab_id !== 'all') {
    const target = filters.lab_id.toLowerCase()
    list = list.filter(
      (l) =>
        l.lab_id.toLowerCase().includes(target) ||
        (l.labs?.id && l.labs.id.toLowerCase().includes(target)) ||
        (l.labs?.name && l.labs.name.toLowerCase().includes(target))
    )
  }

  if (filters?.date) {
    list = list.filter((l) => l.date === filters.date)
  }

  if (filters?.search && filters.search.trim().length > 0) {
    const q = filters.search.toLowerCase()
    list = list.filter(
      (l) =>
        l.subject_name.toLowerCase().includes(q) ||
        l.practical_title.toLowerCase().includes(q) ||
        l.batch_group.toLowerCase().includes(q)
    )
  }

  // If Supabase is configured, try querying remote logs
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      let query = supabase
        .from('practical_logs')
        .select(`*, labs (id, name, type), profiles (id, full_name)`)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.lab_id && filters.lab_id !== 'all') {
        query = query.eq('lab_id', filters.lab_id)
      }
      if (filters?.date) {
        query = query.eq('date', filters.date)
      }
      if (filters?.search && filters.search.trim().length > 0) {
        const cleanSearch = filters.search.trim().replace(/[%_]/g, '')
        query = query.or(
          `subject_name.ilike.%${cleanSearch}%,practical_title.ilike.%${cleanSearch}%,batch_group.ilike.%${cleanSearch}%`
        )
      }

      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data as any[]
      }
    } catch (e) {}
  }

  return list
}

export async function getTodayLogStats(dateStr?: string) {
  const store = getStore()
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  const todayList = store.filter((l) => l.date === targetDate)

  const conducted = todayList.filter((l) => l.status !== 'skipped')
  const totalStudents = conducted.reduce((acc, curr) => acc + (curr.present_students || 0), 0)

  return {
    totalLogsToday: todayList.length,
    totalStudentsAttended: totalStudents,
    conductedCount: conducted.length,
    skippedCount: todayList.length - conducted.length,
    logs: todayList,
  }
}

export async function deletePracticalLog(id: string) {
  const store = getStore()
  const initialLen = store.length
  globalThis.__PRACTICAL_LOGS_STORE__ = store.filter((l) => l.id !== id)

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.from('practical_logs').delete().eq('id', id)
    } catch (e) {}
  }

  revalidatePath('/logs')
  revalidatePath('/print/daily-log')
  revalidatePath('/')

  return { success: true }
}

export async function getActiveLabs(): Promise<LabRow[]> {
  const defaultLabs: LabRow[] = [
    { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab', capacity: 40, is_active: true },
    { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab', capacity: 38, is_active: true },
    { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab', capacity: 40, is_active: true },
    { id: 'bio', name: 'Biology & Life Sciences Lab', type: 'biology_lab', capacity: 35, is_active: true },
    { id: 'elec', name: 'Electronics & Hardware Lab', type: 'electronics_lab', capacity: 30, is_active: true },
  ]

  if (!isSupabaseConfigured()) {
    return defaultLabs
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('labs')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error || !data || data.length === 0) {
      return defaultLabs
    }

    return data as LabRow[]
  } catch (e) {
    return defaultLabs
  }
}

export async function getTeachers() {
  const defaultTeachers = [
    { id: 't1', full_name: 'Dr. Rajesh Sharma (Computer Science)' },
    { id: 't2', full_name: 'Dr. Prakash Adhikari (Physics)' },
    { id: 't3', full_name: 'Ms. Sunita Thapa (Chemistry)' },
    { id: 't4', full_name: 'Er. Anish Karki (Electronics)' },
    { id: 't5', full_name: 'Dr. Nirmala Poudel (Biology)' },
  ]

  if (!isSupabaseConfigured()) {
    return defaultTeachers
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')

    if (error || !data || data.length === 0) {
      return defaultTeachers
    }

    return (data as any[]) || defaultTeachers
  } catch (e) {
    return defaultTeachers
  }
}
