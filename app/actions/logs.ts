'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { DEFAULT_HOLIDAYS, isDateWithinHoliday } from '@/lib/master-data'
import { getServerUserScope } from '@/lib/context/user-scope'
import { getTeacherAssignments } from '@/lib/context/institutional-relationships'
import { getPgPool } from '@/lib/db'
import { dispatchSkippedSessionNotification } from '@/app/actions/notifications'

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
): Promise<{ success: boolean; log?: any; error?: string; duplicateId?: string }> {
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
      logged_by: 'subject_teacher',
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
      logged_by: 'subject_teacher',
    }
  }

  // Reject practical log creation (both conducted and skipped) on institutional holidays
  const holiday = DEFAULT_HOLIDAYS.find((h) => isDateWithinHoliday(logPayload.date, h))
  if (holiday) {
    return {
      success: false,
      error: `Practical log rejected: ${logPayload.date} is an official institutional holiday (${holiday.title || holiday.name || 'Academic Recess'}). Practicals are automatically cancelled and no log entries (conducted or skipped) can be created.`,
    }
  }

  const safeLabId =
    logPayload.lab_id.toLowerCase().includes('comp')
      ? 'comp'
      : logPayload.lab_id.toLowerCase().includes('phys')
      ? 'phys'
      : logPayload.lab_id.toLowerCase().includes('chem')
      ? 'chem'
      : logPayload.lab_id.toLowerCase().includes('bio')
      ? 'bio'
      : logPayload.lab_id.toLowerCase().includes('elec')
      ? 'elec'
      : 'comp'

  const labInfo = LAB_NAME_MAP[safeLabId] || {
    id: safeLabId,
    name: 'Laboratory',
    type: 'laboratory',
  }

  // Server-side lab status check: block practical logging if Under Maintenance or Inactive
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: targetLab } = await (supabase
        .from('labs') as any)
        .select('id, name, status, is_active')
        .eq('id', safeLabId)
        .maybeSingle()

      if (targetLab) {
        if (targetLab.status === 'Under Maintenance') {
          return {
            success: false,
            error: `Practical log rejected: "${targetLab.name || safeLabId}" is currently Under Maintenance. Practical sessions cannot be conducted or logged in an offline facility.`,
          }
        }
        if (!targetLab.is_active || targetLab.status === 'Inactive') {
          return {
            success: false,
            error: `Practical log rejected: "${targetLab.name || safeLabId}" is currently Inactive / Decommissioned.`,
          }
        }
      }
    } catch (err) {
      console.warn('Error verifying lab status for practical log:', err)
    }
  }

  // ==========================================================================
  // 1. LOGICAL DUPLICATE CHECK: date + lab_id + period_label + batch_group + subject_name
  // ==========================================================================
  const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')
  const checkDate = logPayload.date
  const checkLab = safeLabId
  const checkPeriod = norm(logPayload.period_label)
  const checkBatch = norm(logPayload.batch_group)
  const checkSubject = norm(logPayload.subject_name)
  const isExplicitEdit = Boolean(data.id || (data.isEdit && data.existingLogId))
  const targetEditId = data.id || data.existingLogId

  // Check PostgreSQL DB for duplicates if configured
  if (process.env.DATABASE_URL) {
    try {
      const pool = getPgPool()
      const existingDbRows = await pool.query(
        `SELECT id, to_char(date, 'YYYY-MM-DD') as date, lab_id, period_label, batch_group, subject_name
         FROM public.practical_logs
         WHERE lab_id = $1;`,
        [checkLab]
      )

      if (existingDbRows.rows && existingDbRows.rows.length > 0) {
        const dbMatch = existingDbRows.rows.find((r) => {
          if (isExplicitEdit && r.id === targetEditId) return false
          return (
            r.date === checkDate &&
            norm(r.period_label) === checkPeriod &&
            norm(r.batch_group) === checkBatch &&
            norm(r.subject_name) === checkSubject
          )
        })

        if (dbMatch) {
          return {
            success: false,
            error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
            duplicateId: dbMatch.id,
          }
        }
      }
    } catch (err) {
      console.warn('Error querying PostgreSQL for duplicates:', err)
    }
  }

  // Check Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: existingDbRows } = await supabase
        .from('practical_logs')
        .select('id, date, lab_id, period_label, batch_group, subject_name')
        .eq('date', checkDate)
        .eq('lab_id', checkLab)

      if (existingDbRows && existingDbRows.length > 0) {
        const dbMatch = (existingDbRows as any[]).find((r) => {
          if (isExplicitEdit && r.id === targetEditId) return false
          return (
            norm(r.period_label) === checkPeriod &&
            norm(r.batch_group) === checkBatch &&
            norm(r.subject_name) === checkSubject
          )
        })

        if (dbMatch) {
          return {
            success: false,
            error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
            duplicateId: dbMatch.id,
          }
        }
      }
    } catch (err) {
      console.warn('Error querying DB for duplicates:', err)
    }
  }

  // Check persistent memory store
  const store = getStore()
  const storeMatch = store.find((l) => {
    if (isExplicitEdit && l.id === targetEditId) return false
    return (
      l.date === checkDate &&
      l.lab_id === checkLab &&
      norm(l.period_label) === checkPeriod &&
      norm(l.batch_group) === checkBatch &&
      norm(l.subject_name) === checkSubject
    )
  })

  if (storeMatch) {
    return {
      success: false,
      error: `A practical log already exists for ${logPayload.batch_group} · ${logPayload.subject_name} · ${logPayload.period_label} on ${logPayload.date}. Edit the existing entry instead of creating a duplicate.`,
      duplicateId: storeMatch.id,
    }
  }

  // ==========================================================================
  // 2. TEACHER IDENTITY RESOLUTION (Ensure valid profiles UUID)
  // ==========================================================================
  const isUUID = (str?: string | null) =>
    str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false

  let safeTeacherId = isUUID(logPayload.teacher_id) ? logPayload.teacher_id : null
  let teacherName =
    TEACHER_NAME_MAP[logPayload.teacher_id] || (data.teacher as string) || 'Assigned Subject Teacher'

  // If teacher_id is not already a UUID, resolve from profiles table by teacherName
  if (!safeTeacherId && isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const cleanName = teacherName.replace(/^(Er\.|Dr\.|Mr\.|Ms\.)\s*/i, '').trim()
      const { data: prof } = await (supabase.from('profiles') as any)
        .select('id, full_name')
        .ilike('full_name', `%${cleanName}%`)
        .limit(1)
        .maybeSingle()

      if (prof && (prof as any).id) {
        safeTeacherId = (prof as any).id
        teacherName = (prof as any).full_name || teacherName
      }
    } catch {}
  }

  const safeAbsentRolls = Array.isArray(data.absent_rolls || data.absentRolls)
    ? (data.absent_rolls || data.absentRolls)
        .map((r: any) => (typeof r === 'number' ? r : parseInt(String(r), 10)))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    : []

  const recordId = targetEditId || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  const newLogRecord = {
    id: recordId,
    ...logPayload,
    lab_id: safeLabId,
    teacher_id: safeTeacherId,
    absent_rolls: safeAbsentRolls,
    created_at: new Date().toISOString(),
    labs: labInfo,
    profiles: { id: safeTeacherId || 't1', full_name: teacherName },
  }

  // Prepend to persistent memory store
  const existingIdx = store.findIndex((l) => l.id === recordId)
  if (existingIdx !== -1) {
    store[existingIdx] = newLogRecord
  } else {
    store.unshift(newLogRecord)
  }

  // Try to also write to Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { data: userData } = await supabase.auth.getUser()
      const loggedBy = isUUID(userData.user?.id) ? userData.user?.id : null

      const { error: dbError } = await (supabase.from('practical_logs') as any).upsert(
        {
          id: recordId,
          schedule_id: logPayload.schedule_id || null,
          lab_id: safeLabId,
          teacher_id: safeTeacherId,
          date: logPayload.date,
          period_label: logPayload.period_label,
          subject_name: logPayload.subject_name,
          batch_group: logPayload.batch_group,
          practical_title: logPayload.practical_title,
          total_students: logPayload.total_students,
          present_students: logPayload.present_students,
          absent_students: logPayload.absent_students,
          absent_rolls: safeAbsentRolls,
          remarks: logPayload.remarks || null,
          status: logPayload.status || 'conducted',
          skip_reason: logPayload.skip_reason || null,
          topic_learned: logPayload.topic_learned || null,
          logged_by: loggedBy,
        },
        { onConflict: 'id' }
      )

      if (dbError) {
        console.error('❌ Supabase log upsert error:', dbError)
        return { success: false, error: dbError.message, log: newLogRecord }
      }
    } catch (err: any) {
      console.warn('Supabase log insert skipped (fallback active):', err)
      return { success: false, error: err.message, log: newLogRecord }
    }
  }

  safeRevalidatePaths(['/logs', '/records', '/print/daily-log', '/print/records', '/'])

  // Non-blocking background skipped session alert
  if (logPayload.status === 'skipped' || logPayload.is_skipped) {
    after(async () => {
      await dispatchSkippedSessionNotification({
        ...newLogRecord,
        teacher_name: teacherName,
        lab_name: labInfo?.name || safeLabId,
      }).catch((err) =>
        console.error('[Mailer] Background skipped session notification failed:', err)
      )
    })
  }

  return { success: true, log: newLogRecord }
}

