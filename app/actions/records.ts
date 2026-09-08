'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServerUserScope, UserScopeContext } from '@/lib/context/user-scope'
import { getPgPool } from '@/lib/db'
import {
  PracticalRecordItem,
  PracticalRecordFilters,
  PracticalGroupingKey,
  PracticalGroupedSection,
  PracticalGroupSubtotal,
  PracticalSummaryMetrics,
  IncidentRecordItem,
  IncidentRecordFilters,
  IncidentSummaryMetrics,
} from '@/types/records'
import { generatePracticalRecordsCsv, generateIncidentRecordsCsv } from '@/lib/exports/csv'
import { generatePracticalRecordsXlsxBuffer, generateIncidentRecordsXlsxBuffer } from '@/lib/exports/xlsx'

// Fallback seed practical records
const FALLBACK_PRACTICAL_LOGS: any[] = [
  {
    id: 'rec-p1',
    schedule_id: 'mon-1',
    lab_id: 'comp',
    teacher_id: 'e094a954-b7ec-4e42-ae36-b41019c0ce81',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 1 & 2 (10:10 - 11:45)',
    subject_name: 'COMP-12 - Data Structures & Algorithms Lab',
    batch_group: '12C - Tech Stream Sec A',
    practical_title: 'Implementation of Binary Search Trees in C++',
    total_students: 38,
    present_students: 36,
    absent_students: 2,
    remarks: 'All 38 workstations functioning properly. Students completed tree traversal.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Binary Search Trees & Traversal',
    logged_by: null,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    labs: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
    profiles: { id: 'e094a954-b7ec-4e42-ae36-b41019c0ce81', full_name: 'Dr. Rajesh Sharma', role: 'lab_incharge' },
  },
  {
    id: 'rec-p2',
    schedule_id: 'mon-2',
    lab_id: 'phys',
    teacher_id: 'a0110dea-ef2a-4fc1-b60a-6415fcc36bd1',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 3 & 4 (11:45 - 01:15)',
    subject_name: 'PHY-11 - Optics & Wave Mechanics',
    batch_group: '11 Sc - Science Stream Sec B',
    practical_title: 'Verification of Hooke’s Law and Spring Constant Calculation',
    total_students: 40,
    present_students: 38,
    absent_students: 2,
    remarks: 'Spring sets and weights calibrated. High student engagement.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Hooke’s Law & Spring Oscillations',
    logged_by: null,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    labs: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
    profiles: { id: 'a0110dea-ef2a-4fc1-b60a-6415fcc36bd1', full_name: 'Dr. Prakash Adhikari', role: 'teacher' },
  },
  {
    id: 'rec-p3',
    schedule_id: 'tue-1',
    lab_id: 'chem',
    teacher_id: '0a8ee514-a58a-41a1-a6a5-c444447b1db9',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    period_label: 'Period 2 & 3 (11:00 - 12:30)',
    subject_name: 'CHEM-12 - Acid-Base Quantitative Volumetric Titration',
    batch_group: '12C - Tech Stream Sec A',
    practical_title: 'Standardization of Sodium Hydroxide using Oxalic Acid',
    total_students: 36,
    present_students: 34,
    absent_students: 2,
    remarks: 'Burettes and indicators returned safely to buffer store.',
    status: 'conducted',
    skip_reason: null,
    topic_learned: 'Volumetric Titration & End-point Calculation',
    logged_by: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    labs: { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab' },
    profiles: { id: '0a8ee514-a58a-41a1-a6a5-c444447b1db9', full_name: 'Dr. Nirmala Poudel', role: 'teacher' },
  },
  {
    id: 'rec-p4',
    schedule_id: 'tue-4',
    lab_id: 'comp',
    teacher_id: 'f3ad9570-a56c-4727-82b7-b3edd942896c',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    period_label: 'Period 5 & 6 (02:00 - 03:30)',
    subject_name: 'COMP-11 - Database Systems & SQL Lab',
    batch_group: '11C - Computer Tech Sec A',
    practical_title: 'Relational Database Schema Design & DDL Scripting',
    total_students: 35,
    present_students: 0,
    absent_students: 35,
    remarks: 'Session cancelled due to inter-college sports meet.',
    status: 'skipped',
    skip_reason: 'Institutional Sports Week Event',
    topic_learned: null,
    logged_by: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    labs: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
    profiles: { id: 'f3ad9570-a56c-4727-82b7-b3edd942896c', full_name: 'Er. Anish Karki', role: 'teacher' },
  },
]

// Fallback seed incidents
const FALLBACK_INCIDENTS: any[] = [
  {
    id: 'inc-seed-1',
    lab_id: 'chem',
    schedule_id: null,
    date: new Date().toISOString().split('T')[0],
    session_label: 'Period 2 & 3 (11:00 - 12:30)',
    subject_name: 'Chemistry - Acid Base Titration',
    subject_teacher_name: 'Ms. Sunita Thapa',
    batch_name: '12C - Tech Stream',
    title: 'Accidental breakage of 50ml glass burette while mounting on stand',
    incident_type: 'breakage',
    severity: 'moderate',
    equipment_name: '50ml Borosilicate Burette',
    quantity: 1,
    student_rolls: 'Roll 14, 28',
    status: 'reported',
    escalated_to_hod: false,
    escalation_reason: null,
    escalated_at: null,
    resolution_notes: 'Clamp screw over-tightened during setup causing glass fracture. Cleared safely into hazardous waste bin.',
    resolved_by: null,
    resolved_by_id: null,
    resolved_at: null,
    reported_by: 'Ms. Sunita Thapa',
    reported_by_id: 't3',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    labs: { id: 'chem', name: 'Chemistry Laboratory', type: 'chemistry_lab' },
  },
  {
    id: 'inc-seed-2',
    lab_id: 'comp',
    schedule_id: null,
    date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    session_label: 'Period 1 & 2 (10:10 - 11:45)',
    subject_name: 'Computer Science - System Lab',
    subject_teacher_name: 'Dr. Rajesh Sharma',
    batch_name: '12C - Tech Stream',
    title: 'Workstation 14 SMPS power surge and capacitor burnout',
    incident_type: 'burnt_apparatus',
    severity: 'major_critical',
    equipment_name: 'Dell OptiPlex 450W SMPS Power Unit',
    quantity: 1,
    student_rolls: 'Roll 07',
    status: 'escalated_to_hod',
    escalated_to_hod: true,
    escalation_reason: 'Power surge damaged internal power supply unit; requires lab electrical line check before reconnection.',
    escalated_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
    resolution_notes: 'Unit quarantined on bench 4. Maintenance vendor contacted for warranty replacement.',
    resolved_by: null,
    resolved_by_id: null,
    resolved_at: null,
    reported_by: 'Dr. Rajesh Sharma',
    reported_by_id: 't1',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    labs: { id: 'comp', name: 'Computer Engineering Lab 01', type: 'computer_lab' },
  },
  {
    id: 'inc-seed-3',
    lab_id: 'phys',
    schedule_id: null,
    date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    session_label: 'Period 4 & 5 (12:30 - 02:00)',
    subject_name: 'Physics - Optics Lab',
    subject_teacher_name: 'Dr. Prakash Adhikari',
    batch_name: '11 Sc - Science Sec B',
    title: 'Loose optical bench leveling screw and prism clamp misalignment',
    incident_type: 'malfunction',
    severity: 'minor',
    equipment_name: 'Optical Bench Precision Prism Table',
    quantity: 2,
    student_rolls: 'Roll 02, 18',
    status: 'resolved',
    escalated_to_hod: false,
    escalation_reason: null,
    escalated_at: null,
    resolution_notes: 'Thread cleaned and re-lubricated with brass screw replacement from lab spares.',
    resolved_by: 'Er. Anish Karki (Lab In-Charge)',
    resolved_by_id: 't4',
    resolved_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    reported_by: 'Dr. Prakash Adhikari',
    reported_by_id: 't2',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    labs: { id: 'phys', name: 'Physics Laboratory', type: 'physics_lab' },
  },
]

declare global {
  var __PRACTICAL_RECORDS_STORE__: any[] | undefined
  var __INCIDENT_RECORDS_STORE__: any[] | undefined
}

function getPracticalStore(): any[] {
  if (!globalThis.__PRACTICAL_RECORDS_STORE__) {
    globalThis.__PRACTICAL_RECORDS_STORE__ = [...FALLBACK_PRACTICAL_LOGS]
  }
  return globalThis.__PRACTICAL_RECORDS_STORE__
}

function getIncidentStore(): any[] {
  if (!globalThis.__INCIDENT_RECORDS_STORE__) {
    globalThis.__INCIDENT_RECORDS_STORE__ = [...FALLBACK_INCIDENTS]
  }
  return globalThis.__INCIDENT_RECORDS_STORE__
}

/**
 * Retrieve current user and profile securely from server session
 */
async function getCurrentUserContext() {
  const scope = await getServerUserScope()
  return {
    userId: scope.userId || 'local-admin',
    role: scope.role,
    fullName: scope.fullName,
    isPrivileged: scope.isPrivileged,
    userScope: scope,
  }
}

// ============================================================================
// MODULE A: PRACTICAL RECORDS
// ============================================================================

export async function getPracticalRecords(
  filters: PracticalRecordFilters = {},
  groupBy: PracticalGroupingKey = 'none'
): Promise<{
  success: boolean
  sections: PracticalGroupedSection[]
  metrics: PracticalSummaryMetrics
  totalCount: number
  userRole: string
  userName?: string
  userScope?: UserScopeContext
  error?: string
}> {
  try {
    const userCtx = await getCurrentUserContext()
    let rawRecords: any[] = []
    let teacherProfileName: string | null = null

    // 1. First priority: Direct PostgreSQL connection via DATABASE_URL
    if (process.env.DATABASE_URL) {
      try {
        const pool = getPgPool()

        if (filters.teacher_id && filters.teacher_id !== 'all') {
          const profRes = await pool.query('SELECT full_name FROM public.profiles WHERE id::text = $1::text', [filters.teacher_id])
          teacherProfileName = profRes.rows[0]?.full_name || null
        }

        const res = await pool.query(
          `
          SELECT 
            pl.id,
            pl.schedule_id,
            pl.lab_id,
            pl.teacher_id,
            to_char(pl.date, 'YYYY-MM-DD') as date,
            pl.period_label,
            pl.subject_name,
            pl.batch_group,
            pl.practical_title,
            pl.total_students,
            pl.present_students,
            pl.absent_students,
            pl.absent_rolls,
            pl.remarks,
            pl.status,
            pl.skip_reason,
            pl.topic_learned,
            pl.logged_by,
            pl.created_at,
            json_build_object('id', l.id, 'name', l.name, 'type', l.type) as labs,
            json_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) as profiles
          FROM public.practical_logs pl
          LEFT JOIN public.labs l ON l.id::text = pl.lab_id::text
          LEFT JOIN public.profiles p ON p.id::text = pl.teacher_id::text
          WHERE ($1::boolean OR pl.teacher_id::text = $2::text OR pl.logged_by::text = $2::text)
          ORDER BY pl.date DESC, pl.created_at DESC;
        `,
          [userCtx.isPrivileged, userCtx.userId]
        )

        if (res.rows && res.rows.length > 0) {
          rawRecords = res.rows
        }
      } catch (err) {
        console.warn('Postgres direct query failed, falling back to Supabase/store:', err)
      }
    }

    // 2. Second priority: Supabase query
    if (rawRecords.length === 0 && isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        let query = supabase
          .from('practical_logs')
          .select(`
            *,
            labs (id, name, type),
            profiles (id, full_name, email, role)
          `)
          .order('date', { ascending: false })
          .order('period_label', { ascending: true })

        if (!userCtx.isPrivileged && userCtx.userId) {
          query = query.or(`teacher_id.eq.${userCtx.userId},logged_by.eq.${userCtx.userId}`)
        }

        if (!teacherProfileName && filters.teacher_id && filters.teacher_id !== 'all') {
          const { data: prof } = await (supabase.from('profiles') as any)
            .select('id, full_name')
            .eq('id', filters.teacher_id)
            .maybeSingle()
          teacherProfileName = (prof as any)?.full_name || null
        }

        const { data, error } = await query
        if (!error && data && data.length > 0) {
          rawRecords = data
        }
      } catch (err) {
        console.warn('Supabase query failed:', err)
      }
    }

    // 3. Third priority: Memory store fallback
    if (rawRecords.length === 0) {
      rawRecords = getPracticalStore()
    }

    // Apply in-memory filtering if fallback is used or further filtering is needed
    let filtered = rawRecords.filter((r) => {
      // RBAC check
      if (!userCtx.isPrivileged && r.teacher_id && r.teacher_id !== userCtx.userId) {
        return false
      }
      if (userCtx.isPrivileged && filters.teacher_id && filters.teacher_id !== 'all') {
        const matchesId = r.teacher_id === filters.teacher_id || r.profiles?.id === filters.teacher_id
        const cleanTarget = teacherProfileName ? teacherProfileName.replace(/^(Er\.|Dr\.|Mr\.|Ms\.)\s*/i, '').trim().toLowerCase() : ''
        const rowTeacher = (r.profiles?.full_name || r.teacher || '').toLowerCase()
        const matchesName = cleanTarget ? rowTeacher.includes(cleanTarget) : false
        if (!matchesId && !matchesName) return false
      }
      if (filters.lab_id && filters.lab_id !== 'all') {
        if (r.lab_id !== filters.lab_id && r.labs?.id !== filters.lab_id) return false
      }
      if (filters.batch_group && filters.batch_group !== 'all') {
        if (!r.batch_group?.toLowerCase().includes(filters.batch_group.toLowerCase())) return false
      }
      if (filters.subject_name && filters.subject_name !== 'all') {
        if (!r.subject_name?.toLowerCase().includes(filters.subject_name.toLowerCase())) return false
      }
      if (filters.period_label && filters.period_label !== 'all') {
        if (r.period_label !== filters.period_label) return false
      }
      if (filters.date_from && r.date < filters.date_from) return false
      if (filters.date_to && r.date > filters.date_to) return false
      if (filters.status && filters.status !== 'all') {
        if (r.status !== filters.status) return false
      }
      if (filters.search && filters.search.trim()) {
        const query = filters.search.toLowerCase()
        const matches =
          r.practical_title?.toLowerCase().includes(query) ||
          r.subject_name?.toLowerCase().includes(query) ||
          r.batch_group?.toLowerCase().includes(query) ||
          r.remarks?.toLowerCase().includes(query)
        if (!matches) return false
      }
      return true
    })

    // Map into PracticalRecordItem with attendance %
    const formattedRecords: PracticalRecordItem[] = filtered.map((r) => {
      const tot = r.total_students || 0
      const pres = r.present_students || 0
      const attPct = tot > 0 ? (pres / tot) * 100 : 0
      return {
        ...r,
        attendance_pct: attPct,
      }
    })

    // Compute Overall Summary Metrics
    const totalSessions = formattedRecords.length
    const conductedSessions = formattedRecords.filter((r) => r.status !== 'skipped').length
    const skippedSessions = totalSessions - conductedSessions
    const totalPresent = formattedRecords.reduce((acc, curr) => acc + (curr.present_students || 0), 0)
    const totalEnrolled = formattedRecords.reduce((acc, curr) => acc + (curr.total_students || 0), 0)
    const averageAttendancePct = totalEnrolled > 0 ? (totalPresent / totalEnrolled) * 100 : 0

    const metrics: PracticalSummaryMetrics = {
      totalSessions,
      conductedSessions,
      skippedSessions,
      totalPresent,
      totalEnrolled,
      averageAttendancePct,
    }

    // Grouping Logic
    const sections: PracticalGroupedSection[] = []

    if (groupBy === 'none') {
      sections.push({
        groupKey: 'all',
        groupTitle: 'All Practical Records',
        subtotal: {
          groupKey: 'all',
          groupTitle: 'All Practical Records',
          totalSessions,
          conductedSessions,
          skippedSessions,
          totalEnrolled,
          totalPresent,
          totalAbsent: totalEnrolled - totalPresent,
          averageAttendancePct,
        },
        records: formattedRecords,
      })
    } else {
      const groupMap = new Map<string, PracticalRecordItem[]>()

      for (const rec of formattedRecords) {
        let key = 'Unspecified'
        if (groupBy === 'batch_group') key = rec.batch_group || 'Unspecified Batch'
        else if (groupBy === 'subject_name') key = rec.subject_name || 'Unspecified Subject'
        else if (groupBy === 'teacher') key = rec.profiles?.full_name || 'Unassigned Faculty'
        else if (groupBy === 'period_label') key = rec.period_label || 'Unassigned Period'

        if (!groupMap.has(key)) {
          groupMap.set(key, [])
        }
        groupMap.get(key)!.push(rec)
      }

      // Build group sections and subtotals
      for (const [groupTitle, recs] of groupMap.entries()) {
        const gTotal = recs.length
        const gConducted = recs.filter((r) => r.status !== 'skipped').length
        const gSkipped = gTotal - gConducted
        const gPresent = recs.reduce((sum, r) => sum + (r.present_students || 0), 0)
        const gEnrolled = recs.reduce((sum, r) => sum + (r.total_students || 0), 0)
        const gAvgAtt = gEnrolled > 0 ? (gPresent / gEnrolled) * 100 : 0

        sections.push({
          groupKey: groupTitle.toLowerCase().replace(/\s+/g, '-'),
          groupTitle,
          subtotal: {
            groupKey: groupTitle,
            groupTitle,
            totalSessions: gTotal,
            conductedSessions: gConducted,
            skippedSessions: gSkipped,
            totalEnrolled: gEnrolled,
            totalPresent: gPresent,
            totalAbsent: gEnrolled - gPresent,
            averageAttendancePct: gAvgAtt,
          },
          records: recs,
        })
      }
    }

    return {
      success: true,
      sections,
      metrics,
      totalCount: formattedRecords.length,
      userRole: userCtx.role,
      userName: userCtx.fullName,
      userScope: userCtx.userScope,
    }
  } catch (e: any) {
    return {
      success: false,
      sections: [],
      metrics: {
        totalSessions: 0,
        conductedSessions: 0,
        skippedSessions: 0,
        totalPresent: 0,
        totalEnrolled: 0,
        averageAttendancePct: 0,
      },
      totalCount: 0,
      userRole: 'teacher',
      error: e.message || 'Failed to fetch practical records',
    }
  }
}

