import { getPgPool } from '@/lib/db'

export const SLOT_ORDER = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10']

export function getSlotRange(startSlotId?: string | null, span: number = 1): { start: number; end: number } {
  if (!startSlotId) return { start: 0, end: Math.max(0, span - 1) }
  const cleanId = startSlotId.toLowerCase()
  const startIdx = SLOT_ORDER.indexOf(cleanId)
  const safeStart = startIdx === -1 ? 0 : startIdx
  return {
    start: safeStart,
    end: safeStart + Math.max(1, span || 1) - 1,
  }
}

export function slotRangesOverlap(
  r1: { start: number; end: number },
  r2: { start: number; end: number }
): boolean {
  return r1.start <= r2.end && r1.end >= r2.start
}

export function timeRangesOverlap(
  start1?: string | null,
  end1?: string | null,
  start2?: string | null,
  end2?: string | null
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return true
  // Format HH:MM string comparison
  return start1 < end2 && end1 > start2
}

export interface CheckSchedulingConflictParams {
  labId: string
  secondaryLabId?: string | null
  teacherId?: string | null
  teacherName?: string | null
  classSubjectId?: string | null
  classId?: string | null
  batchName?: string | null
  dayKey: string
  slotId?: string | null
  span?: number
  startTime?: string | null
  endTime?: string | null
  excludeScheduleId?: string | null
}

export interface ConflictDetail {
  type: 'room' | 'faculty' | 'cohort' | 'lab_status'
  message: string
  conflictingSchedule?: {
    id: string
    subject_name: string
    batch_name: string
    lab_id: string
    slot_id: string
    start_time: string
    end_time: string
    teacher_name?: string
  }
}

export interface ConflictCheckResult {
  hasConflict: boolean
  conflictType: 'none' | 'room' | 'faculty' | 'cohort' | 'lab_status'
  message: string | null
  conflicts: ConflictDetail[]
}

/**
 * Institutional Triple-Collision Defense Engine
 * Evaluates Room, Faculty, and Cohort double-booking across weekly academic timetable slots.
 */
