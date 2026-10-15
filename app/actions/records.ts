'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { getServerUserScope, type UserScopeContext } from '@/lib/context/server-user-scope'
import { isValidUuid } from '@/lib/utils'
import { getPgPool } from '@/lib/db'
import type {
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
import { sanitizePostgrestSearch, resolveExportPrintScope } from '@/lib/report-spec/filter-codec'
import { practicalReportSpec, getClassAliases } from '@/lib/report-spec/practical-spec'
import { incidentReportSpec } from '@/lib/report-spec/incident-spec'

function normalizeDateToString(val: any): string {
  if (!val) return ''
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString().split('T')[0]
  }
  if (typeof val === 'string') {
    return val.includes('T') ? val.split('T')[0] : val
  }
  return String(val)
}

function normalizeTimestampToString(val: any): string {
  if (!val) return ''
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '' : val.toISOString()
  }
  return String(val)
}


// Fallback seed practical records
const FALLBACK_PRACTICAL_LOGS: any[] = [
  {
    id: 'rec-p1',
    schedule_id: 'mon-1',
    lab_id: 'comp',
    teacher_id: 'e094a954-b7ec-4e42-ae36-b41019c0ce81',
    date: new Date().toISOString().split('T')[0],
    period_label: 'Period 1 & 2 (10:10 - 11:45)',
    subject_code: 'COMP-12',
    subject_name: 'Data Structures & Algorithms Lab',
    batch_group: '12 Eng',
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
    subject_code: 'PHY-11',
    subject_name: 'Optics & Wave Mechanics',
    batch_group: '11 Eng',
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
    subject_code: 'CHEM-12',
    subject_name: 'Acid-Base Quantitative Volumetric Titration',
    batch_group: '12 Eng',
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
    subject_code: 'COMP-11',
    subject_name: 'Database Systems & SQL Lab',
    batch_group: '11 Mgt',
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
    batch_name: '12 Eng',
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
    batch_name: '12 Eng',
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
    batch_name: '11 Eng',
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
  var __PRINT_SELECTION_TOKENS__: Map<string, { ids: string[]; expiresAt: number }> | undefined
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

function getPrintTokenStore(): Map<string, { ids: string[]; expiresAt: number }> {
  if (!globalThis.__PRINT_SELECTION_TOKENS__) {
    globalThis.__PRINT_SELECTION_TOKENS__ = new Map()
  }
  return globalThis.__PRINT_SELECTION_TOKENS__
}

/**
 * Creates a database-backed print selection session token for selections exceeding URL thresholds (> 10 IDs).
 * Falls back safely to memory store if Supabase is offline or unconfigured.
 */
export async function createPrintSelectionSessionAction(ids: string[]): Promise<{
  success: boolean
  token?: string
  error?: string
}> {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: false, error: 'No record IDs provided for print selection.' }
    }
    const token = `psel_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        // Opportunistic cleanup of expired tokens
        await supabase.from('print_selection_tokens').delete().lt('expires_at', new Date().toISOString())

        const { error } = await supabase.from('print_selection_tokens').insert({
          token,
          ids,
          expires_at: expiresAt,
        })
        if (error) {
          console.warn('Failed to insert print selection token into Supabase, using memory fallback:', error)
          getPrintTokenStore().set(token, { ids, expiresAt: Date.now() + 15 * 60 * 1000 })
        }
      } catch (err) {
        console.warn('Supabase print token error, using fallback:', err)
        getPrintTokenStore().set(token, { ids, expiresAt: Date.now() + 15 * 60 * 1000 })
      }
    } else {
      getPrintTokenStore().set(token, { ids, expiresAt: Date.now() + 15 * 60 * 1000 })
    }

    return { success: true, token }
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to create print selection token' }
  }
}

/**
 * Resolves a database-backed print selection session token into its constituent record IDs.
 */
export async function getPrintSelectionSessionAction(token: string): Promise<{
  success: boolean
  ids: string[]
  error?: string
}> {
  try {
    if (!token || !token.trim()) {
      return { success: false, ids: [], error: 'Invalid or missing print token.' }
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from('print_selection_tokens')
          .select('ids, expires_at')
          .eq('token', token.trim())
          .maybeSingle()

        if (!error && data) {
          if (new Date(data.expires_at).getTime() > Date.now()) {
            return { success: true, ids: (data.ids as string[]) || [] }
          } else {
            return { success: false, ids: [], error: 'Print selection session has expired.' }
          }
        }
      } catch (err) {
        console.warn('Supabase print token read error, checking fallback store:', err)
      }
    }

    // Check memory store fallback
    const store = getPrintTokenStore()
    const entry = store.get(token.trim())
    if (entry && entry.expiresAt > Date.now()) {
      return { success: true, ids: entry.ids }
    }

    return { success: false, ids: [], error: 'Print selection session not found or expired.' }
  } catch (e: any) {
    return { success: false, ids: [], error: e.message || 'Failed to resolve print token' }
  }
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
  records: PracticalRecordItem[]
  metrics: PracticalSummaryMetrics
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  userRole: string
  userName?: string
  userScope?: UserScopeContext
  academicYears?: Array<{ id: string; name: string; isCurrent: boolean }>
  activeAcademicYearId?: string
  error?: string
}> {
  try {
    const userCtx = await getCurrentUserContext()
    const page = filters.page && filters.page > 0 ? filters.page : 1
    const isPaginated = typeof filters.pageSize === 'number' && filters.pageSize > 0
    const pageSize = isPaginated ? filters.pageSize! : 10

    let rawRecords: any[] = []
    let totalCount = 0
    let dbSuccess = false
    let metrics: PracticalSummaryMetrics = {
      totalSessions: 0,
      conductedSessions: 0,
      skippedSessions: 0,
      totalPresent: 0,
      totalEnrolled: 0,
      averageAttendancePct: 0,
    }

    // 1. Supabase Query Execution
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()

        // Disambiguated profiles!teacher_id relation and academic_year relation
        let query = supabase
          .from('practical_logs')
          .select(`
            *,
            labs (id, name, type),
            profiles:profiles!teacher_id (id, full_name, email, role),
            academic_years:academic_year_id (id, name, is_current)
          `, { count: 'exact' })

        // RBAC: teachers see own records or logged_by
        if (!userCtx.isPrivileged && userCtx.userId) {
          query = query.or(`teacher_id.eq.${userCtx.userId},logged_by.eq.${userCtx.userId}`)
        }

        // Canonical WHERE Filters: If selected_ids is provided, query strictly for selected rows
        if (filters.selected_ids && filters.selected_ids.length > 0) {
          query = query.in('id', filters.selected_ids)
        } else {
          if (filters.academic_year_id && filters.academic_year_id !== 'all') {
            query = query.eq('academic_year_id', filters.academic_year_id)
          }
          if (filters.lab_id && filters.lab_id !== 'all') {
            query = query.eq('lab_id', filters.lab_id)
          }
          if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status as any)
          }
          if (filters.date_from) {
            query = query.gte('date', filters.date_from)
          }
          if (filters.date_to) {
            query = query.lte('date', filters.date_to)
          }
          if (filters.date) {
            query = query.eq('date', filters.date)
          }
          if (filters.batch_group && filters.batch_group !== 'all') {
            const aliases = getClassAliases(filters.batch_group)
            const orConds = aliases.map((a) => `batch_group.ilike.%${sanitizePostgrestSearch(a)}%`).join(',')
            query = query.or(orConds)
          }
          if (filters.subject_name && filters.subject_name !== 'all') {
            query = query.ilike('subject_name', `%${filters.subject_name}%`)
          }
          if (filters.period_label && filters.period_label !== 'all') {
            query = query.ilike('period_label', `%${filters.period_label}%`)
          }
          if (filters.remarks && filters.remarks.trim()) {
            query = query.ilike('remarks', `%${filters.remarks.trim()}%`)
          }
          if (filters.teacher_id && filters.teacher_id !== 'all') {
            query = query.eq('teacher_id', filters.teacher_id)
          }
          if (filters.teacher_name && filters.teacher_name.trim()) {
            query = query.ilike('profiles.full_name', `%${filters.teacher_name.trim()}%`)
          }

          // Base-table Global Search with PostgREST sanitization (Requirements A & G)
          if (filters.search && filters.search.trim()) {
            const clean = sanitizePostgrestSearch(filters.search)
            if (clean) {
              query = query.or(`practical_title.ilike.%${clean}%,remarks.ilike.%${clean}%,batch_group.ilike.%${clean}%,subject_name.ilike.%${clean}%`)
            }
          }
        }

        // Spec-driven Sorting & Universal Tiebreakers (Requirements B, E, F, H)
        const sortKey = filters.sortKey
        const sortDirection = filters.sortDirection || 'desc'
        const colSpec = practicalReportSpec.columns.find((c) => c.id === sortKey)

        if (sortKey && colSpec?.foreignTable) {
          query = query.order(colSpec.dbColumn || 'name', {
            foreignTable: colSpec.foreignTable,
            ascending: sortDirection === 'asc',
            nullsFirst: false,
          })
        } else if (sortKey && colSpec?.dbColumn) {
          query = query.order(colSpec.dbColumn, { ascending: sortDirection === 'asc' })
        } else if (sortKey === 'facility' || sortKey === 'lab_id') {
          query = query.order('name', {
            foreignTable: 'labs',
            ascending: sortDirection === 'asc',
            nullsFirst: false,
          })
        }

        // Universal deterministic tiebreaker
        if (sortKey !== 'date') {
          query = query.order('date', { ascending: false })
        }
        if (sortKey !== 'created_at') {
          query = query.order('created_at', { ascending: false })
        }

        // SQL Pagination (.range)
        if (isPaginated) {
          const from = (page - 1) * pageSize
          const to = from + pageSize - 1
          query = query.range(from, to)
        }

        const { data, count, error } = await query
        if (!error && data) {
          rawRecords = data
          totalCount = typeof count === 'number' ? count : data.length
          dbSuccess = true
        }

        // Metrics across the full filtered set if paginated and totalCount > rawRecords.length
        if (isPaginated && totalCount > rawRecords.length) {
          let mQuery = supabase.from('practical_logs').select('status, present_students, total_students')
          if (!userCtx.isPrivileged && userCtx.userId) {
            mQuery = mQuery.or(`teacher_id.eq.${userCtx.userId},logged_by.eq.${userCtx.userId}`)
          }
          if (filters.selected_ids && filters.selected_ids.length > 0) {
            mQuery = mQuery.in('id', filters.selected_ids)
          } else {
            if (filters.academic_year_id && filters.academic_year_id !== 'all') mQuery = mQuery.eq('academic_year_id', filters.academic_year_id)
            if (filters.lab_id && filters.lab_id !== 'all') mQuery = mQuery.eq('lab_id', filters.lab_id)
            if (filters.status && filters.status !== 'all') mQuery = mQuery.eq('status', filters.status as any)
            if (filters.date_from) mQuery = mQuery.gte('date', filters.date_from)
            if (filters.date_to) mQuery = mQuery.lte('date', filters.date_to)
            if (filters.date) mQuery = mQuery.eq('date', filters.date)
            if (filters.batch_group && filters.batch_group !== 'all') {
              const aliases = getClassAliases(filters.batch_group)
              const orConds = aliases.map((a) => `batch_group.ilike.%${sanitizePostgrestSearch(a)}%`).join(',')
              mQuery = mQuery.or(orConds)
            }
            if (filters.subject_name && filters.subject_name !== 'all') mQuery = mQuery.ilike('subject_name', `%${filters.subject_name}%`)
            if (filters.period_label && filters.period_label !== 'all') mQuery = mQuery.ilike('period_label', `%${filters.period_label}%`)
            if (filters.remarks && filters.remarks.trim()) mQuery = mQuery.ilike('remarks', `%${filters.remarks.trim()}%`)
            if (filters.teacher_id && filters.teacher_id !== 'all') mQuery = mQuery.eq('teacher_id', filters.teacher_id)
            if (filters.search && filters.search.trim()) {
              const clean = sanitizePostgrestSearch(filters.search)
              if (clean) {
                mQuery = mQuery.or(`practical_title.ilike.%${clean}%,remarks.ilike.%${clean}%,batch_group.ilike.%${clean}%,subject_name.ilike.%${clean}%`)
              }
            }
          }
          const { data: mData } = await mQuery
          if (mData) {
            const conducted = mData.filter((r: any) => r.status !== 'skipped').length
            const skipped = mData.length - conducted
            const pres = mData.reduce((sum: number, r: any) => sum + (r.present_students || 0), 0)
            const enrolled = mData.reduce((sum: number, r: any) => sum + (r.total_students || 0), 0)
            metrics = {
              totalSessions: mData.length,
              conductedSessions: conducted,
              skippedSessions: skipped,
              totalPresent: pres,
              totalEnrolled: enrolled,
              averageAttendancePct: enrolled > 0 ? (pres / enrolled) * 100 : 0,
            }
          }
        }
      } catch (err) {
        console.warn('Supabase query failed:', err)
      }
    }

    // 2. Direct PostgreSQL fallback if Supabase query errored or is unconfigured
    if (!dbSuccess) {
      try {
        const pool = getPgPool()
        let sql = `
          SELECT 
            pl.*,
            json_build_object('id', l.id, 'name', l.name, 'type', l.type) AS labs,
            json_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) AS profiles,
            json_build_object('id', ay.id, 'name', ay.name, 'is_current', ay.is_current) AS academic_years
          FROM public.practical_logs pl
          LEFT JOIN public.labs l ON l.id = pl.lab_id
          LEFT JOIN public.profiles p ON p.id = pl.teacher_id
          LEFT JOIN public.academic_years ay ON ay.id = pl.academic_year_id
          WHERE 1=1
        `
        const pgParams: any[] = []
        if (filters.academic_year_id && filters.academic_year_id !== 'all') {
          pgParams.push(filters.academic_year_id)
          sql += ` AND pl.academic_year_id = $${pgParams.length}`
        }
        if (filters.lab_id && filters.lab_id !== 'all') {
          pgParams.push(filters.lab_id)
          sql += ` AND pl.lab_id = $${pgParams.length}`
        }
        if (filters.status && filters.status !== 'all') {
          pgParams.push(filters.status)
          sql += ` AND pl.status = $${pgParams.length}`
        }
        if (filters.date_from) {
          pgParams.push(filters.date_from)
          sql += ` AND pl.date >= $${pgParams.length}`
        }
        if (filters.date_to) {
          pgParams.push(filters.date_to)
          sql += ` AND pl.date <= $${pgParams.length}`
        }
        sql += ` ORDER BY pl.date DESC, pl.created_at DESC`
        const dbRes = await pool.query(sql, pgParams)
        rawRecords = dbRes.rows
        totalCount = dbRes.rows.length
        dbSuccess = true
      } catch (pgErr) {
        console.warn('Direct PG query fallback in getPracticalRecords failed:', pgErr)
      }
    }

    // 3. Memory fallback store ONLY if DB queries threw an error (completely offline)
    if (!dbSuccess && rawRecords.length === 0 && totalCount === 0) {
      const store = getPracticalStore()
      const filtered = store.filter((r) => {
        if (!userCtx.isPrivileged && r.teacher_id && r.teacher_id !== userCtx.userId) return false
        if (filters.selected_ids && filters.selected_ids.length > 0) {
          return filters.selected_ids.includes(r.id)
        }
        if (filters.academic_year_id && filters.academic_year_id !== 'all' && r.academic_year_id !== filters.academic_year_id) return false
        if (filters.lab_id && filters.lab_id !== 'all' && r.lab_id !== filters.lab_id && r.labs?.id !== filters.lab_id) return false
        if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false
        if (filters.date_from && r.date < filters.date_from) return false
        if (filters.date_to && r.date > filters.date_to) return false
        if (filters.batch_group && filters.batch_group !== 'all') {
          const aliases = getClassAliases(filters.batch_group)
          const matches = aliases.some((a) => r.batch_group?.toLowerCase().includes(a.toLowerCase()))
          if (!matches) return false
        }
        if (filters.subject_name && filters.subject_name !== 'all' && !r.subject_name?.toLowerCase().includes(filters.subject_name.toLowerCase())) return false
        if (filters.period_label && filters.period_label !== 'all' && r.period_label !== filters.period_label) return false
        if (filters.remarks && filters.remarks.trim() && !r.remarks?.toLowerCase().includes(filters.remarks.trim().toLowerCase())) return false
        if (filters.teacher_id && filters.teacher_id !== 'all' && r.teacher_id !== filters.teacher_id && r.profiles?.id !== filters.teacher_id) return false
        if (filters.teacher_name && filters.teacher_name.trim() && !r.profiles?.full_name?.toLowerCase().includes(filters.teacher_name.trim().toLowerCase())) return false
        if (filters.search && filters.search.trim()) {
          const q = sanitizePostgrestSearch(filters.search).toLowerCase()
          const matches =
            r.practical_title?.toLowerCase().includes(q) ||
            r.subject_name?.toLowerCase().includes(q) ||
            r.batch_group?.toLowerCase().includes(q) ||
            r.remarks?.toLowerCase().includes(q)
          if (!matches) return false
        }
        return true
      })

      // Sort memory store
      const sortKey = filters.sortKey
      const sortDirection = filters.sortDirection || 'desc'
      filtered.sort((a, b) => {
        if (sortKey === 'date') {
          return sortDirection === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
        }
        if (sortKey === 'period_label') {
          return sortDirection === 'asc' ? a.period_label.localeCompare(b.period_label) : b.period_label.localeCompare(a.period_label)
        }
        if (sortKey === 'batch_group') {
          return sortDirection === 'asc' ? a.batch_group.localeCompare(b.batch_group) : b.batch_group.localeCompare(a.batch_group)
        }
        if (sortKey === 'subject_name') {
          return sortDirection === 'asc' ? a.subject_name.localeCompare(b.subject_name) : b.subject_name.localeCompare(a.subject_name)
        }
        if (sortKey === 'practical_title' || sortKey === 'subject_title') {
          return sortDirection === 'asc' ? a.practical_title.localeCompare(b.practical_title) : b.practical_title.localeCompare(a.practical_title)
        }
        if (sortKey === 'teacher_name') {
          const nameA = a.profiles?.full_name || ''
          const nameB = b.profiles?.full_name || ''
          return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
        }
        if (sortKey === 'attendance') {
          const pctA = a.total_students > 0 ? a.present_students / a.total_students : 0
          const pctB = b.total_students > 0 ? b.present_students / b.total_students : 0
          return sortDirection === 'asc' ? pctA - pctB : pctB - pctA
        }
        if (sortKey === 'status') {
          return sortDirection === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status)
        }
        if (sortKey === 'facility' || sortKey === 'lab_id') {
          const nameA = a.labs?.name || a.lab_id || ''
          const nameB = b.labs?.name || b.lab_id || ''
          return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
        }
        return b.date.localeCompare(a.date)
      })

      totalCount = filtered.length
      const conducted = filtered.filter((r) => r.status !== 'skipped').length
      const skipped = totalCount - conducted
      const pres = filtered.reduce((acc, curr) => acc + (curr.present_students || 0), 0)
      const enrolled = filtered.reduce((acc, curr) => acc + (curr.total_students || 0), 0)
      metrics = {
        totalSessions: totalCount,
        conductedSessions: conducted,
        skippedSessions: skipped,
        totalPresent: pres,
        totalEnrolled: enrolled,
        averageAttendancePct: enrolled > 0 ? (pres / enrolled) * 100 : 0,
      }

      rawRecords = isPaginated ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered
    }

    if (dbSuccess && metrics.totalSessions === 0 && rawRecords.length > 0) {
      const conducted = rawRecords.filter((r) => r.status !== 'skipped').length
      const skipped = rawRecords.length - conducted
      const pres = rawRecords.reduce((acc, curr) => acc + (curr.present_students || 0), 0)
      const enrolled = rawRecords.reduce((acc, curr) => acc + (curr.total_students || 0), 0)
      metrics = {
        totalSessions: totalCount || rawRecords.length,
        conductedSessions: conducted,
        skippedSessions: skipped,
        totalPresent: pres,
        totalEnrolled: enrolled,
        averageAttendancePct: enrolled > 0 ? (pres / enrolled) * 100 : 0,
      }
    }

    // Format records
    const formattedRecords: PracticalRecordItem[] = rawRecords.map((r) => {
      const tot = r.total_students || 0
      const pres = r.present_students || 0
      const attPct = tot > 0 ? (pres / tot) * 100 : 0
      let subCode = r.subject_code || null
      let subName = r.subject_name || ''
      if (!subCode && subName) {
        const match = subName.match(/^([A-Z0-9-]+)\s*[-–—]\s*(.*)$/)
        if (match) {
          subCode = match[1].trim()
          subName = match[2].trim()
        }
      }
      const dateStr = normalizeDateToString(r.date || r.created_at)
      const createdAtStr = normalizeTimestampToString(r.created_at) || dateStr

      return {
        ...r,
        date: dateStr,
        created_at: createdAtStr,
        subject_code: subCode,
        subject_name: subName,
        attendance_pct: attPct,
        academic_year_id: r.academic_year_id || r.academic_years?.id || null,
        academic_year_name: r.academic_years?.name || null,
      }
    })

    // If unpaginated (e.g. export or print), compute metrics from all records if not already set
    if (!isPaginated || metrics.totalSessions === 0) {
      const tot = formattedRecords.length
      const conducted = formattedRecords.filter((r) => r.status !== 'skipped').length
      const skipped = tot - conducted
      const pres = formattedRecords.reduce((acc, curr) => acc + (curr.present_students || 0), 0)
      const enrolled = formattedRecords.reduce((acc, curr) => acc + (curr.total_students || 0), 0)
      metrics = {
        totalSessions: tot,
        conductedSessions: conducted,
        skippedSessions: skipped,
        totalPresent: pres,
        totalEnrolled: enrolled,
        averageAttendancePct: enrolled > 0 ? (pres / enrolled) * 100 : 0,
      }
      if (!isPaginated) {
        totalCount = tot
      }
    }

    // Grouping
    const sections: PracticalGroupedSection[] = []
    if (groupBy === 'none') {
      sections.push({
        groupKey: 'all',
        groupTitle: 'All Practical Records',
        subtotal: {
          groupKey: 'all',
          groupTitle: 'All Practical Records',
          totalSessions: metrics.totalSessions,
          conductedSessions: metrics.conductedSessions,
          skippedSessions: metrics.skippedSessions,
          totalEnrolled: metrics.totalEnrolled,
          totalPresent: metrics.totalPresent,
          totalAbsent: metrics.totalEnrolled - metrics.totalPresent,
          averageAttendancePct: metrics.averageAttendancePct,
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

        if (!groupMap.has(key)) groupMap.set(key, [])
        groupMap.get(key)!.push(rec)
      }

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

    const totalPages = isPaginated ? Math.ceil(totalCount / pageSize) : 1

    // Query available academic years for filter UI
    let academicYears: Array<{ id: string; name: string; isCurrent: boolean }> = []
    let activeAcademicYearId: string | undefined = undefined
    try {
      const pool = getPgPool()
      const ayRes = await pool.query(`
        SELECT id, name, is_current
        FROM public.academic_years
        ORDER BY is_current DESC, start_date DESC;
      `)
      academicYears = ayRes.rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        isCurrent: Boolean(r.is_current),
      }))
      activeAcademicYearId = academicYears.find((y) => y.isCurrent)?.id
    } catch (ayErr) {
      console.warn('Failed to query academic years in getPracticalRecords:', ayErr)
    }

    return {
      success: true,
      sections,
      records: formattedRecords,
      metrics,
      totalCount,
      page,
      pageSize,
      totalPages,
      userRole: userCtx.role,
      userName: userCtx.fullName,
      userScope: userCtx.userScope,
      academicYears,
      activeAcademicYearId,
    }
  } catch (e: any) {
    return {
      success: false,
      sections: [],
      records: [],
      metrics: {
        totalSessions: 0,
        conductedSessions: 0,
        skippedSessions: 0,
        totalPresent: 0,
        totalEnrolled: 0,
        averageAttendancePct: 0,
      },
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
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
  totalCount?: number
  page?: number
  pageSize?: number
  totalPages?: number
  userRole: string
  userId: string
  userName?: string
  userScope?: UserScopeContext
  academicYears?: Array<{ id: string; name: string; isCurrent: boolean }>
  activeAcademicYearId?: string | null
  error?: string
}> {
  try {
    const userCtx = await getCurrentUserContext()
    const isInstitutionalView = userCtx.isPrivileged || !userCtx.userId || userCtx.userId === 'local-admin' || (filters as any).scope !== 'my_incidents'
    let rawIncidents: any[] = []
    let totalCount = 0
    let dbSuccess = false

    const isPaginated = typeof filters.page === 'number' && typeof filters.pageSize === 'number'
    const page = isPaginated ? Math.max(1, filters.page!) : 1
    const pageSize = isPaginated ? Math.max(1, filters.pageSize!) : 10

    let metrics: IncidentSummaryMetrics = {
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
    }

    // Resolve date bounds for academic year filter if supplied
    let ayDateFrom: string | null = null
    let ayDateTo: string | null = null
    if (filters.academic_year_id && filters.academic_year_id !== 'all') {
      try {
        const pool = getPgPool()
        const ayRes = await pool.query('SELECT start_date, end_date FROM public.academic_years WHERE id = $1', [filters.academic_year_id])
        if (ayRes.rows.length > 0) {
          const ayRow = ayRes.rows[0]
          if (ayRow.start_date) {
            const d = new Date(ayRow.start_date)
            if (d.getFullYear() >= 2000 && d.getFullYear() <= 2050) {
              ayDateFrom = d.toISOString().split('T')[0]
            }
          }
          if (ayRow.end_date) {
            const d = new Date(ayRow.end_date)
            if (d.getFullYear() >= 2000 && d.getFullYear() <= 2050) {
              ayDateTo = d.toISOString().split('T')[0]
            }
          }
        }

        // Canonical Bikram Sambat mapping fallback (AD mapping: BS year - 57)
        // E.g. BS 2083 starts ~2026-04-13, ends ~2027-04-13
        if (!ayDateFrom || !ayDateTo) {
          const bsYearNum = parseInt(filters.academic_year_id, 10)
          if (!isNaN(bsYearNum) && bsYearNum >= 2000 && bsYearNum <= 2100) {
            const adStartYear = bsYearNum - 57
            ayDateFrom = `${adStartYear}-04-13`
            ayDateTo = `${adStartYear + 1}-04-13`
          }
        }
      } catch (e) {
        console.warn('Failed to resolve academic year date bounds for incidents:', e)
      }
    }

    const effectiveDateFrom = filters.date_from || ayDateFrom
    const effectiveDateTo = filters.date_to || ayDateTo

    // 1. First priority: Supabase query
    if (isSupabaseConfigured()) {
      try {
        const supabase = await createClient()
        let query = supabase
          .from('lab_incidents')
          .select(`
            *,
            labs (id, name, type)
          `, { count: 'exact' })

        if (!isInstitutionalView && userCtx.userId) {
          query = query.or(`reported_by_id.eq.${userCtx.userId},subject_teacher_name.eq.${userCtx.fullName},reported_by.eq.${userCtx.fullName}`)
        }

        // WHERE Filters: If selected_ids is provided, query strictly for selected rows
        if (filters.selected_ids && filters.selected_ids.length > 0) {
          query = query.in('id', filters.selected_ids)
        } else {
          if (filters.lab_id && filters.lab_id !== 'all') {
            query = query.eq('lab_id', filters.lab_id)
          }
          if (filters.severity && filters.severity !== 'all') {
            query = query.eq('severity', filters.severity as any)
          }
          if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status as any)
          }
          if (filters.incident_type && filters.incident_type !== 'all') {
            query = query.eq('incident_type', filters.incident_type)
          }
          if (effectiveDateFrom) {
            query = query.gte('date', effectiveDateFrom)
          }
          if (effectiveDateTo) {
            query = query.lte('date', effectiveDateTo)
          }
          if (filters.date) {
            query = query.eq('date', filters.date)
          }
          if (filters.equipment_name && filters.equipment_name.trim()) {
            query = query.ilike('equipment_name', `%${filters.equipment_name.trim()}%`)
          }
          if (filters.title && filters.title.trim()) {
            query = query.ilike('title', `%${filters.title.trim()}%`)
          }
          if (filters.batch_name && filters.batch_name.trim()) {
            const aliases = getClassAliases(filters.batch_name.trim())
            const orConds = aliases.map((a) => `batch_name.ilike.%${sanitizePostgrestSearch(a)}%`).join(',')
            query = query.or(orConds)
          }
          if (filters.teacher_name && filters.teacher_name.trim()) {
            query = query.ilike('subject_teacher_name', `%${filters.teacher_name.trim()}%`)
          }

          // Base-table Global Search with PostgREST sanitization (Requirement A & G)
          if (filters.search && filters.search.trim()) {
            const clean = sanitizePostgrestSearch(filters.search)
            if (clean) {
              query = query.or(`title.ilike.%${clean}%,equipment_name.ilike.%${clean}%,batch_name.ilike.%${clean}%,resolution_notes.ilike.%${clean}%`)
            }
          }
        }

        // Spec-driven Sorting & Universal Tiebreakers (Requirements B, E, F, H)
        const sortKey = filters.sortKey
        const sortDirection = filters.sortDirection || 'desc'
        const colSpec = incidentReportSpec.columns.find((c) => c.id === sortKey)

        if (sortKey && colSpec?.foreignTable) {
          query = query.order(colSpec.dbColumn || 'name', {
            foreignTable: colSpec.foreignTable,
            ascending: sortDirection === 'asc',
            nullsFirst: false,
          })
        } else if (sortKey && colSpec?.dbColumn) {
          query = query.order(colSpec.dbColumn, { ascending: sortDirection === 'asc' })
        }

        // Universal deterministic tiebreaker (Requirement E)
        if (sortKey !== 'date' && sortKey !== 'date_case') {
          query = query.order('date', { ascending: false })
        }
        if (sortKey !== 'created_at') {
          query = query.order('created_at', { ascending: false })
        }

        // SQL Pagination (.range)
        if (isPaginated) {
          const from = (page - 1) * pageSize
          const to = from + pageSize - 1
          query = query.range(from, to)
        }

        const { data, count, error } = await query
        if (!error && data && data.length > 0) {
          rawIncidents = data
          totalCount = typeof count === 'number' ? count : data.length
          dbSuccess = true
        }

        // If paginated and totalCount > rawIncidents.length, query metrics over full filtered set
        if (isPaginated && totalCount > rawIncidents.length) {
          let mQuery = supabase.from('lab_incidents').select('status, severity, resolved_at, created_at')
          if (!isInstitutionalView && userCtx.userId) {
            mQuery = mQuery.or(`reported_by_id.eq.${userCtx.userId},subject_teacher_name.eq.${userCtx.fullName},reported_by.eq.${userCtx.fullName}`)
          }
          if (filters.selected_ids && filters.selected_ids.length > 0) {
            mQuery = mQuery.in('id', filters.selected_ids)
          } else {
            if (filters.lab_id && filters.lab_id !== 'all') mQuery = mQuery.eq('lab_id', filters.lab_id)
            if (filters.severity && filters.severity !== 'all') mQuery = mQuery.eq('severity', filters.severity as any)
            if (filters.status && filters.status !== 'all') mQuery = mQuery.eq('status', filters.status as any)
            if (filters.incident_type && filters.incident_type !== 'all') mQuery = mQuery.eq('incident_type', filters.incident_type)
            if (effectiveDateFrom) mQuery = mQuery.gte('date', effectiveDateFrom)
            if (effectiveDateTo) mQuery = mQuery.lte('date', effectiveDateTo)
            if (filters.date) mQuery = mQuery.eq('date', filters.date)
            if (filters.equipment_name && filters.equipment_name.trim()) mQuery = mQuery.ilike('equipment_name', `%${filters.equipment_name.trim()}%`)
            if (filters.title && filters.title.trim()) mQuery = mQuery.ilike('title', `%${filters.title.trim()}%`)
            if (filters.batch_name && filters.batch_name.trim()) mQuery = mQuery.ilike('batch_name', `%${filters.batch_name.trim()}%`)
            if (filters.teacher_name && filters.teacher_name.trim()) mQuery = mQuery.ilike('subject_teacher_name', `%${filters.teacher_name.trim()}%`)
            if (filters.search && filters.search.trim()) {
              const clean = sanitizePostgrestSearch(filters.search)
              if (clean) {
                mQuery = mQuery.or(`title.ilike.%${clean}%,equipment_name.ilike.%${clean}%,batch_name.ilike.%${clean}%,resolution_notes.ilike.%${clean}%`)
              }
            }
          }
          const { data: mData } = await mQuery
          if (mData) {
            let totalResolvedHours = 0
            let resolvedWithDurationCount = 0
            for (const item of mData) {
              if (item.resolved_at && item.created_at) {
                const cMs = new Date(item.created_at).getTime()
                const rMs = new Date(item.resolved_at).getTime()
                if (rMs >= cMs) {
                  totalResolvedHours += (rMs - cMs) / (1000 * 60 * 60)
                  resolvedWithDurationCount++
                }
              }
            }
            const avgHours = resolvedWithDurationCount > 0 ? totalResolvedHours / resolvedWithDurationCount : null
            let avgLabel = 'N/A'
            if (avgHours !== null) {
              if (avgHours < 1) avgLabel = `${Math.round(avgHours * 60)} mins`
              else if (avgHours < 24) avgLabel = `${avgHours.toFixed(1)} hrs`
              else avgLabel = `${(avgHours / 24).toFixed(1)} days`
            }
            metrics = {
              totalIncidents: mData.length,
              openCount: mData.filter((i: any) => i.status !== 'resolved').length,
              resolvedCount: mData.filter((i: any) => i.status === 'resolved').length,
              underRepairCount: mData.filter((i: any) => i.status === 'under_repair').length,
              replacedCount: mData.filter((i: any) => i.status === 'replaced').length,
              escalatedCount: mData.filter((i: any) => i.status === 'escalated_to_hod').length,
              minorCount: mData.filter((i: any) => i.severity === 'minor').length,
              moderateCount: mData.filter((i: any) => i.severity === 'moderate').length,
              criticalCount: mData.filter((i: any) => i.severity === 'major_critical').length,
              averageTimeToResolveHours: avgHours,
              averageTimeToResolveLabel: avgLabel,
            }
          }
        }
      } catch (err) {
        console.warn('Supabase incident query failed:', err)
      }
    }

    // 2. Direct PostgreSQL fallback if Supabase query errored or is unconfigured
    if (!dbSuccess) {
      try {
        const pool = getPgPool()
        let sql = `
          SELECT 
            i.*,
            json_build_object('id', l.id, 'name', l.name, 'type', l.type) AS labs
          FROM public.lab_incidents i
          LEFT JOIN public.labs l ON l.id = i.lab_id
          WHERE 1=1
        `
        const pgParams: any[] = []
        if (filters.lab_id && filters.lab_id !== 'all') {
          pgParams.push(filters.lab_id)
          sql += ` AND i.lab_id = $${pgParams.length}`
        }
        if (filters.severity && filters.severity !== 'all') {
          pgParams.push(filters.severity)
          sql += ` AND i.severity = $${pgParams.length}`
        }
        if (filters.status && filters.status !== 'all') {
          pgParams.push(filters.status)
          sql += ` AND i.status = $${pgParams.length}`
        }
        if (effectiveDateFrom) {
          pgParams.push(effectiveDateFrom)
          sql += ` AND i.date >= $${pgParams.length}`
        }
        if (effectiveDateTo) {
          pgParams.push(effectiveDateTo)
          sql += ` AND i.date <= $${pgParams.length}`
        }
        if (filters.search && filters.search.trim()) {
          pgParams.push(`%${filters.search.trim()}%`)
          sql += ` AND (i.title ILIKE $${pgParams.length} OR i.equipment_name ILIKE $${pgParams.length} OR i.resolution_notes ILIKE $${pgParams.length})`
        }
        sql += ` ORDER BY i.date DESC, i.created_at DESC`
        const dbRes = await pool.query(sql, pgParams)
        rawIncidents = dbRes.rows
        totalCount = dbRes.rows.length
        dbSuccess = true
      } catch (pgErr) {
        console.warn('Direct PG query fallback in getIncidentRecords failed:', pgErr)
      }
    }

    // 3. Memory store fallback ONLY if DB query failed (completely offline)
    if (!dbSuccess && rawIncidents.length === 0 && totalCount === 0) {
      const store = getIncidentStore()
      const filtered = store.filter((inc) => {
        if (!isInstitutionalView && inc.reported_by_id && inc.reported_by_id !== userCtx.userId) {
          return false
        }
        if (filters.selected_ids && filters.selected_ids.length > 0) {
          return filters.selected_ids.includes(inc.id)
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
        if (filters.date && inc.date !== filters.date) return false
        if (filters.equipment_name && filters.equipment_name.trim() && !inc.equipment_name?.toLowerCase().includes(filters.equipment_name.trim().toLowerCase())) return false
        if (filters.title && filters.title.trim() && !inc.title?.toLowerCase().includes(filters.title.trim().toLowerCase())) return false
        if (filters.batch_name && filters.batch_name.trim()) {
          const aliases = getClassAliases(filters.batch_name.trim())
          const matches = aliases.some((a) => inc.batch_name?.toLowerCase().includes(a.toLowerCase()))
          if (!matches) return false
        }
        if (filters.teacher_name && filters.teacher_name.trim() && !inc.subject_teacher_name?.toLowerCase().includes(filters.teacher_name.trim().toLowerCase())) return false
        if (filters.search && filters.search.trim()) {
          const q = sanitizePostgrestSearch(filters.search).toLowerCase()
          const matches =
            inc.title?.toLowerCase().includes(q) ||
            inc.equipment_name?.toLowerCase().includes(q) ||
            inc.batch_name?.toLowerCase().includes(q) ||
            inc.resolution_notes?.toLowerCase().includes(q)
          if (!matches) return false
        }
        return true
      })

      // Sort memory store
      const sortKey = filters.sortKey
      const sortDirection = filters.sortDirection || 'desc'
      filtered.sort((a, b) => {
        if (sortKey === 'date' || sortKey === 'date_case') {
          const cmp = a.date.localeCompare(b.date)
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'facility') {
          const aVal = a.labs?.name || a.lab_id || ''
          const bVal = b.labs?.name || b.lab_id || ''
          const cmp = aVal.localeCompare(bVal)
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'equipment') {
          const cmp = (a.equipment_name || '').localeCompare(b.equipment_name || '')
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'title_circ') {
          const cmp = (a.title || '').localeCompare(b.title || '')
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'severity') {
          const cmp = (a.severity || '').localeCompare(b.severity || '')
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'status') {
          const cmp = (a.status || '').localeCompare(b.status || '')
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        } else if (sortKey === 'teacher_batch') {
          const cmp = (a.subject_teacher_name || '').localeCompare(b.subject_teacher_name || '')
          if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp
        }
        // Universal tiebreakers
        const dateCmp = b.date.localeCompare(a.date)
        if (dateCmp !== 0) return dateCmp
        return (b.created_at || '').localeCompare(a.created_at || '')
      })

      totalCount = filtered.length
      rawIncidents = isPaginated
        ? filtered.slice((page - 1) * pageSize, page * pageSize)
        : filtered
    }

    // Compute derived time-to-resolve and format
    let localTotalResolvedHours = 0
    let localResolvedWithDurationCount = 0

    const formattedIncidents: IncidentRecordItem[] = rawIncidents.map((inc) => {
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
          localTotalResolvedHours += hours
          localResolvedWithDurationCount++
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

      const dateStr = normalizeDateToString(inc.date || inc.created_at)
      const createdAtStr = normalizeTimestampToString(inc.created_at) || dateStr
      const resolvedAtStr = inc.resolved_at ? normalizeTimestampToString(inc.resolved_at) : null

      return {
        ...inc,
        date: dateStr,
        created_at: createdAtStr,
        resolved_at: resolvedAtStr,
        time_to_resolve_hours: timeToResolveHours,
        time_to_resolve_label: timeToResolveLabel,
      }
    })

    // If metrics weren't set from the full query or we're not paginated, calculate from formattedIncidents
    if (!isPaginated || metrics.totalIncidents === 0) {
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
        localResolvedWithDurationCount > 0 ? localTotalResolvedHours / localResolvedWithDurationCount : null
      let avgLabel = 'N/A'
      if (avgHours !== null) {
        if (avgHours < 1) avgLabel = `${Math.round(avgHours * 60)} mins`
        else if (avgHours < 24) avgLabel = `${avgHours.toFixed(1)} hrs`
        else avgLabel = `${(avgHours / 24).toFixed(1)} days`
      }

      metrics = {
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

      if (!isPaginated) {
        totalCount = totalIncidents
      }
    }

    const totalPages = isPaginated ? Math.ceil(totalCount / pageSize) : 1

    let academicYears: Array<{ id: string; name: string; isCurrent: boolean }> = []
    let activeAcademicYearId: string | null = null
    try {
      const pool = getPgPool()
      const ayRes = await pool.query(`
        SELECT id, name, is_current
        FROM public.academic_years
        ORDER BY is_current DESC, start_date DESC;
      `)
      academicYears = ayRes.rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        isCurrent: Boolean(r.is_current),
      }))
      activeAcademicYearId = academicYears.find((y) => y.isCurrent)?.id || null
    } catch (e) {
      console.warn('Failed to fetch academic years for incident filter:', e)
    }

    return {
      success: true,
      incidents: formattedIncidents,
      metrics,
      totalCount,
      page,
      pageSize,
      totalPages,
      userRole: userCtx.role,
      userId: userCtx.userId,
      userName: userCtx.fullName,
      userScope: userCtx.userScope,
      academicYears,
      activeAcademicYearId,
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
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
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
    const validReportedById = isValidUuid(userCtx.userId) ? userCtx.userId : null

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
      status: isCritical ? 'escalated_to_hod' : 'reported',
      escalated_to_hod: isCritical,
      escalation_reason: isCritical ? 'Critical damage requiring immediate HOD inspection' : null,
      escalated_at: isCritical ? new Date().toISOString() : null,
      resolution_notes: null,
      resolved_by: null,
      resolved_by_id: null,
      resolved_at: null,
      reported_by: userCtx.fullName,
      reported_by_id: validReportedById,
      created_at: new Date().toISOString(),
    }

    // 1. Persist to memory store
    const store = getIncidentStore()
    store.unshift(newRecord)


    // 3. Write to Supabase if configured
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
            title: `Equipment Triage: ${payload.equipment_name}`,
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
    revalidatePath('/print/incidents')
    revalidatePath('/admin')
    revalidatePath('/')
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
    const validUserId = isValidUuid(userCtx.userId) ? userCtx.userId : null

    const updates: any = {
      status: payload.status,
    }

    if (payload.resolution_notes !== undefined) {
      updates.resolution_notes = payload.resolution_notes.trim()
    }

    if (isResolving) {
      updates.resolved_by_id = validUserId
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
              title: `⚡ HOD Escalation: Equipment Incident #${incidentId}`,
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
    revalidatePath('/print/incidents')
    revalidatePath('/admin')
    revalidatePath('/')
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
  format: 'xlsx' | 'csv' = 'xlsx',
  options?: {
    visibleColumns?: string[]
    selectedIds?: string[]
    isAllMatchingSelected?: boolean
    sortKey?: string
    sortDirection?: 'asc' | 'desc'
  }
): Promise<{
  success: boolean
  base64?: string
  filename?: string
  contentType?: string
  error?: string
}> {
  try {
    const scope = resolveExportPrintScope({
      selectedIds: options?.selectedIds,
      isAllMatchingSelected: options?.isAllMatchingSelected,
      totalCount: 0,
      filters,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
    })

    // Invariant: Exports always fetch the entire filtered/selected dataset across all pages
    const exportFilters: PracticalRecordFilters = {
      ...filters,
      page: undefined,
      pageSize: undefined,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
      selected_ids: scope.mode === 'SELECTED_EXPLICIT' ? scope.selectedIds : undefined,
    }

    const data = await getPracticalRecords(exportFilters, groupBy)
    if (!data.success) throw new Error(data.error)

    // Re-resolve scope with actual totalCount for precise audit stamp
    const preciseScope = resolveExportPrintScope({
      selectedIds: options?.selectedIds,
      isAllMatchingSelected: options?.isAllMatchingSelected,
      totalCount: data.totalCount,
      filters,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
    })

    let resolvedYearName: string | undefined = undefined
    if (filters.academic_year_id && filters.academic_year_id !== 'all') {
      try {
        const pool = getPgPool()
        const ayRes = await pool.query(`SELECT name FROM public.academic_years WHERE id = $1;`, [filters.academic_year_id])
        if (ayRes.rows.length > 0) resolvedYearName = ayRes.rows[0].name
      } catch {}
    }

    const fromStr = filters.date_from || 'start'
    const toStr = filters.date_to || 'end'
    const yearPrefix = filters.academic_year_id && filters.academic_year_id !== 'all' ? `_ay-${filters.academic_year_id}` : ''
    const selPrefix = scope.mode === 'SELECTED_EXPLICIT' ? `_selected-${scope.selectedIds?.length || 0}` : ''
    const filename = `practical-records${yearPrefix}_${groupBy}${selPrefix}_${fromStr}_${toStr}.${format}`

    if (format === 'csv') {
      const csvContent = generatePracticalRecordsCsv(data.sections, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Laboratories',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
        academicYear: resolvedYearName || (filters.academic_year_id !== 'all' ? filters.academic_year_id : undefined),
        traceabilityNote: preciseScope.traceabilityNote,
        visibleColumns: options?.visibleColumns,
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
        academicYear: resolvedYearName || (filters.academic_year_id !== 'all' ? filters.academic_year_id : undefined),
        traceabilityNote: preciseScope.traceabilityNote,
        visibleColumns: options?.visibleColumns,
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

/**
 * Authoritative Server Action to fetch all institutional academic cycles
 * for filter dropdowns across records, logbooks, and print views.
 */
export async function getAcademicYearsForFilterAction(): Promise<{
  success: boolean
  data: Array<{ id: string; name: string; isCurrent: boolean }>
  activeYearId?: string
  error?: string
}> {
  try {
    const pool = getPgPool()
    const res = await pool.query(`
      SELECT id, name, is_current
      FROM public.academic_years
      ORDER BY is_current DESC, start_date DESC;
    `)
    const data = res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name),
      isCurrent: Boolean(r.is_current),
    }))
    const activeYearId = data.find((y) => y.isCurrent)?.id
    return { success: true, data, activeYearId }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, data: [], error: msg }
  }
}