function safeRevalidatePaths(paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p)
    }
  } catch (e) {
    // Outside active Next.js request context (e.g. testing scripts)
  }
}

export async function updatePracticalLog(id: string, data: Partial<PracticalLogUpdate>) {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged

  const store = getStore()
  const idx = store.findIndex((l) => l.id === id)
  const existingRecord = idx !== -1 ? store[idx] : null

  if (!isPrivileged && existingRecord) {
    const isOwner =
      (userScope.userId && (existingRecord.teacher_id === userScope.userId || existingRecord.logged_by === userScope.userId)) ||
      (existingRecord.teacher && userScope.fullName && existingRecord.teacher.toLowerCase().includes(userScope.fullName.toLowerCase())) ||
      (existingRecord.profiles?.full_name && userScope.fullName && existingRecord.profiles.full_name.toLowerCase().includes(userScope.fullName.toLowerCase()))

    if (!isOwner) {
      return { success: false, error: 'Permission denied: You can only modify your own practical session records.' }
    }
  }

  if (idx !== -1) {
    store[idx] = { ...store[idx], ...data, updated_at: new Date().toISOString() }
  }

  if (process.env.DATABASE_URL) {
    try {
      const pool = getPgPool()
      const fields: string[] = []
      const values: any[] = []
      let pIdx = 1

      if (data.practical_title !== undefined) {
        fields.push(`practical_title = $${pIdx++}`)
        values.push(data.practical_title)
      }
      if (data.experiment_name !== undefined) {
        fields.push(`experiment_name = $${pIdx++}`)
        values.push(data.experiment_name)
      }
      if (data.status !== undefined) {
        fields.push(`status = $${pIdx++}`)
        values.push(data.status)
      }
      if (data.skip_reason !== undefined) {
        fields.push(`skip_reason = $${pIdx++}`)
        values.push(data.skip_reason)
      }
      if (data.present_students !== undefined) {
        fields.push(`present_students = $${pIdx++}`)
        values.push(data.present_students)
      }
      if (data.total_students !== undefined) {
        fields.push(`total_students = $${pIdx++}`)
        values.push(data.total_students)
      }
      if (data.absent_roll_numbers !== undefined) {
        fields.push(`absent_roll_numbers = $${pIdx++}`)
        values.push(data.absent_roll_numbers)
      }
      if (data.remarks !== undefined) {
        fields.push(`remarks = $${pIdx++}`)
        values.push(data.remarks)
      }
      if (data.verification_remarks !== undefined) {
        fields.push(`verification_remarks = $${pIdx++}`)
        values.push(data.verification_remarks)
      }

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`)
        values.push(id)
        const sql = `UPDATE practical_logs SET ${fields.join(', ')} WHERE id = $${pIdx}`
        await pool.query(sql, values)
      }
    } catch (dbErr) {
      console.warn('⚠️ Direct PG update fallback error:', dbErr)
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      const { error } = await (supabase.from('practical_logs') as any).update(data).eq('id', id)
      if (error) {
        console.error('❌ Supabase log update error:', error)
      }
    } catch (e: any) {
      console.warn('⚠️ Supabase update error:', e.message)
    }
  }

  safeRevalidatePaths(['/records', '/logs', '/print/records', '/print/daily-log', '/'])

  return { success: true }
}

export async function getPracticalLogs(filters?: {
  search?: string
  lab_id?: string
  date?: string
  teacher_id?: string
  view_mode?: 'my_data' | 'all'
}) {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged
  const shouldScopeToMyData = !isPrivileged || filters?.view_mode === 'my_data'

  const store = getStore()
  let list = [...store]

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

      // Context-First Scoping at Supabase query layer
      if (shouldScopeToMyData && userScope.userId) {
        query = query.or(`teacher_id.eq.${userScope.userId},logged_by.eq.${userScope.userId}`)
      } else if (filters?.teacher_id && filters.teacher_id !== 'all') {
        query = query.eq('teacher_id', filters.teacher_id)
      }

      const { data, error } = await query
      if (!error && data && data.length > 0) {
        return data as any[]
      }
    } catch (e) {}
  }

  // In-memory store fallback with contextual scoping
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

  if (shouldScopeToMyData) {
    const teacherNames = [
      userScope.fullName,
      userScope.teacherProfile?.name,
      userScope.email?.split('@')[0],
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase())

    list = list.filter((l) => {
      if (userScope.userId && (l.teacher_id === userScope.userId || l.logged_by === userScope.userId)) return true
      const profName = (l.profiles?.full_name || l.teacher || '').toLowerCase()
      return teacherNames.some((tn) => profName.includes(tn) || tn.includes(profName))
    })
  } else if (filters?.teacher_id && filters.teacher_id !== 'all') {
    list = list.filter((l) => l.teacher_id === filters.teacher_id || l.profiles?.id === filters.teacher_id)
  }

  return list
}

export async function getTodayLogStats(dateStr?: string, viewMode?: 'my_data' | 'all') {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged
  const shouldScopeToMyData = !isPrivileged || viewMode === 'my_data'

  const store = getStore()
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  let todayList = store.filter((l) => l.date === targetDate)

  if (shouldScopeToMyData) {
    const teacherNames = [
      userScope.fullName,
      userScope.teacherProfile?.name,
    ]
      .filter(Boolean)
      .map((n) => n!.toLowerCase())

    todayList = todayList.filter((l) => {
      if (userScope.userId && (l.teacher_id === userScope.userId || l.logged_by === userScope.userId)) return true
      const profName = (l.profiles?.full_name || l.teacher || '').toLowerCase()
      return teacherNames.some((tn) => profName.includes(tn) || tn.includes(profName))
    })
  }

  const conducted = todayList.filter((l) => l.status !== 'skipped')
  const totalStudents = conducted.reduce((acc, curr) => acc + (curr.present_students || 0), 0)

  return {
    totalLogsToday: todayList.length,
    totalStudentsAttended: totalStudents,
    conductedCount: conducted.length,
    skippedCount: todayList.length - conducted.length,
    logs: todayList,
    userScope,
  }
}

export async function getScopedLogFormOptions() {
  const scope = await getServerUserScope()
  return {
    scope,
    isPrivileged: scope.isPrivileged,
    isTeacher: scope.isTeacher,
    assignedClasses: scope.assignedClasses,
    assignedSubjects: scope.assignedSubjects,
    assignedLabIds: scope.assignedLabIds,
    teacher: {
      id: scope.userId || scope.teacherProfile?.teacherId || 't1',
      name: scope.fullName || scope.teacherProfile?.name || 'Assigned Subject Teacher',
      email: scope.email,
    },
  }
}

export async function deletePracticalLog(id: string) {
  const userScope = await getServerUserScope()
  const isPrivileged = userScope.isPrivileged

  const store = getStore()
  const existingRecord = store.find((l) => l.id === id)

  if (!isPrivileged && existingRecord) {
    const isOwner =
      (userScope.userId && (existingRecord.teacher_id === userScope.userId || existingRecord.logged_by === userScope.userId)) ||
      (existingRecord.teacher && userScope.fullName && existingRecord.teacher.toLowerCase().includes(userScope.fullName.toLowerCase())) ||
      (existingRecord.profiles?.full_name && userScope.fullName && existingRecord.profiles.full_name.toLowerCase().includes(userScope.fullName.toLowerCase()))

    if (!isOwner) {
      return { success: false, error: 'Permission denied: You can only delete your own practical session records.' }
    }
  }

  globalThis.__PRACTICAL_LOGS_STORE__ = store.filter((l) => l.id !== id)

  if (process.env.DATABASE_URL) {
    try {
      const pool = getPgPool()
      await pool.query('DELETE FROM practical_logs WHERE id = $1', [id])
    } catch (e) {
      console.warn('⚠️ Direct PG delete fallback error:', e)
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.from('practical_logs').delete().eq('id', id)
    } catch (e) {}
  }

  safeRevalidatePaths(['/records', '/logs', '/print/records', '/print/daily-log', '/'])

  return { success: true }
}

export async function getActiveLabs(): Promise<LabRow[]> {
  const defaultLabs: LabRow[] = [
    { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab', capacity: 40, status: 'Operational', is_active: true },
    { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab', capacity: 38, status: 'Operational', is_active: true },
    { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab', capacity: 40, status: 'Operational', is_active: true },
    { id: 'bio', name: 'Biology & Life Sciences Lab', type: 'biology_lab', capacity: 35, status: 'Operational', is_active: true },
    { id: 'elec', name: 'Electronics & Hardware Lab', type: 'electronics_lab', capacity: 30, status: 'Operational', is_active: true },
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
