'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getPgPool } from '@/lib/db'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import { recordAuditEvent, recordWorkstationIssueStatusAudit } from '@/lib/audit/audit-ledger'
import type {
  WorkstationBoardData,
  WorkstationWithIssues,
  WorkstationIssueRecord,
  WorkstationPhoto,
  UpdateWorkstationPositionInput,
  ReportWorkstationIssueInput,
  ResolveWorkstationIssueInput,
  CreateWorkstationInput,
  UpdateWorkstationInput,
  IssueCategoryInput,
  DiagnosticsTriageData,
  DiagnosticsTriageMetrics,
} from '@/types/workstations'
import type {
  WorkstationRow,
  IssueCategoryRow,
  WorkstationIssueRow,
  WorkstationUpdate,
  IssueCategoryUpdate,
  Json,
} from '@/types/database'

export type {
  WorkstationBoardData,
  WorkstationWithIssues,
  WorkstationIssueRecord,
  WorkstationPhoto,
  UpdateWorkstationPositionInput,
  ReportWorkstationIssueInput,
  ResolveWorkstationIssueInput,
  CreateWorkstationInput,
  UpdateWorkstationInput,
  IssueCategoryInput,
  DiagnosticsTriageData,
  DiagnosticsTriageMetrics,
}

const SEVERITY_WEIGHTS: Record<'low' | 'medium' | 'high' | 'critical', number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

/**
 * Validates user privileges for administrative actions.
 */
async function getAuthContext() {
  const scope = await getServerUserScope()
  const isPrivileged =
    scope.isPrivileged ||
    scope.role === 'super_admin' ||
    scope.role === 'lab_incharge' ||
    scope.role === 'hod' ||
    process.env.NODE_ENV === 'development'

  return { scope, isPrivileged }
}

/**
 * Fetch all workstations, active categories, and open issues for a given laboratory.
 */
export async function getWorkstationBoardData(targetLabId: string = 'comp'): Promise<WorkstationBoardData> {
  const { scope, isPrivileged } = await getAuthContext()
  const supabase = await createClient()

  // 1. Fetch Lab Details
  const { data: labData } = await supabase
    .from('labs')
    .select('id, name, status, is_active')
    .eq('id', targetLabId)
    .single()

  const labName = labData?.name || 'Computer Lab'

  // 2. Fetch Active Categories
  const { data: categoriesData, error: catErr } = await supabase
    .from('issue_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (catErr) {
    console.error('Error fetching issue categories:', catErr)
  }
  const categories: IssueCategoryRow[] = categoriesData || []
  const categoryMap = new Map<string, IssueCategoryRow>()
  categories.forEach((cat) => categoryMap.set(cat.id, cat))

  // 3. Fetch Workstations in this Lab
  const { data: wsData, error: wsErr } = await supabase
    .from('workstations')
    .select('*')
    .eq('lab_id', targetLabId)
    .eq('is_active', true)
    .order('label', { ascending: true })

  if (wsErr) {
    console.error('Error fetching workstations:', wsErr)
  }
  const rawWorkstations: WorkstationRow[] = wsData || []

  // If lab 'comp' has 0 workstations, attempt auto-seed check
  let workstationsList = rawWorkstations
  if (workstationsList.length === 0 && targetLabId === 'comp') {
    // Attempt fallback query without active filter or fallback empty list
    const { data: anyWs } = await supabase
      .from('workstations')
      .select('*')
      .eq('lab_id', targetLabId)
    if (anyWs && anyWs.length > 0) {
      workstationsList = anyWs
    }
  }

  // 4. Fetch Active Issues for Workstations in this Lab
  const wsIds = workstationsList.map((w) => w.id)
  let rawIssues: WorkstationIssueRow[] = []
  if (wsIds.length > 0) {
    const { data: issuesData, error: issuesErr } = await supabase
      .from('workstation_issues')
      .select('*')
      .in('workstation_id', wsIds)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })

    if (issuesErr) {
      console.error('Error fetching workstation issues:', issuesErr)
    }
    rawIssues = issuesData || []
  }

  // 5. Fetch Active Floor Landmarks for this Lab
  const { data: floorData } = await supabase
    .from('lab_floor_elements')
    .select('*')
    .eq('lab_id', targetLabId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  const floorElements = (floorData || []) as any[]

  // Map issues by workstation ID
  const issuesByWs = new Map<string, WorkstationIssueRecord[]>()
  const allActiveIssues: WorkstationIssueRecord[] = []

  rawIssues.forEach((issue) => {
    let photosParsed: WorkstationPhoto[] = []
    if (Array.isArray(issue.photos)) {
      photosParsed = issue.photos as unknown as WorkstationPhoto[]
    } else if (typeof issue.photos === 'string') {
      try {
        photosParsed = JSON.parse(issue.photos)
      } catch {}
    }

    const wsRecord = workstationsList.find((w) => w.id === issue.workstation_id)
    const issueRec: WorkstationIssueRecord = {
      id: issue.id,
      workstation_id: issue.workstation_id,
      workstation_label: wsRecord?.label,
      lab_id: targetLabId,
      category_id: issue.category_id,
      category: issue.category_id ? categoryMap.get(issue.category_id) || null : null,
      title: issue.title,
      description: issue.description,
      severity: issue.severity as 'low' | 'medium' | 'high' | 'critical',
      status: issue.status as 'open' | 'acknowledged' | 'in_progress' | 'resolved',
      reported_by_id: issue.reported_by_id,
      reported_by_name: issue.reported_by_name,
      photos: photosParsed,
      resolved_by_id: issue.resolved_by_id,
      resolved_by_name: issue.resolved_by_name,
      resolution_notes: issue.resolution_notes,
      resolved_at: issue.resolved_at,
      linked_maintenance_log_id: issue.linked_maintenance_log_id,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }

    allActiveIssues.push(issueRec)
    const existing = issuesByWs.get(issue.workstation_id) || []
    existing.push(issueRec)
    issuesByWs.set(issue.workstation_id, existing)
  })

  // 5. Build Workstations with Derived Health Status
  let totalOperational = 0
  let totalFlagged = 0
  let totalUnderRepair = 0

  const workstationsWithIssues: WorkstationWithIssues[] = workstationsList.map((ws) => {
    const activeIssues = issuesByWs.get(ws.id) || []
    const openCount = activeIssues.length

    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' | null = null
    let maxWeight = 0
    let hasInProgress = false

    activeIssues.forEach((iss) => {
      const w = SEVERITY_WEIGHTS[iss.severity] || 1
      if (w > maxWeight) {
        maxWeight = w
        highestSeverity = iss.severity
      }
      if (iss.status === 'in_progress') {
        hasInProgress = true
      }
    })

    let status: 'operational' | 'flagged' | 'under_repair' = 'operational'
    if (openCount > 0) {
      if (hasInProgress) {
        status = 'under_repair'
        totalUnderRepair++
      } else {
        status = 'flagged'
        totalFlagged++
      }
    } else {
      totalOperational++
    }

    return {
      ...ws,
      open_issues_count: openCount,
      highest_severity: highestSeverity,
      status,
      active_issues: activeIssues,
    }
  })

  return {
    lab_id: targetLabId,
    lab_name: labName,
    workstations: workstationsWithIssues,
    categories,
    active_issues: allActiveIssues,
    floor_elements: floorElements,
    metrics: {
      total: workstationsWithIssues.length,
      operational: totalOperational,
      flagged: totalFlagged,
      under_repair: totalUnderRepair,
      open_issues_count: allActiveIssues.length,
    },
    is_privileged: isPrivileged,
    user_role: scope.role,
    user_id: scope.userId,
    user_name: scope.fullName,
  }
}

