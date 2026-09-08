'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getServerUserScope } from '@/lib/context/user-scope'

export interface MaintenancePlanRecord {
  id: string
  lab_id: string
  title: string
  category: string
  interval_days: number
  severity: 'low' | 'routine' | 'high' | 'critical'
  target_role: string
  assigned_user_id?: string | null
  assigned_user_name?: string | null
  checklist: string[]
  is_active: boolean
  description?: string | null
  created_at: string
  // Dynamic fields
  last_serviced_date?: string | null
  last_serviced_by?: string | null
  last_serviced_machines?: string | null
  next_due_date?: string | null
  active_reminder_id?: string | null
  reminder_status?: 'pending' | 'snoozed' | 'overdue' | 'in_progress' | 'completed' | null
  overdue_days?: number
}

export interface MaintenanceReminderRecord {
  id: string
  plan_id: string
  lab_id: string
  lab_name?: string
  title: string
  due_date: string // YYYY-MM-DD
  status: 'pending' | 'snoozed' | 'in_progress' | 'completed' | 'overdue'
  snoozed_until?: string | null
  snooze_reason?: string | null
  snooze_count: number
  created_at: string
  // Computed dynamic fields
  is_overdue: boolean
  overdue_days: number
  days_remaining: number
  plan?: MaintenancePlanRecord | null
}

export interface MaintenanceLogRecord {
  id: string
  plan_id?: string | null
  reminder_id?: string | null
  lab_id: string
  lab_name?: string
  asset_identifier: string
  work_performed: string
  checklist_completed: string[]
  parts_replaced?: string | null
  cost_incurred: number
  service_date: string
  performed_by_id: string
  performed_by_name?: string
  next_service_due?: string | null
  remarks?: string | null
  created_at: string
  plan_title?: string | null
}

export interface LabPlanHealthMatrixItem {
  lab_id: string
  lab_name: string
  total_plans: number
  healthy_plans: number
  overdue_plans: number
  due_soon_plans: number
  health_status: 'excellent' | 'attention_required' | 'critical'
  last_service_date?: string | null
  next_target_date?: string | null
}

export interface MaintenanceOverviewData {
  authorized: boolean
  user_role: string
  kpi: {
    total_plans: number
    active_reminders: number
    overdue_count: number
    completed_logs: number
  }
  reminders: MaintenanceReminderRecord[]
  plans: MaintenancePlanRecord[]
  logs: MaintenanceLogRecord[]
  health_matrix: LabPlanHealthMatrixItem[]
}

const LAB_DISPLAY_NAMES: Record<string, string> = {
  comp: 'Computer Engineering Lab 01',
  phys: 'Physics Laboratory',
  chem: 'Chemistry Laboratory',
  bio: 'Biology Laboratory',
  elec: 'Electronics Laboratory',
}

/**
 * Validates whether the current authenticated user has administrative permission
 * for Lab Maintenance (super_admin, lab_incharge, coordinator, or granted permission).
 */
async function getAuthorizedProfile() {
  const scope = await getServerUserScope()
  const isPrivileged =
    scope.role === 'super_admin' ||
    scope.role === 'lab_incharge' ||
    scope.role === 'hod' ||
    (scope.role as string) === 'coordinator' ||
    (scope as any).permissions?.can_manage_maintenance === true ||
    process.env.NODE_ENV === 'development'
  return { scope, isPrivileged }
}

/**
 * Pure PostgreSQL server query fetching overview data:
 * - Active persistent reminders with dynamic delay days calculation
 * - Recurring maintenance plans with health status
 * - Completed service logs with technician names
 * - Lab health matrix data
 */