// ============================================================================
// MODULE B: INCIDENT & DAMAGE RECORDS
// ============================================================================

export async function getIncidentRecords(
  filters: IncidentRecordFilters = {}
): Promise<{
  success: boolean
  incidents: IncidentRecordItem[]
  metrics: IncidentSummaryMetrics
  userRole: string
  userId: string
  userName?: string
  userScope?: UserScopeContext
  error?: string
}> {
  try {
    const userCtx = await getCurrentUserContext()
    let rawIncidents: any[] = []

    // 1. First priority: Direct PostgreSQL connection via DATABASE_URL
    if (process.env.DATABASE_URL) {
      try {
        const pool = getPgPool()

        const res = await pool.query(
          `
          SELECT 
            li.id,
            li.lab_id,
            li.schedule_id,
            to_char(li.date, 'YYYY-MM-DD') as date,
            li.session_label,
            li.subject_name,
            li.subject_teacher_name,
            li.batch_name,
            li.title,
            li.incident_type,
            li.severity,
            li.equipment_name,
            li.quantity,
            li.student_rolls,
            li.status,
            li.escalated_to_hod,
            li.escalation_reason,
            li.escalated_at,
            li.resolution_notes,
            li.resolved_by,
            li.resolved_by_id,
            li.resolved_at,
            li.reported_by,
            li.reported_by_id,
            li.created_at,
            json_build_object('id', l.id, 'name', l.name, 'type', l.type) as labs,
            json_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) as reporter_profile
          FROM public.lab_incidents li
          LEFT JOIN public.labs l ON l.id::text = li.lab_id::text
          LEFT JOIN public.profiles p ON p.id::text = li.reported_by_id::text
          WHERE ($1::boolean OR li.reported_by_id::text = $2::text OR li.subject_teacher_name = $3 OR li.reported_by = $3)
          ORDER BY li.created_at DESC;
        `,
          [userCtx.isPrivileged, userCtx.userId, userCtx.fullName]
        )

        if (res.rows && res.rows.length > 0) {
          rawIncidents = res.rows
        }
      } catch (err) {
        console.warn('Postgres direct incident query failed, falling back to Supabase/store:', err)
      }
    }

    // 2. Second priority: Supabase query
    if (rawIncidents.length === 0 && isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        let query = supabase
          .from('lab_incidents')
          .select(`
            *,
            labs (id, name, type)
          `)
          .order('created_at', { ascending: false })

        if (!userCtx.isPrivileged && userCtx.userId) {
          query = query.or(`reported_by_id.eq.${userCtx.userId},subject_teacher_name.eq.${userCtx.fullName},reported_by.eq.${userCtx.fullName}`)
        }

        const { data, error } = await query
        if (!error && data && data.length > 0) {
          rawIncidents = data
        }
      } catch (err) {
        console.warn('Supabase incident query failed:', err)
      }
    }

    // 3. Third priority: Memory store fallback
    if (rawIncidents.length === 0) {
      rawIncidents = getIncidentStore()
    }

    // Filter memory store if fallback was used
    const filtered = rawIncidents.filter((inc) => {
      // RBAC check
      if (!userCtx.isPrivileged && inc.reported_by_id && inc.reported_by_id !== userCtx.userId) {
        return false
      }
      if (filters.lab_id && filters.lab_id !== 'all') {
        if (inc.lab_id !== filters.lab_id && inc.labs?.id !== filters.lab_id) return false
      }
      if (filters.severity && filters.severity !== 'all') {
        if (inc.severity !== filters.severity) return false
      }
      if (filters.status && filters.status !== 'all') {
        if (inc.status !== filters.status) return false
      }
      if (filters.incident_type && filters.incident_type !== 'all') {
        if (inc.incident_type !== filters.incident_type) return false
      }
      if (filters.date_from && inc.date < filters.date_from) return false
      if (filters.date_to && inc.date > filters.date_to) return false
      if (filters.search && filters.search.trim()) {
        const query = filters.search.toLowerCase()
        const matches =
          inc.title?.toLowerCase().includes(query) ||
          inc.equipment_name?.toLowerCase().includes(query) ||
          inc.batch_name?.toLowerCase().includes(query) ||
          inc.resolution_notes?.toLowerCase().includes(query)
        if (!matches) return false
      }
      return true
    })

    // Compute derived time-to-resolve
    let totalResolvedHours = 0
    let resolvedWithDurationCount = 0

    const formattedIncidents: IncidentRecordItem[] = filtered.map((inc) => {
      let timeToResolveHours: number | null = null
      let timeToResolveLabel = 'Active / Open'

      if (inc.resolved_at && inc.created_at) {
        const createdMs = new Date(inc.created_at).getTime()
        const resolvedMs = new Date(inc.resolved_at).getTime()
        if (resolvedMs >= createdMs) {
          const hours = (resolvedMs - createdMs) / (1000 * 60 * 60)
          timeToResolveHours = hours
          if (hours < 1) {
            timeToResolveLabel = `${Math.round(hours * 60)} mins`
          } else if (hours < 24) {
            timeToResolveLabel = `${hours.toFixed(1)} hrs`
          } else {
            timeToResolveLabel = `${(hours / 24).toFixed(1)} days`
          }
          totalResolvedHours += hours
          resolvedWithDurationCount++
        } else {
          timeToResolveLabel = 'Resolved'
        }
      } else if (inc.status === 'resolved') {
        timeToResolveLabel = 'Resolved'
      } else if (inc.status === 'under_repair') {
        timeToResolveLabel = 'Under Repair'
      } else if (inc.status === 'replaced') {
        timeToResolveLabel = 'Replaced'
      } else if (inc.status === 'escalated_to_hod') {
        timeToResolveLabel = 'Escalated to HOD'
      }

      return {
        ...inc,
        time_to_resolve_hours: timeToResolveHours,
        time_to_resolve_label: timeToResolveLabel,
      }
    })

    // Compute Metrics
    const totalIncidents = formattedIncidents.length
    const openCount = formattedIncidents.filter((i) => i.status !== 'resolved').length
    const resolvedCount = formattedIncidents.filter((i) => i.status === 'resolved').length
    const underRepairCount = formattedIncidents.filter((i) => i.status === 'under_repair').length
    const replacedCount = formattedIncidents.filter((i) => i.status === 'replaced').length
    const escalatedCount = formattedIncidents.filter((i) => i.status === 'escalated_to_hod').length
    const minorCount = formattedIncidents.filter((i) => i.severity === 'minor').length
    const moderateCount = formattedIncidents.filter((i) => i.severity === 'moderate').length
    const criticalCount = formattedIncidents.filter((i) => i.severity === 'major_critical').length

    const avgHours =
      resolvedWithDurationCount > 0 ? totalResolvedHours / resolvedWithDurationCount : null
    let avgLabel = 'N/A'
    if (avgHours !== null) {
      if (avgHours < 1) avgLabel = `${Math.round(avgHours * 60)} mins`
      else if (avgHours < 24) avgLabel = `${avgHours.toFixed(1)} hrs`
      else avgLabel = `${(avgHours / 24).toFixed(1)} days`
    }

    const metrics: IncidentSummaryMetrics = {
      totalIncidents,
      openCount,
      resolvedCount,
      underRepairCount,
      replacedCount,
      escalatedCount,
      minorCount,
      moderateCount,
      criticalCount,
      averageTimeToResolveHours: avgHours,
      averageTimeToResolveLabel: avgLabel,
    }

    return {
      success: true,
      incidents: formattedIncidents,
      metrics,
      userRole: userCtx.role,
      userId: userCtx.userId,
      userName: userCtx.fullName,
      userScope: userCtx.userScope,
    }
  } catch (e: any) {
    return {
      success: false,
      incidents: [],
      metrics: {
        totalIncidents: 0,
        openCount: 0,
        resolvedCount: 0,
        underRepairCount: 0,
        replacedCount: 0,
        escalatedCount: 0,
        minorCount: 0,
        moderateCount: 0,
        criticalCount: 0,
        averageTimeToResolveHours: null,
        averageTimeToResolveLabel: 'N/A',
      },
      userRole: 'teacher',
      userId: '',
      error: e.message || 'Failed to fetch incident records',
    }
  }
}