/**
 * Batch update workstation normalized floor coordinates (Admin/In-Charge only).
 */
export async function updateWorkstationPositions(
  positions: UpdateWorkstationPositionInput[]
): Promise<{ success: boolean; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Only Administrators and Lab In-Charges can modify workstation layout.' }
  }

  if (!positions || positions.length === 0) {
    return { success: true }
  }

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const item of positions) {
      const clampedX = Math.max(0, Math.min(100, Math.round(item.pos_x * 10) / 10))
      const clampedY = Math.max(0, Math.min(100, Math.round(item.pos_y * 10) / 10))
      await client.query(
        `UPDATE public.workstations SET pos_x = $1, pos_y = $2, updated_at = NOW() WHERE id = $3`,
        [clampedX, clampedY, item.id]
      )
    }
    await client.query('COMMIT')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true }
  } catch (err: unknown) {
    await client.query('ROLLBACK')
    const msg = err instanceof Error ? err.message : 'Unknown position update error'
    return { success: false, error: msg }
  } finally {
    client.release()
  }
}

/**
 * Create a new physical workstation node (Admin/In-Charge only).
 */
export async function createWorkstation(
  input: CreateWorkstationInput
): Promise<{ success: boolean; data?: WorkstationRow; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to add workstations.' }
  }

  const pool = getPgPool()
  const clampedX = Math.max(0, Math.min(100, input.pos_x ?? 50.0))
  const clampedY = Math.max(0, Math.min(100, input.pos_y ?? 50.0))

  try {
    const res = await pool.query<WorkstationRow>(
      `INSERT INTO public.workstations (lab_id, label, row_label, position_id, pos_x, pos_y, device_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        input.lab_id,
        input.label.trim(),
        input.row_label?.trim() || null,
        input.position_id?.trim() || null,
        clampedX,
        clampedY,
        input.device_type || 'desktop',
      ]
    )
    revalidatePath('/admin')
    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true, data: res.rows[0] }
  } catch (error: any) {
    console.error('Error creating workstation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update workstation metadata (Admin/In-Charge only).
 */
export async function updateWorkstation(
  input: UpdateWorkstationInput
): Promise<{ success: boolean; data?: WorkstationRow; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required.' }
  }

  const pool = getPgPool()
  try {
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (input.label !== undefined) {
      updates.push(`label = $${idx++}`)
      values.push(input.label.trim())
    }
    if (input.row_label !== undefined) {
      updates.push(`row_label = $${idx++}`)
      values.push(input.row_label?.trim() || null)
    }
    if (input.position_id !== undefined) {
      updates.push(`position_id = $${idx++}`)
      values.push(input.position_id?.trim() || null)
    }
    if (input.device_type !== undefined) {
      updates.push(`device_type = $${idx++}`)
      values.push(input.device_type)
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`)
      values.push(input.is_active)
    }
    if (input.pos_x !== undefined) {
      updates.push(`pos_x = $${idx++}`)
      values.push(Math.max(0, Math.min(100, input.pos_x)))
    }
    if (input.pos_y !== undefined) {
      updates.push(`pos_y = $${idx++}`)
      values.push(Math.max(0, Math.min(100, input.pos_y)))
    }

    updates.push(`updated_at = NOW()`)
    values.push(input.id)

    const query = `
      UPDATE public.workstations
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `
    const res = await pool.query<WorkstationRow>(query, values)
    if (res.rows.length === 0) {
      return { success: false, error: 'Workstation not found.' }
    }

    revalidatePath('/admin')
    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true, data: res.rows[0] }
  } catch (error: any) {
    console.error('Error updating workstation:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Smart Deletion Guard: Safely deletes or decommissions a workstation node (Admin/In-Charge only).
 * 1. Blocks deletion if active unresolved fault tickets exist on the machine.
 * 2. Cleans up associated seat plan assignments and session overrides.
 * 3. Attempts hard DELETE, falling back gracefully to soft deactivation if FKs constrain.
 * 4. Records structured audit ledger event.
 */
export async function deleteWorkstation(
  id: string
): Promise<{ success: boolean; deletedLabel?: string; error?: string }> {
  const { isPrivileged, scope } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to delete workstations.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Verify existence & fetch metadata
    const { rows: wsRows } = await client.query(
      `SELECT id, lab_id, label, row_label, device_type FROM public.workstations WHERE id = $1`,
      [id]
    )
    if (wsRows.length === 0) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Workstation not found.' }
    }
    const ws = wsRows[0]

    // 2. Smart Deletion Guard: Check for active unresolved issues
    const { rows: issueCountRows } = await client.query(
      `SELECT COUNT(*)::int as count FROM public.workstation_issues WHERE workstation_id = $1 AND status != 'resolved'`,
      [id]
    )
    const activeIssuesCount = issueCountRows[0]?.count || 0
    if (activeIssuesCount > 0) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Cannot delete ${ws.label}: ${activeIssuesCount} active fault ticket(s) unresolved. Resolve tickets before removing hardware.`,
      }
    }

    // 3. Clean up seat plan links and session overrides
    await client.query(`DELETE FROM public.workstation_seat_plans WHERE workstation_id = $1`, [id])
    await client.query(`DELETE FROM public.session_seat_overrides WHERE workstation_id = $1`, [id])

    // 4. Attempt hard DELETE; if FK constraints block (e.g. historical log snapshots), soft-decommission
    let wasHardDeleted = false
    try {
      await client.query(`DELETE FROM public.workstations WHERE id = $1`, [id])
      wasHardDeleted = true
    } catch (fkErr) {
      console.warn(`Foreign key prevented hard deletion of workstation ${ws.label}, soft-decommissioning:`, fkErr)
      await client.query(
        `UPDATE public.workstations SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [id]
      )
    }

    await client.query('COMMIT')

    // 5. Record Audit Event
    await recordAuditEvent({
      action: 'DELETE',
      entityType: 'workstation',
      entityId: id,
      entityLabel: `Workstation ${ws.label} (${ws.device_type}) ${wasHardDeleted ? 'purged' : 'decommissioned'} from lab ${ws.lab_id}`,
      before: ws,
      after: null,
      metadata: {
        wasHardDeleted,
        performedBy: scope.fullName || scope.email,
      },
    })

    revalidatePath('/admin')
    revalidatePath('/computer-lab')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')

    return { success: true, deletedLabel: ws.label }
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error in deleteWorkstation:', error)
    return { success: false, error: error.message }
  } finally {
    client.release()
  }
}

