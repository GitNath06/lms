'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/server-user-scope'
import type {
  FleetTerminalStatus,
  FleetProgressMap,
} from '@/lib/types/maintenance-fleet'
import {
  calculateFleetProgressSummary,
  sortWorkstationLabels,
} from '@/lib/types/maintenance-fleet'

/**
 * Validates administrative permission for Lab Maintenance operations
 */
async function getAuthorizedProfile() {
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
 * Retrieves the active fleet routine progress and workstation floor configuration for a given plan.
 */
export async function getFleetRoutineProgress(planId: string) {
  const { scope, isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only administrators and lab in-charges may access fleet routines.')
  }

  const supabase = await createClient()

  // 1. Fetch Plan Details
  const { data: plan, error: planError } = await supabase
    .from('maintenance_plans')
    .select('*')
    .eq('id', planId)
    .single()

  if (planError || !plan) {
    throw new Error(planError?.message || 'Maintenance plan not found')
  }

  // 2. Fetch workstations in that lab to map terminals
  const { data: wsRows, error: wsError } = await supabase
    .from('workstations')
    .select('id, label, pos_x, pos_y, row_label, is_active')
    .eq('lab_id', plan.lab_id)
    .eq('is_active', true)
    .order('label', { ascending: true })

  if (wsError) {
    console.error('Failed to load workstations for fleet maintenance:', wsError)
  }

  const workstations = wsRows || []
  const availableLabels = sortWorkstationLabels(workstations.map((w) => w.label))

  // 3. Determine target machine list
  let targetMachines: string[] = []
  if (Array.isArray(plan.affected_machines) && plan.affected_machines.length > 0) {
    targetMachines = sortWorkstationLabels(plan.affected_machines)
  } else if (availableLabels.length > 0) {
    targetMachines = availableLabels
  } else {
    // Fallback if no workstations exist in database
    targetMachines = Array.from({ length: 34 }, (_, i) => `PC-${String(i + 1).padStart(2, '0')}`)
  }

  // 4. Parse fleet_progress
  const rawProgress = (plan.fleet_progress as Record<string, unknown>) || {}
  const fleetProgress: FleetProgressMap = {}

  for (const label of targetMachines) {
    const item = rawProgress[label] as {
      status?: FleetTerminalStatus
      updated_at?: string
      technician_name?: string
      technician_id?: string
      notes?: string
    } | undefined

    if (item && item.status) {
      fleetProgress[label] = {
        status: item.status,
        updated_at: item.updated_at || new Date().toISOString(),
        technician_name: item.technician_name || undefined,
        technician_id: item.technician_id || undefined,
        notes: item.notes || '',
      }
    } else {
      fleetProgress[label] = {
        status: 'pending',
        updated_at: plan.created_at || new Date().toISOString(),
      }
    }
  }

  const summary = calculateFleetProgressSummary(targetMachines, fleetProgress)

  return {
    success: true,
    user: {
      userId: scope.userId,
      fullName: scope.fullName || 'Lab In-Charge',
      role: scope.role,
    },
    plan: {
      id: plan.id,
      title: plan.title,
      category: plan.category,
      lab_id: plan.lab_id,
      interval_days: plan.interval_days,
      severity: plan.severity,
      checklist: Array.isArray(plan.checklist) ? (plan.checklist as string[]) : [],
      description: plan.description,
      targetMachines,
      fleetProgress,
    },
    workstations: workstations.map((w) => ({
      id: w.id,
      label: w.label,
      pos_x: w.pos_x,
      pos_y: w.pos_y,
      row_label: w.row_label,
    })),
    summary,
  }
}

/**
 * Updates status of a single terminal in a fleet maintenance routine.
 */
export async function updateFleetTerminalStatus(
  planId: string,
  workstationLabel: string,
  status: FleetTerminalStatus,
  notes?: string
) {
  const { scope, isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Administrative permission required.')
  }

  const supabase = await createClient()

  // 1. Fetch current progress
  const { data: plan, error: fetchErr } = await supabase
    .from('maintenance_plans')
    .select('fleet_progress, affected_machines, lab_id')
    .eq('id', planId)
    .single()

  if (fetchErr || !plan) {
    throw new Error(fetchErr?.message || 'Plan not found')
  }

  const currentMap = ((plan.fleet_progress as Record<string, unknown>) || {}) as FleetProgressMap

  currentMap[workstationLabel] = {
    status,
    updated_at: new Date().toISOString(),
    technician_name: scope.fullName || 'Lab In-Charge',
    technician_id: scope.userId,
    notes: notes?.trim() || currentMap[workstationLabel]?.notes || '',
  }

  const { error: updateErr } = await supabase
    .from('maintenance_plans')
    .update({ fleet_progress: currentMap as any })
    .eq('id', planId)

  if (updateErr) {
    console.error('Failed to update terminal status:', updateErr)
    return { success: false, error: updateErr.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/computer-lab')

  return {
    success: true,
    updatedLabel: workstationLabel,
    status,
    updatedProgress: currentMap,
  }
}

/**
 * Batch updates multiple terminals (e.g. Mark Row A complete, Mark All complete).
 */
export async function batchUpdateFleetTerminalStatus(
  planId: string,
  workstationLabels: string[],
  status: FleetTerminalStatus
) {
  const { scope, isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Administrative permission required.')
  }

  if (!workstationLabels || workstationLabels.length === 0) {
    return { success: true }
  }

  const supabase = await createClient()

  const { data: plan, error: fetchErr } = await supabase
    .from('maintenance_plans')
    .select('fleet_progress')
    .eq('id', planId)
    .single()

  if (fetchErr || !plan) {
    throw new Error(fetchErr?.message || 'Plan not found')
  }

  const currentMap = ((plan.fleet_progress as Record<string, unknown>) || {}) as FleetProgressMap
  const now = new Date().toISOString()
  const techName = scope.fullName || 'Lab In-Charge'

  for (const label of workstationLabels) {
    currentMap[label] = {
      status,
      updated_at: now,
      technician_name: techName,
      technician_id: scope.userId,
      notes: currentMap[label]?.notes || '',
    }
  }

  const { error: updateErr } = await supabase
    .from('maintenance_plans')
    .update({ fleet_progress: currentMap as any })
    .eq('id', planId)

  if (updateErr) {
    console.error('Failed to batch update terminal status:', updateErr)
    return { success: false, error: updateErr.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/computer-lab')

  return { success: true, updatedProgress: currentMap }
}

/**
 * Resets a routine's fleet progress back to pending for all machines.
 */
export async function resetFleetRoutineProgress(planId: string) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Administrative permission required.')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('maintenance_plans')
    .update({ fleet_progress: {} })
    .eq('id', planId)

  if (error) {
    console.error('Failed to reset fleet routine:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/computer-lab')

  return { success: true }
}

/**
 * Updates the affected machines array for a routine.
 */
export async function updatePlanAffectedMachines(planId: string, machines: string[]) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Administrative permission required.')
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('maintenance_plans')
    .update({ affected_machines: machines })
    .eq('id', planId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  return { success: true }
}

/**
 * Archives completed fleet routine into official public.maintenance_logs.
 * Automatically computes summary (X/Y workstations serviced, Z blocked)
 * with zero pricing clutter per Rule #4.
 */
export async function archiveFleetRoutineToLog(payload: {
  planId: string
  remarks?: string
  partsReplaced?: string
  resetProgressAfterArchival?: boolean
}) {
  const { scope, isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Administrative permission required.')
  }

  const supabase = await createClient()

  // 1. Fetch Plan & current progress
  const { data: plan, error: fetchErr } = await supabase
    .from('maintenance_plans')
    .select('*')
    .eq('id', payload.planId)
    .single()

  if (fetchErr || !plan) {
    throw new Error(fetchErr?.message || 'Plan not found')
  }

  // 2. Fetch target workstations if not set in affected_machines
  let targetMachines: string[] = []
  if (Array.isArray(plan.affected_machines) && plan.affected_machines.length > 0) {
    targetMachines = sortWorkstationLabels(plan.affected_machines)
  } else {
    const { data: ws } = await supabase
      .from('workstations')
      .select('label')
      .eq('lab_id', plan.lab_id)
      .eq('is_active', true)
    targetMachines = sortWorkstationLabels((ws || []).map((w) => w.label))
  }

  const progress = (plan.fleet_progress as Record<string, unknown>) || {}
  const summary = calculateFleetProgressSummary(targetMachines, progress as FleetProgressMap)

  // 3. Collect blocked stations
  const blockedStations: string[] = []
  for (const label of targetMachines) {
    const entry = progress[label] as { status?: string } | undefined
    if (entry?.status === 'blocked') {
      blockedStations.push(label)
    }
  }

  let assetIdentifier = ''
  if (summary.completed === summary.total && summary.total > 0) {
    assetIdentifier = `All ${summary.total} Workstations (${targetMachines[0]} to ${targetMachines[targetMachines.length - 1]})`
  } else if (blockedStations.length > 0) {
    assetIdentifier = `${summary.completed} of ${summary.total} Workstations Serviced, ${blockedStations.length} Blocked (${blockedStations.join(', ')})`
  } else {
    assetIdentifier = `${summary.completed} of ${summary.total} Workstations Serviced`
  }

  const workPerformed = `Fleet Maintenance Execution: ${plan.title}. Completed ${summary.completed}/${summary.total} workstations (${summary.percentage}%). ${
    blockedStations.length > 0 ? `Issues/Blocked on: ${blockedStations.join(', ')}.` : 'Zero workstation blocks.'
  }`

  const serviceDate = new Date().toISOString().split('T')[0]

  // 4. Insert into maintenance_logs
  const { data: logEntry, error: logErr } = await supabase
    .from('maintenance_logs')
    .insert({
      plan_id: plan.id,
      lab_id: plan.lab_id,
      asset_identifier: assetIdentifier,
      work_performed: workPerformed,
      checklist_completed: Array.isArray(plan.checklist) ? (plan.checklist as string[]) : [],
      parts_replaced: payload.partsReplaced?.trim() || null,
      cost_incurred: 0, // Strict zero pricing clutter (Rule #4)
      service_date: serviceDate,
      performed_by_id: scope.userId,
      remarks: payload.remarks?.trim() || `Fleet routine logged by ${scope.fullName || 'Lab In-Charge'}.`,
    })
    .select()
    .single()

  if (logErr) {
    console.error('Failed to archive fleet maintenance log:', logErr)
    return { success: false, error: logErr.message }
  }

  // 5. Optionally reset or clear progress
  if (payload.resetProgressAfterArchival) {
    await supabase.from('maintenance_plans').update({ fleet_progress: {} }).eq('id', payload.planId)
  }

  // 6. Resolve any active reminders linked to this plan
  const { data: reminder } = await supabase
    .from('maintenance_reminders')
    .select('id')
    .eq('plan_id', payload.planId)
    .in('status', ['pending', 'overdue', 'in_progress'])
    .maybeSingle()

  if (reminder) {
    await supabase
      .from('maintenance_reminders')
      .update({ status: 'completed' })
      .eq('id', reminder.id)
  }

  revalidatePath('/maintenance')
  revalidatePath('/computer-lab')
  revalidatePath('/records')

  return {
    success: true,
    data: logEntry,
    summary,
  }
}