/**
 * Report a new incident with authentic user ID stamping
 */
export async function reportIncidentRecord(payload: {
  lab_id: string
  schedule_id?: string | null
  date: string
  session_label: string
  subject_name: string
  subject_teacher_name: string
  batch_name: string
  title: string
  incident_type: string
  severity: 'minor' | 'moderate' | 'major_critical'
  equipment_name: string
  quantity: number
  student_rolls?: string
}): Promise<{ success: boolean; incidentId?: string; error?: string }> {
  try {
    const userCtx = await getCurrentUserContext()

    // Validate quantity >= 1
    const qty = Math.max(1, parseInt(String(payload.quantity), 10) || 1)
    const incidentId = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const isCritical = payload.severity === 'major_critical'

    const newRecord = {
      id: incidentId,
      lab_id: payload.lab_id,
      schedule_id: payload.schedule_id || null,
      date: payload.date || new Date().toISOString().split('T')[0],
      session_label: payload.session_label,
      subject_name: payload.subject_name,
      subject_teacher_name: payload.subject_teacher_name,
      batch_name: payload.batch_name,
      title: payload.title,
      incident_type: payload.incident_type || 'breakage',
      severity: payload.severity,
      equipment_name: payload.equipment_name,
      quantity: qty,
      student_rolls: payload.student_rolls || null,
      status: 'reported',
      escalated_to_hod: isCritical,
      escalation_reason: isCritical ? 'Critical damage requiring immediate HOD inspection' : null,
      escalated_at: isCritical ? new Date().toISOString() : null,
      resolution_notes: null,
      resolved_by: null,
      resolved_by_id: null,
      resolved_at: null,
      reported_by: userCtx.fullName,
      reported_by_id: userCtx.userId,
      created_at: new Date().toISOString(),
    }

    // Persist to memory
    const store = getIncidentStore()
    store.unshift(newRecord)

    // Write to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).insert(newRecord)

        // Dispatch notifications
        const notifs = [
          {
            id: `notif-${Date.now()}-adm`,
            incident_id: incidentId,
            target_role: 'super_admin',
            target_lab_id: payload.lab_id,
            title: `${isCritical ? '🚨 CRITICAL DAMAGE: ' : 'Incident: '}${payload.title}`,
            message: `${payload.lab_id.toUpperCase()} Lab: ${payload.equipment_name} reported by ${userCtx.fullName}.`,
            severity: isCritical ? 'critical' : 'warning',
            is_read: false,
            created_at: new Date().toISOString(),
          },
          {
            id: `notif-${Date.now()}-inc`,
            incident_id: incidentId,
            target_role: 'lab_incharge',
            target_lab_id: payload.lab_id,
            title: `Apparatus Triage: ${payload.equipment_name}`,
            message: `Reported during ${payload.session_label} (${payload.batch_name}). Assigned for triage.`,
            severity: isCritical ? 'critical' : 'warning',
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ]
        if (isCritical) {
          notifs.push({
            id: `notif-${Date.now()}-hod`,
            incident_id: incidentId,
            target_role: 'hod',
            target_lab_id: payload.lab_id,
            title: `🚨 HOD Escalation: ${payload.title}`,
            message: `Critical safety incident logged in ${payload.lab_id.toUpperCase()} Lab by ${userCtx.fullName}.`,
            severity: 'critical',
            is_read: false,
            created_at: new Date().toISOString(),
          })
        }
        await (supabase.from('lab_notifications') as any).insert(notifs)
      } catch (err) {
        console.warn('Supabase incident insert fallback active:', err)
      }
    }

    revalidatePath('/records')
    revalidatePath('/records/incidents')
    revalidatePath('/incidents')
    return { success: true, incidentId }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to report incident' }
  }
}