export async function exportIncidentRecordsAction(
  filters: IncidentRecordFilters = {},
  format: 'xlsx' | 'csv' = 'xlsx',
  options?: {
    visibleColumns?: string[]
    selectedIds?: string[]
    isAllMatchingSelected?: boolean
    sortKey?: string
    sortDirection?: 'asc' | 'desc'
  }
): Promise<{
  success: boolean
  base64?: string
  filename?: string
  contentType?: string
  error?: string
}> {
  try {
    const scope = resolveExportPrintScope({
      selectedIds: options?.selectedIds,
      isAllMatchingSelected: options?.isAllMatchingSelected,
      totalCount: 0,
      filters,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
    })

    const exportFilters: IncidentRecordFilters = {
      ...filters,
      page: undefined,
      pageSize: undefined,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
      selected_ids: scope.mode === 'SELECTED_EXPLICIT' ? scope.selectedIds : undefined,
    }

    const data = await getIncidentRecords(exportFilters)
    if (!data.success) throw new Error(data.error)

    const preciseScope = resolveExportPrintScope({
      selectedIds: options?.selectedIds,
      isAllMatchingSelected: options?.isAllMatchingSelected,
      totalCount: data.totalCount || data.incidents.length,
      filters,
      sortKey: options?.sortKey || filters.sortKey,
      sortDirection: options?.sortDirection || filters.sortDirection,
    })

    const fromStr = filters.date_from || 'start'
    const toStr = filters.date_to || 'end'
    const selPrefix = scope.mode === 'SELECTED_EXPLICIT' ? `_selected-${scope.selectedIds?.length || 0}` : ''
    const filename = `incident-records${selPrefix}_${fromStr}_${toStr}.${format}`

    if (format === 'csv') {
      const csvContent = generateIncidentRecordsCsv(data.incidents, {
        labName: filters.lab_id ? filters.lab_id.toUpperCase() : 'All Facilities',
        dateRange: `${filters.date_from || 'Earliest'} to ${filters.date_to || 'Latest'}`,
        traceabilityNote: preciseScope.traceabilityNote,
        visibleColumns: options?.visibleColumns,
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
        traceabilityNote: preciseScope.traceabilityNote,
        visibleColumns: options?.visibleColumns,
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