/**
 * Report an issue on a workstation (Available to all authenticated teachers and staff).
 */
export async function reportWorkstationIssue(
  input: ReportWorkstationIssueInput
): Promise<{ success: boolean; issue?: WorkstationIssueRow; error?: string }> {
  const { scope } = await getAuthContext()
  if (!scope.userId) {
    return { success: false, error: 'Authentication required to report issues.' }
  }

  if (!input.title || input.title.trim().length === 0) {
    return { success: false, error: 'Issue title is required.' }
  }

  const supabase = await createClient()

  // Retrieve workstation to verify existence and lab
  const { data: wsData, error: wsErr } = await supabase
    .from('workstations')
    .select('id, lab_id, label')
    .eq('id', input.workstation_id)
    .single()

  if (wsErr || !wsData) {
    return { success: false, error: 'Workstation not found.' }
  }

  const photosJson = JSON.stringify(input.photos || [])

  const { data: newIssue, error: insertErr } = await supabase
    .from('workstation_issues')
    .insert({
      workstation_id: input.workstation_id,
      category_id: input.category_id || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      severity: input.severity || 'medium',
      status: 'open',
      reported_by_id: scope.userId,
      reported_by_name: scope.fullName,
      photos: (input.photos || []) as unknown as Json,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('Error reporting workstation issue:', insertErr)
    return { success: false, error: insertErr.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/maintenance/workstations')

  if (newIssue) {
    await recordAuditEvent({
      action: 'CREATE',
      entityType: 'workstation_issue',
      entityId: newIssue.id,
      entityLabel: `Issue Reported on ${wsData.label}: ${input.title.trim()}`,
      after: {
        workstation_id: input.workstation_id,
        workstation_label: wsData.label,
        title: input.title.trim(),
        severity: input.severity || 'medium',
        status: 'open',
      },
      metadata: {
        reported_by: scope.fullName,
      },
    })
  }

  return { success: true, issue: newIssue }
}

/**
 * Resolve an issue and optionally record a certified entry in the Service Logbook (Admin/In-Charge only).
 */
export async function resolveWorkstationIssue(
  input: ResolveWorkstationIssueInput
): Promise<{ success: boolean; error?: string }> {
  const { scope, isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Only Administrators and Lab In-Charges can resolve issues.' }
  }

  if (!input.resolution_notes || input.resolution_notes.trim().length === 0) {
    return { success: false, error: 'Resolution notes are required to certify issue closure.' }
  }

  const supabase = await createClient()

  // 1. Fetch Issue and Workstation info
  const { data: issueData, error: issueErr } = await supabase
    .from('workstation_issues')
    .select(`
      *,
      workstation:workstations(id, lab_id, label)
    `)
    .eq('id', input.issue_id)
    .single()

  if (issueErr || !issueData) {
    return { success: false, error: 'Issue record not found.' }
  }

  const workstation = issueData.workstation as unknown as { id: string; lab_id: string; label: string } | null
  const labId = workstation?.lab_id || 'comp'
  const assetIdentifier = workstation?.label || 'Workstation'

  let linkedLogId: string | null = null

  // 2. Optionally create certified Service Log in maintenance_logs
  if (input.create_maintenance_log !== false) {
    const todayStr = new Date().toISOString().split('T')[0]
    const workPerformedText = `Issue Resolved: ${issueData.title}. Notes: ${input.resolution_notes.trim()}`
    const checklistCompleted = [
      `Diagnostic: ${issueData.title}`,
      'Corrective Action Completed',
      'System Certified Operational',
    ]

    const { data: logData, error: logErr } = await supabase
      .from('maintenance_logs')
      .insert({
        lab_id: labId,
        asset_identifier: assetIdentifier,
        work_performed: workPerformedText,
        checklist_completed: checklistCompleted,
        parts_replaced: input.parts_replaced?.trim() || null,
        cost_incurred: 0, // Zero pricing rule
        service_date: todayStr,
        performed_by_id: scope.userId,
        remarks: `Auto-logged from Workstation Issue Resolution (Issue ID: ${input.issue_id})`,
      })
      .select('id')
      .single()

    if (logErr) {
      console.warn('Warning: Could not create linked maintenance log entry:', logErr)
    } else if (logData) {
      linkedLogId = logData.id
    }
  }

  // 3. Update Issue as Resolved
  const { error: updateErr } = await supabase
    .from('workstation_issues')
    .update({
      status: 'resolved',
      resolved_by_id: scope.userId,
      resolved_by_name: scope.fullName,
      resolution_notes: input.resolution_notes.trim(),
      resolved_at: new Date().toISOString(),
      linked_maintenance_log_id: linkedLogId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.issue_id)

  if (updateErr) {
    console.error('Error resolving workstation issue:', updateErr)
    return { success: false, error: updateErr.message }
  }

  // Record Audit Event for Issue Resolution
  await recordWorkstationIssueStatusAudit({
    issueId: input.issue_id,
    workstationLabel: assetIdentifier,
    beforeStatus: issueData.status,
    afterStatus: 'resolved',
    resolutionNotes: input.resolution_notes.trim(),
  })

  revalidatePath('/maintenance')
  revalidatePath('/maintenance/workstations')
  revalidatePath('/computer-lab')
  return { success: true }
}

/**
 * Update workstation issue status (e.g. Mark Under Repair, Reopen, or Quick Resolve).
 * Admin/In-Charge only.
 */
export async function updateWorkstationIssueStatus(
  issueId: string,
  newStatus: 'open' | 'in_progress' | 'resolved',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { scope, isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to change issue status.' }
  }

  const supabase = await createClient()

  // 1. Fetch current issue
  const { data: issueData, error: issueErr } = await supabase
    .from('workstation_issues')
    .select(`
      *,
      workstation:workstations(id, lab_id, label)
    `)
    .eq('id', issueId)
    .single()

  if (issueErr || !issueData) {
    return { success: false, error: 'Issue record not found.' }
  }

  const workstation = issueData.workstation as unknown as { id: string; lab_id: string; label: string } | null
  const assetIdentifier = workstation?.label || 'Workstation'

  const updateFields: any = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'resolved') {
    updateFields.resolved_at = new Date().toISOString()
    updateFields.resolved_by_id = scope.userId
    updateFields.resolved_by_name = scope.fullName
    if (notes) updateFields.resolution_notes = notes.trim()
  } else if (newStatus === 'in_progress') {
    updateFields.resolved_at = null
    updateFields.resolved_by_id = null
  }

  const { error: updateErr } = await supabase
    .from('workstation_issues')
    .update(updateFields)
    .eq('id', issueId)

  if (updateErr) {
    console.error('Error updating workstation issue status:', updateErr)
    return { success: false, error: updateErr.message }
  }

  await recordWorkstationIssueStatusAudit({
    issueId,
    workstationLabel: assetIdentifier,
    beforeStatus: issueData.status,
    afterStatus: newStatus,
    resolutionNotes: notes || `Status changed from ${issueData.status} to ${newStatus}`,
  })

  revalidatePath('/maintenance')
  revalidatePath('/maintenance/workstations')
  revalidatePath('/computer-lab')
  return { success: true }
}

/**
 * Fetch comprehensive diagnostics, hardware health, and all reported issues (including resolved) for a lab.
 */
export async function getDiagnosticsTriageData(targetLabId: string = 'comp'): Promise<DiagnosticsTriageData> {
  const { isPrivileged } = await getAuthContext()
  const supabase = await createClient()

  // 1. Fetch Lab Details
  const { data: labData } = await supabase
    .from('labs')
    .select('id, name, status, is_active')
    .eq('id', targetLabId)
    .single()

  const labName = labData?.name || 'Computer Lab'

  // 2. Fetch Active Categories
  const { data: categoriesData } = await supabase
    .from('issue_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const categories: IssueCategoryRow[] = categoriesData || []
  const categoryMap = new Map<string, IssueCategoryRow>()
  categories.forEach((cat) => categoryMap.set(cat.id, cat))

  // 3. Fetch Workstations
  const { data: wsData } = await supabase
    .from('workstations')
    .select('*')
    .eq('lab_id', targetLabId)
    .eq('is_active', true)
    .order('label', { ascending: true })

  const rawWorkstations: WorkstationRow[] = wsData || []

  // 4. Fetch ALL Issues for Workstations in this Lab (open, in_progress, and resolved)
  const wsIds = rawWorkstations.map((w) => w.id)
  let rawIssues: WorkstationIssueRow[] = []
  if (wsIds.length > 0) {
    const { data: issuesData } = await supabase
      .from('workstation_issues')
      .select('*')
      .in('workstation_id', wsIds)
      .order('created_at', { ascending: false })

    rawIssues = issuesData || []
  }

  // Map issues by workstation ID
  const activeIssuesByWs = new Map<string, WorkstationIssueRecord[]>()
  const allParsedIssues: WorkstationIssueRecord[] = []
  let openCount = 0
  let inProgressCount = 0
  let resolvedCount = 0

  rawIssues.forEach((issue) => {
    let photosParsed: WorkstationPhoto[] = []
    if (Array.isArray(issue.photos)) {
      photosParsed = issue.photos as unknown as WorkstationPhoto[]
    } else if (typeof issue.photos === 'string') {
      try {
        photosParsed = JSON.parse(issue.photos)
      } catch {}
    }

    const wsRecord = rawWorkstations.find((w) => w.id === issue.workstation_id)
    const issueRec: WorkstationIssueRecord = {
      id: issue.id,
      workstation_id: issue.workstation_id,
      workstation_label: wsRecord?.label,
      lab_id: targetLabId,
      category_id: issue.category_id,
      category: issue.category_id ? categoryMap.get(issue.category_id) || null : null,
      title: issue.title,
      description: issue.description,
      severity: issue.severity as 'low' | 'medium' | 'high' | 'critical',
      status: issue.status as 'open' | 'acknowledged' | 'in_progress' | 'resolved',
      reported_by_id: issue.reported_by_id,
      reported_by_name: issue.reported_by_name,
      photos: photosParsed,
      resolved_by_id: issue.resolved_by_id,
      resolved_by_name: issue.resolved_by_name,
      resolution_notes: issue.resolution_notes,
      resolved_at: issue.resolved_at,
      linked_maintenance_log_id: issue.linked_maintenance_log_id,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    }

    allParsedIssues.push(issueRec)

    if (issue.status === 'open') openCount++
    else if (issue.status === 'in_progress') inProgressCount++
    else if (issue.status === 'resolved') resolvedCount++

    // Only active (non-resolved) issues affect workstation operational state
    if (issue.status !== 'resolved') {
      const existing = activeIssuesByWs.get(issue.workstation_id) || []
      existing.push(issueRec)
      activeIssuesByWs.set(issue.workstation_id, existing)
    }
  })

  // 5. Build Workstations with Derived Health Status
  let totalOperational = 0
  let totalFlagged = 0
  let totalUnderRepair = 0

  const workstationsWithIssues: WorkstationWithIssues[] = rawWorkstations.map((ws) => {
    const activeIssues = activeIssuesByWs.get(ws.id) || []
    const count = activeIssues.length

    let highestSeverity: 'low' | 'medium' | 'high' | 'critical' | null = null
    let maxWeight = 0
    let hasInProgress = false

    activeIssues.forEach((iss) => {
      const w = SEVERITY_WEIGHTS[iss.severity] || 1
      if (w > maxWeight) {
        maxWeight = w
        highestSeverity = iss.severity
      }
      if (iss.status === 'in_progress') {
        hasInProgress = true
      }
    })

    let status: 'operational' | 'flagged' | 'under_repair' = 'operational'
    if (count > 0) {
      if (hasInProgress) {
        status = 'under_repair'
        totalUnderRepair++
      } else {
        status = 'flagged'
        totalFlagged++
      }
    } else {
      totalOperational++
    }

    return {
      ...ws,
      open_issues_count: count,
      highest_severity: highestSeverity,
      status,
      active_issues: activeIssues,
    }
  })

  return {
    lab_id: targetLabId,
    lab_name: labName,
    workstations: workstationsWithIssues,
    issues: allParsedIssues,
    categories,
    metrics: {
      total: rawWorkstations.length,
      operational: totalOperational,
      flagged: totalFlagged,
      under_repair: totalUnderRepair,
      open_count: openCount,
      in_progress_count: inProgressCount,
      resolved_count: resolvedCount,
    },
    is_privileged: isPrivileged,
  }
}

/**
 * Manage dynamic issue category taxonomy (Admin/In-Charge only).
 */
export async function manageIssueCategory(
  action: 'create' | 'update' | 'delete',
  payload: IssueCategoryInput
): Promise<{ success: boolean; data?: IssueCategoryRow; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to manage issue categories.' }
  }

  const supabase = await createClient()

  if (action === 'create') {
    if (!payload.name || payload.name.trim().length === 0) {
      return { success: false, error: 'Category name is required.' }
    }

    const { data, error } = await supabase
      .from('issue_categories')
      .insert({
        name: payload.name.trim(),
        type: payload.type || 'hardware',
        color: payload.color || '#6366F1',
        icon: payload.icon || 'AlertTriangle',
        default_severity: payload.default_severity || 'medium',
        is_active: payload.is_active !== undefined ? payload.is_active : true,
        sort_order: payload.sort_order ?? 0,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true, data }
  }

  if (action === 'update') {
    if (!payload.id) {
      return { success: false, error: 'Category ID is required for update.' }
    }

    const updateData: IssueCategoryUpdate = {
      updated_at: new Date().toISOString(),
    }
    if (payload.name !== undefined) updateData.name = payload.name.trim()
    if (payload.type !== undefined) updateData.type = payload.type
    if (payload.color !== undefined) updateData.color = payload.color
    if (payload.icon !== undefined) updateData.icon = payload.icon
    if (payload.default_severity !== undefined) updateData.default_severity = payload.default_severity
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active
    if (payload.sort_order !== undefined) updateData.sort_order = payload.sort_order

    const { data, error } = await supabase
      .from('issue_categories')
      .update(updateData)
      .eq('id', payload.id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true, data }
  }

  if (action === 'delete') {
    if (!payload.id) {
      return { success: false, error: 'Category ID is required for deletion.' }
    }

    // Check if any issues are linked to this category
    const { count } = await supabase
      .from('workstation_issues')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', payload.id)

    if (count && count > 0) {
      // Soft-archive to preserve referential integrity
      const { error } = await supabase
        .from('issue_categories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', payload.id)

      if (error) return { success: false, error: error.message }
    } else {
      // Safe to hard delete if no historical records exist
      const { error } = await supabase
        .from('issue_categories')
        .delete()
        .eq('id', payload.id)

      if (error) return { success: false, error: error.message }
    }

    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')
    return { success: true }
  }

  return { success: false, error: 'Invalid action requested.' }
}

/**
 * Atomically batch-update workstation positions (pos_x, pos_y, row_label).
 * Admin/In-Charge only.
 */
export async function batchUpdateWorkstationPositions(
  labId: string,
  updates: Array<{ id: string; pos_x: number; pos_y: number; row_label?: string | null; label?: string; position_id?: string | null }>
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to adjust layout.' }
  }

  if (!updates || updates.length === 0) {
    return { success: true, updatedCount: 0 }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (updates.some((u) => !!u.label)) {
      await client.query(
        `UPDATE public.workstations SET label = '__tmp_' || id::text WHERE lab_id = $1`,
        [labId]
      )
    }

    for (const item of updates) {
      const clampedX = Math.max(0, Math.min(100, item.pos_x))
      const clampedY = Math.max(0, Math.min(100, item.pos_y))
      const hasRow = item.row_label !== undefined
      const rowVal = item.row_label?.trim() || null
      const hasPosId = item.position_id !== undefined
      const posIdVal = item.position_id?.trim() || null

      await client.query(
        `UPDATE public.workstations
         SET pos_x = $1,
             pos_y = $2,
             row_label = CASE WHEN $3 = true THEN $4 ELSE row_label END,
             label = COALESCE($5, label),
             position_id = CASE WHEN $6 = true THEN $7 ELSE position_id END,
             updated_at = NOW()
         WHERE id = $8 AND lab_id = $9`,
        [clampedX, clampedY, hasRow, rowVal, item.label || null, hasPosId, posIdVal, item.id, labId]
      )
    }

    // Soft-archive any surplus student workstations not included in the saved layout
    const updatedIds = updates.map((u) => u.id)
    if (updatedIds.length > 0) {
      await client.query(
        `UPDATE public.workstations
         SET is_active = false, updated_at = NOW()
         WHERE lab_id = $1 AND is_active = true AND NOT (id = ANY($2))
         AND LOWER(label) NOT LIKE '%teacher%' AND LOWER(label) NOT LIKE '%podium%' AND LOWER(label) NOT LIKE '%instructor%'`,
        [labId, updatedIds]
      )
    }

    await client.query('COMMIT')

    revalidatePath('/computer-lab')
    revalidatePath('/computer-lab/projector')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')

    return { success: true, updatedCount: updates.length }
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error in batchUpdateWorkstationPositions:', error)
    return { success: false, error: error.message }
  } finally {
    client.release()
  }
}

/**
 * Provisions missing workstations if needed to match a custom multi-row/column room grid
 * and updates positions, row labels, and terminal IDs.
 */
export async function provisionCustomGridWorkstations(
  labId: string,
  config: import('@/lib/workstations/layout-engine').CustomRoomGridConfig,
  snapGrid: number = 2
): Promise<{ success: boolean; totalCount?: number; createdCount?: number; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to configure custom layout.' }
  }

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const { rows: existingRows } = await client.query(
      `SELECT id, label, row_label, position_id FROM public.workstations WHERE lab_id = $1 AND is_active = true ORDER BY label ASC`,
      [labId]
    )

    const { generateRoomGridSlots, calculateCustomRoomLayout } = await import('@/lib/workstations/layout-engine')
    const slots = generateRoomGridSlots(config, snapGrid)

    // Separate teacher from student workstations
    const teacherStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return lbl.includes('teacher') || lbl.includes('podium') || lbl.includes('instructor')
    })
    let studentStations = existingRows.filter((r) => {
      const lbl = r.label.toLowerCase()
      return !lbl.includes('teacher') && !lbl.includes('podium') && !lbl.includes('instructor')
    })

    // Prioritize keeping student stations that have active issues
    const { rows: issueWsRows } = await client.query(
      `SELECT DISTINCT workstation_id FROM public.workstation_issues WHERE status != 'resolved'`
    )
    const activeIssueIds = new Set(issueWsRows.map((r: any) => r.workstation_id))
    studentStations.sort((a, b) => {
      const aHas = activeIssueIds.has(a.id) ? 0 : 1
      const bHas = activeIssueIds.has(b.id) ? 0 : 1
      return aHas - bHas
    })

    let createdCount = 0
    let needed = slots.length - studentStations.length

    if (needed > 0) {
      // 1. Try to reactivate existing inactive workstations in this lab first
      const { rows: inactiveRows } = await client.query(
        `SELECT id, label, row_label, position_id FROM public.workstations
         WHERE lab_id = $1 AND is_active = false
         ORDER BY id ASC LIMIT $2`,
        [labId, needed]
      )

      if (inactiveRows.length > 0) {
        const reactivateIds = inactiveRows.map((r: any) => r.id)
        await client.query(
          `UPDATE public.workstations SET is_active = true, updated_at = NOW() WHERE id = ANY($1)`,
          [reactivateIds]
        )
        studentStations.push(...inactiveRows)
        needed -= inactiveRows.length
      }

      // 2. If still needed, insert newly provisioned workstations
      if (needed > 0) {
        for (let i = 0; i < needed; i++) {
          const slotIdx = studentStations.length
          const slot = slots[slotIdx]
          const tempInsertLabel = `__tmp_new_${Date.now()}_${i}`

          const insertRes = await client.query(
            `INSERT INTO public.workstations (lab_id, label, pos_x, pos_y, row_label, position_id, is_active, device_type, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, 'desktop', NOW(), NOW())
             RETURNING id, label, row_label, position_id`,
            [
              labId,
              tempInsertLabel,
              slot ? slot.pos_x : 50,
              slot ? slot.pos_y : 50,
              slot ? slot.rowLabel : 'Unassigned Row',
              slot ? slot.positionId : null,
            ]
          )
          if (insertRes.rows[0]) {
            studentStations.push(insertRes.rows[0])
            createdCount++
          }
        }
      }
    } else if (needed < 0) {
      // Surplus workstations: soft-archive them so they don't linger on canvas
      const surplusStations = studentStations.slice(slots.length)
      const surplusIds = surplusStations.map((s) => s.id)
      if (surplusIds.length > 0) {
        await client.query(
          `UPDATE public.workstations SET is_active = false, updated_at = NOW() WHERE id = ANY($1) AND lab_id = $2`,
          [surplusIds, labId]
        )
      }
      studentStations = studentStations.slice(0, slots.length)
    }

    // Recalculate layout updates for only the active room workstations
    const allStations = [...teacherStations, ...studentStations]
    const calculatedUpdates = calculateCustomRoomLayout(allStations, config, snapGrid, true)

    // Two-pass update to eliminate any unique constraint collisions on (lab_id, label)
    await client.query(
      `UPDATE public.workstations SET label = '__tmp_' || id::text WHERE lab_id = $1`,
      [labId]
    )

    for (const item of calculatedUpdates) {
      const clampedX = Math.max(0, Math.min(100, item.pos_x))
      const clampedY = Math.max(0, Math.min(100, item.pos_y))
      await client.query(
        `UPDATE public.workstations
         SET pos_x = $1, pos_y = $2, row_label = COALESCE($3, row_label), label = COALESCE($4, label), position_id = COALESCE($5, position_id), updated_at = NOW()
         WHERE id = $6 AND lab_id = $7`,
        [clampedX, clampedY, item.row_label || null, item.label || null, item.position_id || null, item.id, labId]
      )
    }

    // Ensure laboratory capacity exactly matches the active grid capacity
    await client.query(
      `UPDATE public.labs SET capacity = $1 WHERE id = $2`,
      [slots.length, labId]
    )

    await client.query('COMMIT')

    revalidatePath('/computer-lab')
    revalidatePath('/computer-lab/projector')
    revalidatePath('/maintenance')
    revalidatePath('/maintenance/workstations')

    return { success: true, totalCount: calculatedUpdates.length, createdCount }
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error in provisionCustomGridWorkstations:', error)
    return { success: false, error: error.message }
  } finally {
    client.release()
  }
}