/**
 * Update incident status, notes, or escalate to HOD with strict RBAC
 */
export async function updateIncidentWorkflow(
  incidentId: string,
  payload: {
    status: 'reported' | 'escalated_to_hod' | 'under_repair' | 'replaced' | 'resolved'
    resolution_notes?: string
    is_escalating?: boolean
    escalation_reason?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const userCtx = await getCurrentUserContext()

    // RBAC: Teachers are strictly blocked from editing resolutions or escalating
    if (!userCtx.isPrivileged) {
      return {
        success: false,
        error: 'Access Denied: Teachers cannot resolve or escalate laboratory incidents. Please consult the Lab In-Charge or HOD.',
      }
    }

    // Integrity: Resolving strictly requires non-empty resolution notes
    if (payload.status === 'resolved') {
      if (!payload.resolution_notes || payload.resolution_notes.trim().length < 5) {
        return {
          success: false,
          error: 'Integrity Violation: A detailed resolution note (at least 5 characters) is required to certify an incident as resolved.',
        }
      }
    }

    const store = getIncidentStore()
    const idx = store.findIndex((i) => i.id === incidentId)

    const isResolving = payload.status === 'resolved'
    const isEscalating = payload.is_escalating || payload.status === 'escalated_to_hod'
    const now = new Date().toISOString()

    const updates: any = {
      status: payload.status,
    }

    if (payload.resolution_notes !== undefined) {
      updates.resolution_notes = payload.resolution_notes.trim()
    }

    if (isResolving) {
      updates.resolved_by_id = userCtx.userId
      updates.resolved_by = `${userCtx.fullName} (${userCtx.role.toUpperCase()})`
      updates.resolved_at = now
    }

    if (isEscalating) {
      updates.escalated_to_hod = true
      updates.status = 'escalated_to_hod'
      updates.escalation_reason = payload.escalation_reason || 'Escalated for institutional oversight by Lab In-Charge'
      updates.escalated_at = now
    }

    if (idx !== -1) {
      store[idx] = {
        ...store[idx],
        ...updates,
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        await (supabase.from('lab_incidents') as any).update(updates).eq('id', incidentId)

        if (isEscalating) {
          await (supabase.from('lab_notifications') as any).insert([
            {
              id: `notif-${Date.now()}-hod-escalate`,
              incident_id: incidentId,
              target_role: 'hod',
              title: `⚡ HOD Escalation: Apparatus Incident #${incidentId}`,
              message: `Escalation Reason: ${updates.escalation_reason}. Actioned by ${userCtx.fullName}.`,
              severity: 'critical',
              is_read: false,
              created_at: now,
            },
          ])
        }
      } catch (err) {
        console.warn('Supabase incident update fallback active:', err)
      }
    }

    revalidatePath('/records')
    revalidatePath('/records/incidents')
    revalidatePath('/incidents')
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to update incident workflow' }
  }
}