export async function getMaintenanceOverview(labFilter: string = 'all'): Promise<MaintenanceOverviewData> {
  const { scope, isPrivileged } = await getAuthorizedProfile()

  if (!isPrivileged) {
    return {
      authorized: false,
      user_role: scope.role,
      kpi: { total_plans: 0, active_reminders: 0, overdue_count: 0, completed_logs: 0 },
      reminders: [],
      plans: [],
      logs: [],
      health_matrix: [],
    }
  }

  const supabase = (await createClient()) as any

  // 1. Fetch Plans
  let plansQuery = supabase
    .from('maintenance_plans')
    .select(`
      *,
      assigned_profile:profiles!maintenance_plans_assigned_user_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  if (labFilter !== 'all') {
    plansQuery = plansQuery.eq('lab_id', labFilter)
  }

  const { data: plansData, error: plansErr } = await plansQuery
  if (plansErr) {
    console.error('Error fetching maintenance plans:', plansErr)
  }

  // 2. Fetch Active Reminders (status != 'completed')
  let remindersQuery = supabase
    .from('maintenance_reminders')
    .select(`
      *,
      plan:maintenance_plans(*)
    `)
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (labFilter !== 'all') {
    remindersQuery = remindersQuery.eq('lab_id', labFilter)
  }

  const { data: remindersData, error: remErr } = await remindersQuery
  if (remErr) {
    console.error('Error fetching maintenance reminders:', remErr)
  }

  // 3. Fetch Completed Maintenance Logs
  let logsQuery = supabase
    .from('maintenance_logs')
    .select(`
      *,
      performer:profiles!maintenance_logs_performed_by_id_fkey(full_name),
      plan:maintenance_plans(title)
    `)
    .order('service_date', { ascending: false })
    .limit(100)

  if (labFilter !== 'all') {
    logsQuery = logsQuery.eq('lab_id', labFilter)
  }

  const { data: logsData, error: logsErr } = await logsQuery
  if (logsErr) {
    console.error('Error fetching maintenance logs:', logsErr)
  }

  // Normalize today's date in UTC (Nepal Time aligns closely, midnight comparison)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 4. Process Reminders with Dynamic Overdue & Delay Calculations
  const processedReminders: MaintenanceReminderRecord[] = (remindersData || []).map((r: any) => {
    const dueDate = new Date(r.due_date)
    dueDate.setHours(0, 0, 0, 0)

    const diffTime = today.getTime() - dueDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // Check snooze expiration
    let isSnoozeActive = false
    if (r.status === 'snoozed' && r.snoozed_until) {
      const snoozeDate = new Date(r.snoozed_until)
      snoozeDate.setHours(0, 0, 0, 0)
      if (snoozeDate >= today) {
        isSnoozeActive = true
      }
    }

    const isOverdue = !isSnoozeActive && diffDays > 0
    const computedStatus = isSnoozeActive ? 'snoozed' : isOverdue ? 'overdue' : r.status

    return {
      id: r.id,
      plan_id: r.plan_id,
      lab_id: r.lab_id,
      lab_name: LAB_DISPLAY_NAMES[r.lab_id] || r.lab_id.toUpperCase(),
      title: r.title,
      due_date: r.due_date,
      status: computedStatus,
      snoozed_until: r.snoozed_until,
      snooze_reason: r.snooze_reason,
      snooze_count: r.snooze_count || 0,
      created_at: r.created_at,
      is_overdue: isOverdue,
      overdue_days: diffDays > 0 ? diffDays : 0,
      days_remaining: diffDays < 0 ? Math.abs(diffDays) : 0,
      plan: r.plan
        ? {
            id: r.plan.id,
            lab_id: r.plan.lab_id,
            title: r.plan.title,
            category: r.plan.category,
            interval_days: r.plan.interval_days,
            severity: r.plan.severity,
            target_role: r.plan.target_role,
            checklist: Array.isArray(r.plan.checklist) ? r.plan.checklist : [],
            is_active: r.plan.is_active,
            description: r.plan.description,
            created_at: r.plan.created_at,
          }
        : null,
    }
  })

  // 5. Process Completed Logs
  let totalExpense = 0
  const processedLogs: MaintenanceLogRecord[] = (logsData || []).map((l: any) => {
    const cost = parseFloat(l.cost_incurred) || 0
    totalExpense += cost
    return {
      id: l.id,
      plan_id: l.plan_id,
      reminder_id: l.reminder_id,
      lab_id: l.lab_id,
      lab_name: LAB_DISPLAY_NAMES[l.lab_id] || l.lab_id.toUpperCase(),
      asset_identifier: l.asset_identifier,
      work_performed: l.work_performed,
      checklist_completed: Array.isArray(l.checklist_completed) ? l.checklist_completed : [],
      parts_replaced: l.parts_replaced,
      cost_incurred: cost,
      service_date: l.service_date,
      performed_by_id: l.performed_by_id,
      performed_by_name: l.performer?.full_name || 'Laboratory Staff',
      next_service_due: l.next_service_due,
      remarks: l.remarks,
      created_at: l.created_at,
      plan_title: l.plan?.title || null,
    }
  })

  // 6. Process Plans with health & active reminder info
  const processedPlans: MaintenancePlanRecord[] = (plansData || []).map((p: any) => {
    const activeReminder = processedReminders.find((r) => r.plan_id === p.id)
    const lastLog = processedLogs.find((l) => l.plan_id === p.id)

    return {
      id: p.id,
      lab_id: p.lab_id,
      title: p.title,
      category: p.category,
      interval_days: p.interval_days,
      severity: p.severity,
      target_role: p.target_role,
      assigned_user_id: p.assigned_user_id,
      assigned_user_name: p.assigned_profile?.full_name || null,
      checklist: Array.isArray(p.checklist) ? p.checklist : [],
      is_active: p.is_active,
      description: p.description,
      created_at: p.created_at,
      last_serviced_date: lastLog?.service_date || null,
      last_serviced_by: lastLog?.performed_by_name || null,
      last_serviced_machines: lastLog?.asset_identifier || null,
      next_due_date: activeReminder?.due_date || null,
      active_reminder_id: activeReminder?.id || null,
      reminder_status: activeReminder?.status || null,
      overdue_days: activeReminder?.overdue_days || 0,
    }
  })

  // 7. Dynamic Lab Plan Health Matrix
  const labIds = ['comp', 'phys', 'chem', 'bio']
  const healthMatrix: LabPlanHealthMatrixItem[] = labIds.map((labId) => {
    const labPlans = processedPlans.filter((p) => p.lab_id === labId)
    const labReminders = processedReminders.filter((r) => r.lab_id === labId)
    const overduePlans = labReminders.filter((r) => r.is_overdue).length
    const dueSoonPlans = labReminders.filter((r) => !r.is_overdue && r.days_remaining <= 7).length
    const healthyPlans = labPlans.length - overduePlans

    const lastLog = processedLogs.find((l) => l.lab_id === labId)
    const nextTargetRem = [...labReminders].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

    let healthStatus: LabPlanHealthMatrixItem['health_status'] = 'excellent'
    if (overduePlans > 0) {
      healthStatus = overduePlans >= 2 ? 'critical' : 'attention_required'
    } else if (dueSoonPlans > 0) {
      healthStatus = 'attention_required'
    }

    return {
      lab_id: labId,
      lab_name: LAB_DISPLAY_NAMES[labId] || labId.toUpperCase(),
      total_plans: labPlans.length,
      healthy_plans: Math.max(0, healthyPlans),
      overdue_plans: overduePlans,
      due_soon_plans: dueSoonPlans,
      health_status: healthStatus,
      last_service_date: lastLog?.service_date || null,
      next_target_date: nextTargetRem?.due_date || null,
    }
  })

  const overdueCount = processedReminders.filter((r) => r.is_overdue).length

  return {
    authorized: true,
    user_role: scope.role,
    kpi: {
      total_plans: processedPlans.length,
      active_reminders: processedReminders.length,
      overdue_count: overdueCount,
      completed_logs: processedLogs.length,
    },
    reminders: processedReminders,
    plans: processedPlans,
    logs: processedLogs,
    health_matrix: healthMatrix,
  }
}

/**
 * Log completed maintenance service.
 * Database trigger atomically resolves active reminder and spawns the next cycle.
 */
export async function logMaintenanceService(payload: {
  plan_id?: string | null
  reminder_id?: string | null
  lab_id: string
  asset_identifier: string
  work_performed: string
  checklist_completed?: string[]
  parts_replaced?: string | null
  cost_incurred?: number
  service_date?: string
  next_service_due?: string | null
  remarks?: string | null
}) {
  const { scope, isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only administrators, coordinators, and lab in-charges may log servicing.')
  }

  const supabase = (await createClient()) as any

  const serviceDate = payload.service_date || new Date().toISOString().split('T')[0]
  const cost = typeof payload.cost_incurred === 'number' ? payload.cost_incurred : 0

  const { data, error } = await supabase
    .from('maintenance_logs')
    .insert({
      plan_id: payload.plan_id || null,
      reminder_id: payload.reminder_id || null,
      lab_id: payload.lab_id,
      asset_identifier: payload.asset_identifier.trim(),
      work_performed: payload.work_performed.trim(),
      checklist_completed: payload.checklist_completed || [],
      parts_replaced: payload.parts_replaced?.trim() || null,
      cost_incurred: cost,
      service_date: serviceDate,
      performed_by_id: scope.userId,
      next_service_due: payload.next_service_due || null,
      remarks: payload.remarks?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to log maintenance service:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/admin')
  return { success: true, data }
}

/**
 * Snooze a reminder with mandatory reason note.
 */
export async function snoozeMaintenanceReminder(payload: {
  reminder_id: string
  snooze_days?: number
  custom_snooze_until?: string
  reason: string
}) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only lab in-charges and administrators can snooze maintenance reminders.')
  }

  if (!payload.reason || !payload.reason.trim()) {
    return { success: false, error: 'A mandatory snooze justification reason must be provided.' }
  }

  const supabase = (await createClient()) as any

  let snoozeUntilStr: string
  if (payload.custom_snooze_until) {
    snoozeUntilStr = payload.custom_snooze_until
  } else {
    const days = payload.snooze_days || 7
    const target = new Date()
    target.setDate(target.getDate() + days)
    snoozeUntilStr = target.toISOString().split('T')[0]
  }

  // Get current snooze count
  const { data: current, error: getErr } = await supabase
    .from('maintenance_reminders')
    .select('snooze_count')
    .eq('id', payload.reminder_id)
    .single()

  if (getErr) {
    return { success: false, error: getErr.message }
  }

  const newCount = (current?.snooze_count || 0) + 1

  const { error } = await supabase
    .from('maintenance_reminders')
    .update({
      status: 'snoozed',
      snoozed_until: snoozeUntilStr,
      snooze_reason: payload.reason.trim(),
      snooze_count: newCount,
    })
    .eq('id', payload.reminder_id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  return { success: true, snoozed_until: snoozeUntilStr }
}

/**
 * Create or update a recurring maintenance plan.
 * Trigger automatically generates Day-Zero initial reminder on insert.
 */
export async function saveMaintenancePlan(payload: {
  id?: string
  lab_id: string
  title: string
  category: string
  interval_days: number
  severity: 'low' | 'routine' | 'high' | 'critical'
  target_role?: string
  assigned_user_id?: string | null
  checklist?: string[]
  description?: string | null
  is_active?: boolean
}) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only administrators and lab in-charges can configure maintenance plans.')
  }

  const supabase = (await createClient()) as any

  if (payload.id) {
    const { data, error } = await supabase
      .from('maintenance_plans')
      .update({
        lab_id: payload.lab_id,
        title: payload.title.trim(),
        category: payload.category.trim(),
        interval_days: payload.interval_days,
        severity: payload.severity,
        target_role: payload.target_role || 'lab_incharge',
        assigned_user_id: payload.assigned_user_id || null,
        checklist: payload.checklist || [],
        description: payload.description?.trim() || null,
        is_active: payload.is_active !== undefined ? payload.is_active : true,
      })
      .eq('id', payload.id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/maintenance')
    revalidatePath('/admin')
    return { success: true, data }
  } else {
    const { data, error } = await supabase
      .from('maintenance_plans')
      .insert({
        lab_id: payload.lab_id,
        title: payload.title.trim(),
        category: payload.category.trim(),
        interval_days: payload.interval_days,
        severity: payload.severity,
        target_role: payload.target_role || 'lab_incharge',
        assigned_user_id: payload.assigned_user_id || null,
        checklist: payload.checklist || [],
        description: payload.description?.trim() || null,
        is_active: payload.is_active !== undefined ? payload.is_active : true,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/maintenance')
    revalidatePath('/admin')
    return { success: true, data }
  }
}

/**
 * Delete a maintenance plan and associated reminders.
 */
export async function deleteMaintenancePlan(planId: string) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only administrators and lab in-charges can delete maintenance plans.')
  }

  const supabase = (await createClient()) as any

  // Delete reminders linked to this plan first to avoid foreign key errors
  await supabase
    .from('maintenance_reminders')
    .delete()
    .eq('plan_id', planId)

  const { error } = await supabase
    .from('maintenance_plans')
    .delete()
    .eq('id', planId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/admin')
  return { success: true }
}

/**
 * Toggle active/paused status of a maintenance plan.
 */
export async function toggleMaintenancePlanStatus(planId: string, isActive: boolean) {
  const { isPrivileged } = await getAuthorizedProfile()
  if (!isPrivileged) {
    throw new Error('Unauthorized: Only administrators and lab in-charges can modify maintenance plans.')
  }

  const supabase = (await createClient()) as any

  const { error } = await supabase
    .from('maintenance_plans')
    .update({ is_active: isActive })
    .eq('id', planId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/maintenance')
  revalidatePath('/admin')
  return { success: true }
}

/**
 * Lightweight health check for dashboard KPI tile:
 * Dynamically computes overdue maintenance tasks where COALESCE(snoozed_until, due_date) < CURRENT_DATE
 */
export async function getMaintenanceHealthSummary(): Promise<{
  active_reminders: number
  overdue_reminders: number
}> {
  try {
    const supabase = (await createClient()) as any
    const todayStr = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('maintenance_reminders')
      .select('id, due_date, status, snoozed_until')
      .neq('status', 'completed')

    if (error || !data) {
      return { active_reminders: 0, overdue_reminders: 0 }
    }

    let overdue = 0
    for (const r of data) {
      const effectiveDate = (r.status === 'snoozed' && r.snoozed_until) ? r.snoozed_until : r.due_date
      if (effectiveDate && effectiveDate < todayStr) {
        overdue++
      }
    }

    return {
      active_reminders: data.length,
      overdue_reminders: overdue,
    }
  } catch (err) {
    console.error('Error in getMaintenanceHealthSummary:', err)
    return { active_reminders: 0, overdue_reminders: 0 }
  }
}