export async function checkSchedulingConflicts(
  params: CheckSchedulingConflictParams
): Promise<ConflictCheckResult> {
  const pool = getPgPool()
  const conflicts: ConflictDetail[] = []

  // 1. Verify Target Lab Operational Status
  const labRes = await pool.query(
    `SELECT id, name, status, is_active FROM public.labs WHERE id = $1`,
    [params.labId]
  )
  if (labRes.rows.length > 0) {
    const lab = labRes.rows[0]
    if (lab.status === 'Under Maintenance') {
      const msg = `Booking Rejected: "${lab.name || params.labId}" is currently Under Maintenance and cannot be booked for practical sessions.`
      return {
        hasConflict: true,
        conflictType: 'lab_status',
        message: msg,
        conflicts: [{ type: 'lab_status', message: msg }],
      }
    }
    if (!lab.is_active || lab.status === 'Inactive') {
      const msg = `Booking Rejected: "${lab.name || params.labId}" is currently Inactive / Decommissioned.`
      return {
        hasConflict: true,
        conflictType: 'lab_status',
        message: msg,
        conflicts: [{ type: 'lab_status', message: msg }],
      }
    }
  }

  // 2. Resolve Target Class ID if classSubjectId is provided
  let targetClassId = params.classId || null
  let resolvedTeacherId = params.teacherId || null

  if (params.classSubjectId) {
    const csRes = await pool.query(
      `SELECT class_id, teacher_id FROM public.class_subjects WHERE id = $1`,
      [params.classSubjectId]
    )
    if (csRes.rows.length > 0) {
      if (!targetClassId) targetClassId = csRes.rows[0].class_id
      if (!resolvedTeacherId) resolvedTeacherId = csRes.rows[0].teacher_id
    }
  }

  // 3. Query all active schedules for the specified day of week
  const schedRes = await pool.query(
    `SELECT 
       s.id,
       s.lab_id,
       s.teacher_id,
       s.subject_name,
       s.batch_name,
       s.slot_id,
       s.span,
       s.start_time,
       s.end_time,
       s.metadata,
       s.class_subject_id,
       cs.class_id
     FROM public.schedules s
     LEFT JOIN public.class_subjects cs ON cs.id = s.class_subject_id
     WHERE LOWER(s.day_key) = LOWER($1)
       AND s.status != 'cancelled'`,
    [params.dayKey]
  )

  const targetRange = getSlotRange(params.slotId, params.span || 1)
  const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : '')

  for (const existing of schedRes.rows) {
    if (params.excludeScheduleId && existing.id === params.excludeScheduleId) {
      continue
    }

    const existRange = getSlotRange(existing.slot_id || 't1', existing.span || 1)
    const slotOverlaps = slotRangesOverlap(targetRange, existRange)
    const timeOverlaps = timeRangesOverlap(
      params.startTime,
      params.endTime,
      existing.start_time,
      existing.end_time
    )

    // Consider overlapping if either slot range or custom time window collides
    const hasOverlap = params.slotId && existing.slot_id ? slotOverlaps : timeOverlaps

    if (!hasOverlap) {
      continue
    }

    const existSecLabId = existing.metadata?.secondary_lab_id || existing.metadata?.secondaryLabKey
    const conflictScheduleSummary = {
      id: existing.id,
      subject_name: existing.subject_name,
      batch_name: existing.batch_name,
      lab_id: existing.lab_id,
      slot_id: existing.slot_id,
      start_time: existing.start_time,
      end_time: existing.end_time,
      teacher_name: existing.metadata?.teacher,
    }

    // A. Room / Facility Collision
    const primaryCollides = existing.lab_id === params.labId || existSecLabId === params.labId
    const secondaryCollides =
      params.secondaryLabId &&
      (existing.lab_id === params.secondaryLabId || existSecLabId === params.secondaryLabId)

    if (primaryCollides || secondaryCollides) {
      const conflictingLab = primaryCollides ? params.labId : params.secondaryLabId
      const msg = `Facility Collision: Laboratory (${conflictingLab}) is already reserved for "${existing.subject_name}" (${existing.batch_name}) during Period ${existing.slot_id?.toUpperCase() || ''}.`
      conflicts.push({
        type: 'room',
        message: msg,
        conflictingSchedule: conflictScheduleSummary,
      })
    }

    // B. Faculty Collision (Assigned Teacher double-booked)
    const sameTeacherId =
      resolvedTeacherId && existing.teacher_id && resolvedTeacherId === existing.teacher_id
    const reqTeacherName = norm(params.teacherName)
    const existTeacherName = norm(existing.metadata?.teacher)
    const sameTeacherName = reqTeacherName && existTeacherName && reqTeacherName === existTeacherName

    if (sameTeacherId || sameTeacherName) {
      const teacherDisplay = params.teacherName || 'The assigned teacher'
      const msg = `Faculty Collision: ${teacherDisplay} is already conducting "${existing.subject_name}" in another laboratory during this period.`
      conflicts.push({
        type: 'faculty',
        message: msg,
        conflictingSchedule: conflictScheduleSummary,
      })
    }

    // C. Cohort Collision (Student batch double-booked)
    const existClassId = existing.class_id
    const sameClassId = targetClassId && existClassId && targetClassId === existClassId
    const normReqBatch = norm(params.batchName)
    const normExistBatch = norm(existing.batch_name)
    const sameBatchName =
      normReqBatch &&
      normExistBatch &&
      (normReqBatch === normExistBatch ||
        (normReqBatch.length > 5 && normExistBatch === normReqBatch))

    if (sameClassId || (sameBatchName && !sameClassId)) {
      const batchDisplay = params.batchName || 'Student cohort'
      const msg = `Class Batch Collision: Student cohort "${batchDisplay}" is already scheduled for "${existing.subject_name}" in another lab during this period.`
      conflicts.push({
        type: 'cohort',
        message: msg,
        conflictingSchedule: conflictScheduleSummary,
      })
    }
  }

  if (conflicts.length > 0) {
    const primaryConflict = conflicts[0]
    return {
      hasConflict: true,
      conflictType: primaryConflict.type,
      message: primaryConflict.message,
      conflicts,
    }
  }

  return {
    hasConflict: false,
    conflictType: 'none',
    message: null,
    conflicts: [],
  }
}