// ============================================================================
// EXPORT SERVER ACTIONS
// ============================================================================

export async function exportPracticalRecordsAction(
  filters: PracticalRecordFilters = {},
  groupBy: PracticalGroupingKey = 'none',
  format: 'xlsx' | 'csv' = 'xlsx'
): Promise<{
  success: boolean
  base64?: string
  filename?: string
  contentType?: string
  error?: string
}> {
  try {
    const data = await getPracticalRecords(filters, groupBy)
    if (!data.success) throw new Error(data.error)

    const fromStr = filters.date_from || 'start'
    const toStr = filters.date_to || 'end'
    const filename = `practical-records_${groupBy}_${fromStr}_${toStr}.${format}`

    if (format === 'csv') {
      const csvContent = generatePracticalRecordsCsv(data.sections, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Laboratories',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
      })
      const base64 = Buffer.from(csvContent, 'utf-8').toString('base64')
      return {
        success: true,
        base64,
        filename,
        contentType: 'text/csv; charset=utf-8',
      }
    } else {
      const buffer = await generatePracticalRecordsXlsxBuffer(data.sections, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Laboratories',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
        groupByLabel: groupBy.toUpperCase(),
      })
      const base64 = buffer.toString('base64')
      return {
        success: true,
        base64,
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to export practical records' }
  }
}

export async function exportIncidentRecordsAction(
  filters: IncidentRecordFilters = {},
  format: 'xlsx' | 'csv' = 'xlsx'
): Promise<{
  success: boolean
  base64?: string
  filename?: string
  contentType?: string
  error?: string
}> {
  try {
    const data = await getIncidentRecords(filters)
    if (!data.success) throw new Error(data.error)

    const fromStr = filters.date_from || 'start'
    const toStr = filters.date_to || 'end'
    const filename = `incident-records_${fromStr}_${toStr}.${format}`

    if (format === 'csv') {
      const csvContent = generateIncidentRecordsCsv(data.incidents, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Facilities',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
      })
      const base64 = Buffer.from(csvContent, 'utf-8').toString('base64')
      return {
        success: true,
        base64,
        filename,
        contentType: 'text/csv; charset=utf-8',
      }
    } else {
      const buffer = await generateIncidentRecordsXlsxBuffer(data.incidents, data.metrics, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Facilities',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
      })
      const base64 = buffer.toString('base64')
      return {
        success: true,
        base64,
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to export incident records' }
  }
}