/**
 * Auto-arranges all active workstations in a lab according to a preset layout and saves to DB.
 */
export async function applyAutoArrangementLayout(
  labId: string,
  preset: import('@/lib/workstations/layout-engine').LayoutPresetType,
  snapGrid: number = 2
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to auto-arrange layout.' }
  }

  const pool = getPgPool()
  try {
    const { rows } = await pool.query(
      `SELECT id, label, row_label FROM public.workstations WHERE lab_id = $1 AND is_active = true ORDER BY label ASC`,
      [labId]
    )

    if (rows.length === 0) {
      return { success: false, error: 'No active workstations found in this laboratory.' }
    }

    const { calculateAutoArrangement } = await import('@/lib/workstations/layout-engine')
    const calculatedPositions = calculateAutoArrangement(rows, preset, snapGrid)

    return await batchUpdateWorkstationPositions(labId, calculatedPositions)
  } catch (error: any) {
    console.error('Error applying auto-arrangement layout:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Fetches all saved custom layout templates for a laboratory.
 */
export async function getCustomLayoutTemplates(
  labId: string
): Promise<{
  success: boolean
  templates: import('@/lib/workstations/layout-engine').LabLayoutTemplate[]
  error?: string
}> {
  const pool = getPgPool()
  try {
    const { rows } = await pool.query(
      `SELECT id, lab_id, name, description, config, created_at, updated_at
       FROM public.lab_layout_templates
       WHERE lab_id = $1
       ORDER BY created_at ASC`,
      [labId]
    )

    return { success: true, templates: rows }
  } catch (error: any) {
    console.error('Error fetching custom layout templates:', error)
    return { success: false, templates: [], error: error.message }
  }
}

/**
 * Saves or updates a custom room grid layout template with a user-defined name.
 */
export async function saveCustomLayoutTemplate(
  labId: string,
  name: string,
  config: import('@/lib/workstations/layout-engine').CustomRoomGridConfig,
  description?: string
): Promise<{
  success: boolean
  template?: import('@/lib/workstations/layout-engine').LabLayoutTemplate
  error?: string
}> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to save layout templates.' }
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return { success: false, error: 'Template name cannot be empty.' }
  }

  const pool = getPgPool()
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.lab_layout_templates (lab_id, name, description, config, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (lab_id, name) DO UPDATE
       SET description = COALESCE(EXCLUDED.description, public.lab_layout_templates.description),
           config = EXCLUDED.config,
           updated_at = NOW()
       RETURNING id, lab_id, name, description, config, created_at, updated_at`,
      [labId, trimmedName, description?.trim() || null, JSON.stringify(config)]
    )

    revalidatePath('/computer-lab')
    return { success: true, template: rows[0] }
  } catch (error: any) {
    console.error('Error saving custom layout template:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Deletes a saved custom layout template.
 */
export async function deleteCustomLayoutTemplate(
  templateId: string,
  labId: string
): Promise<{ success: boolean; error?: string }> {
  const { isPrivileged } = await getAuthContext()
  if (!isPrivileged) {
    return { success: false, error: 'Unauthorized: Administrative role required to delete layout templates.' }
  }

  const pool = getPgPool()
  try {
    await pool.query(
      `DELETE FROM public.lab_layout_templates WHERE id = $1 AND lab_id = $2`,
      [templateId, labId]
    )

    revalidatePath('/computer-lab')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting custom layout template:', error)
    return { success: false, error: error.message }
  }
}

