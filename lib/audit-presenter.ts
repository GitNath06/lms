import type { AuditLogItem } from '../types/audit'

const KNOWN_LAB_ROOMS = [
  { id: 'comp', name: 'Computer Engineering Lab 01', code: 'LAB-COMP-01' },
  { id: 'phys', name: 'Physics Laboratory', code: 'LAB-PHYS-01' },
  { id: 'chem', name: 'Chemistry Laboratory', code: 'LAB-CHEM-01' },
  { id: 'bio', name: 'Biology & Life Sciences Lab', code: 'LAB-BIO-01' },
  { id: 'elec', name: 'Electronics & Hardware Lab', code: 'LAB-ELEC-01' },
]

/**
 * System and low-level internal database keys that should NOT clutter
 * high-level administrative summaries or primary diff comparisons.
 */
export const INTERNAL_SYSTEM_KEYS = new Set([
  'span',
  'is_merged',
  'created_at',
  'updated_at',
  'id',
  'schedule_id',
  'plan_id',
  '_keysCount',
  'created_by',
  'source',
  'metadata_raw',
])

export function isInternalSystemKey(key: string): boolean {
  return INTERNAL_SYSTEM_KEYS.has(key)
}

/**
 * Institutional mapping dictionary: Translates raw database column names
 * into natural, academic and facility terminology.
 */
export const FIELD_LABELS: Record<string, string> = {
  // Schedules & Timetable
  subject_name: 'Subject / Practical',
  batch_name: 'Target Class Batch',
  start_time: 'Start Time',
  end_time: 'End Time',
  time_slot: 'Timetable Slot',
  lab_id: 'Laboratory Facility',
  lab_name: 'Laboratory Facility',
  teacher_id: 'Assigned Instructor',
  teacher: 'Assigned Instructor',
  is_skipped: 'Practical Skipped',
  skip_reason: 'Skip Justification',
  students_count: 'Registered Students',
  studentsCount: 'Registered Students',
  grade: 'Class Grade Level',

  // Facilities & Labs
  name: 'Facility Name',
  code: 'Institutional Code',
  capacity: 'Workstation Capacity',
  status: 'Operational Status',
  type: 'Facility Type',

  // Governance & Policies
  precaution_active: 'Precaution Safety Lock',
  edit_mode_unlocked: 'Infrastructure Edit Mode',
  sundayWeekend: 'Sunday Recess Policy',
  saturdayWeekend: 'Saturday Statutory Holiday',

  // Incidents & Taxonomy
  severity: 'Incident Severity Tier',
  sla_hours: 'Resolution SLA Target',
  scope: 'Laboratory Discipline Scope',
  equipment_name: 'Equipment / Apparatus',
  resolution_notes: 'Resolution Notes',
  resolved_at: 'Resolution Timestamp',

  // Identity & Roles
  role: 'Assigned User Role',
  is_active: 'Account Active Status',
  permissions: 'Access Permission Matrix',
  full_name: 'Full Name',
  email: 'Email Address',

  // Curriculum
  title: 'Curriculum Course Title',
  quota: 'Weekly Practical Quota',
}

export function getHumanFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  // Fallback: convert snake_case or camelCase to Capitalized Words
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim()
}

/**
 * Maps shorthand lab identifiers (e.g. 'chem', 'comp') to human-readable names.
 */
export function resolveLabName(labIdOrKey?: string | null): string {
  if (!labIdOrKey) return 'Unassigned Laboratory'
  const found = KNOWN_LAB_ROOMS.find(
    (l) => l.id.toLowerCase() === labIdOrKey.toLowerCase() || l.code.toLowerCase() === labIdOrKey.toLowerCase()
  )
  if (found) return found.name
  if (labIdOrKey.toLowerCase().includes('chem')) return 'Chemistry Laboratory'
  if (labIdOrKey.toLowerCase().includes('comp')) return 'Computer Engineering Lab'
  if (labIdOrKey.toLowerCase().includes('phys')) return 'Physics Laboratory'
  if (labIdOrKey.toLowerCase().includes('bio')) return 'Biology & Life Sciences Lab'
  if (labIdOrKey.toLowerCase().includes('elec')) return 'Electronics & Hardware Lab'
  return labIdOrKey
}

/**
 * Formats values into clean, human-readable representations.
 */
export interface FormattedValue {
  display: string
  isNull: boolean
  isInitial?: boolean
  badgeStyle?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'zinc'
  subDetails?: Array<{ label: string; value: string }>
}

export function formatAuditValue(key: string, val: any): FormattedValue {
  if (val === undefined || val === null || val === 'null') {
    return {
      display: 'Unassigned (Initial)',
      isNull: true,
      isInitial: true,
    }
  }

  // Handle boolean values
  if (typeof val === 'boolean') {
    if (key === 'precaution_active') {
      return {
        display: val ? 'Active (Infrastructure Guarded)' : 'Disabled (Edit Mode Unlocked)',
        isNull: false,
        badgeStyle: val ? 'zinc' : 'amber',
      }
    }
    if (key === 'edit_mode_unlocked') {
      return {
        display: val ? 'Unlocked (Modifications Permitted)' : 'Locked (Protected)',
        isNull: false,
        badgeStyle: val ? 'amber' : 'zinc',
      }
    }
    if (key === 'is_skipped') {
      return {
        display: val ? 'Skipped' : 'Conducted Normally',
        isNull: false,
        badgeStyle: val ? 'rose' : 'emerald',
      }
    }
    if (key === 'is_active') {
      return {
        display: val ? 'Active Account' : 'Deactivated',
        isNull: false,
        badgeStyle: val ? 'emerald' : 'rose',
      }
    }
    return {
      display: val ? 'Enabled' : 'Disabled',
      isNull: false,
      badgeStyle: val ? 'emerald' : 'zinc',
    }
  }

  // Handle Lab IDs
  if (key === 'lab_id' || key === 'labKey' || key === 'secondaryLabKey') {
    return {
      display: resolveLabName(String(val)),
      isNull: false,
      badgeStyle: 'indigo',
    }
  }

  // Handle Operational Statuses
  if (key === 'status') {
    const s = String(val).toLowerCase()
    if (s === 'operational') {
      return { display: 'Operational', isNull: false, badgeStyle: 'emerald' }
    }
    if (s.includes('maintenance') || s.includes('servicing')) {
      return { display: 'Under Maintenance', isNull: false, badgeStyle: 'amber' }
    }
    if (s === 'inactive' || s === 'disabled') {
      return { display: 'Inactive', isNull: false, badgeStyle: 'zinc' }
    }
    if (s === 'scheduled' || s === 'confirmed') {
      return { display: 'Scheduled / Confirmed', isNull: false, badgeStyle: 'indigo' }
    }
    if (s === 'skipped') {
      return { display: 'Skipped Session', isNull: false, badgeStyle: 'rose' }
    }
    return { display: String(val), isNull: false, badgeStyle: 'slate' }
  }

  // Handle Capacity
  if (key === 'capacity') {
    return {
      display: `${val} Workstations`,
      isNull: false,
    }
  }

  // Handle SLA Hours
  if (key === 'sla_hours') {
    return {
      display: `${val} Hours Target`,
      isNull: false,
    }
  }

  // Handle Severity
  if (key === 'severity') {
    const s = String(val).toLowerCase()
    if (s === 'critical') return { display: 'Critical Hazard', isNull: false, badgeStyle: 'rose' }
    if (s === 'high') return { display: 'High Priority', isNull: false, badgeStyle: 'amber' }
    if (s === 'medium') return { display: 'Medium', isNull: false, badgeStyle: 'indigo' }
    return { display: 'Low Priority', isNull: false, badgeStyle: 'zinc' }
  }

  // Handle Timetable Metadata object
  if (key === 'metadata' && typeof val === 'object' && val !== null) {
    const subDetails: Array<{ label: string; value: string }> = []
    if (val.labName) subDetails.push({ label: 'Laboratory', value: val.labName })
    if (val.teacher) subDetails.push({ label: 'Instructor', value: val.teacher })
    if (val.studentsCount) subDetails.push({ label: 'Students', value: `${val.studentsCount} Students` })
    if (val.is_multi_lab !== undefined) {
      subDetails.push({ label: 'Facility Mode', value: val.is_multi_lab ? 'Dual-Facility' : 'Standard Lab' })
    }

    return {
      display: subDetails.length > 0 ? `${subDetails.map((s) => `${s.label}: ${s.value}`).join(' • ')}` : 'Session Parameters',
      isNull: false,
      subDetails,
    }
  }

  // Handle ISO Dates
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    try {
      const d = new Date(val)
      return {
        display: d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        isNull: false,
      }
    } catch {
      return { display: val, isNull: false }
    }
  }

  // Handle Objects / Arrays
  if (typeof val === 'object' && val !== null) {
    try {
      return { display: JSON.stringify(val), isNull: false }
    } catch {
      return { display: String(val), isNull: false }
    }
  }

  return { display: String(val), isNull: false }
}

/**
 * Operational Guidance & Intelligence Engine:
 * Generates an executive narrative and actionable guidance for administrators.
 */
export interface OperationalGuidance {
  headline: string
  narrative: string
  impactMessage: string
  actionAdvice: string
  severityLevel: 'info' | 'warning' | 'caution' | 'success'
}

export function generateOperationalGuidance(log: AuditLogItem): OperationalGuidance {
  const { action, entity_type, entity_label, changes } = log
  const after = changes?.after || {}
  const before = changes?.before || {}

  // 1. LAB FACILITY STATUS CHANGES
  if (entity_type === 'lab' && after.status) {
    const nextStatus = String(after.status)
    const prevStatus = before.status ? String(before.status) : 'Operational'

    if (nextStatus.toLowerCase() === 'under maintenance') {
      return {
        headline: 'Facility Under Maintenance',
        narrative: `${entity_label} was transitioned from "${prevStatus}" to "Under Maintenance".`,
        impactMessage:
          'Practical bookings and live practical logging for this laboratory are automatically suspended. Timetable pods will reflect maintenance status.',
        actionAdvice:
          'Inform scheduled teachers to conduct theoretical instruction or reschedule to alternate rooms. Restore status to "Operational" once servicing and hardware checks are verified.',
        severityLevel: 'warning',
      }
    }

    if (nextStatus.toLowerCase() === 'operational') {
      return {
        headline: 'Facility Restored to Active Operation',
        narrative: `${entity_label} has been restored to active "Operational" status.`,
        impactMessage:
          'Laboratory is now fully available for practical classes, student roll-call, and timetable scheduling.',
        actionAdvice:
          'Verify that laboratory workstations, apparatus, and safety protocols are ready for faculty and student use.',
        severityLevel: 'success',
      }
    }
  }

  // 2. LAB CAPACITY CHANGES
  if (entity_type === 'lab' && after.capacity !== undefined) {
    const prevCap = before.capacity !== undefined ? before.capacity : 'previous'
    const newCap = after.capacity
    const diff = typeof prevCap === 'number' ? newCap - prevCap : null
    const diffStr = diff !== null ? (diff > 0 ? `(+${diff})` : `(${diff})`) : ''

    return {
      headline: 'Workstation Capacity Adjusted',
      narrative: `${entity_label} workstation capacity was modified from ${prevCap} to ${newCap} stations ${diffStr}.`,
      impactMessage: `Maximum concurrent practical capacity is now strictly governed at ${newCap} students.`,
      actionAdvice:
        'Verify that class enrollment batches assigned to this facility do not exceed the new capacity ceiling to maintain safety and equipment ratios.',
      severityLevel: 'info',
    }
  }

  // 3. TIMETABLE / SCHEDULE CREATION & UPDATES
  if (entity_type === 'schedule') {
    if (action === 'DELETE') {
      return {
        headline: 'Timetable Slot Purged',
        narrative: `${entity_label} was permanently removed from the institutional master routine.`,
        impactMessage:
          'This practical session will no longer appear on daily faculty dashboards or class timetables.',
        actionAdvice:
          'Verify that assigned instructors are aware of the removal and that student syllabus requirements remain balanced.',
        severityLevel: 'warning',
      }
    }

    const subject = after.subject_name || before.subject_name || entity_label
    const batch = after.batch_name || before.batch_name || 'Class Batch'
    const labName = resolveLabName(after.lab_id || before.lab_id)
    const timeRange = after.start_time && after.end_time ? `${after.start_time} – ${after.end_time}` : ''

    return {
      headline: 'Practical Session Allocated / Modified',
      narrative: `Scheduled "${subject}" for ${batch} in ${labName}${timeRange ? ` (${timeRange})` : ''}.`,
      impactMessage:
        'Timetable grids and teacher session rosters are synchronized with this allocation.',
      actionAdvice:
        'Ensure the laboratory in-charge prepares apparatus/workstations prior to the scheduled period and subject teachers submit roll-call attendance upon completion.',
      severityLevel: 'info',
    }
  }

  // 4. PRECAUTION ACTIVE SAFETY LOCK
  if (entity_type === 'policy' && (after.precaution_active !== undefined || after.edit_mode_unlocked !== undefined)) {
    const isUnlocked = after.edit_mode_unlocked === true || after.precaution_active === false

    if (isUnlocked) {
      return {
        headline: 'Administrative Precaution Lock Disabled',
        narrative: 'Super Administrator unlocked Edit Mode, bypassing the Precaution Active safety guard.',
        impactMessage:
          'Destructive administrative mutations (timetable wipes, role alterations, category purges, syllabus shifts) are currently permitted.',
        actionAdvice:
          'Perform required infrastructure modifications carefully. Immediately re-lock "Precaution Active" once finished to protect institutional data from accidental loss.',
        severityLevel: 'caution',
      }
    } else {
      return {
        headline: 'Administrative Precaution Guard Engaged',
        narrative: 'Precaution Active safety lock has been re-enabled by the administrator.',
        impactMessage: 'Institutional infrastructure is secured against accidental edits or destructive deletions.',
        actionAdvice: 'System is operating in standard safeguarded mode. No further action needed.',
        severityLevel: 'success',
      }
    }
  }

  // 5. INCIDENT CATEGORY & SLA
  if (entity_type === 'incident_category') {
    const sev = after.severity ? String(after.severity).toUpperCase() : 'STANDARD'
    const sla = after.sla_hours !== undefined ? `${after.sla_hours} hours` : 'Default'

    return {
      headline: 'Incident Governance & SLA Updated',
      narrative: `Taxonomy rule for "${entity_label}" updated: Severity ${sev}, SLA target ${sla}.`,
      impactMessage:
        'All new and active incident reports classified under this category will adhere to the revised escalation window.',
      actionAdvice:
        'Notify laboratory technicians and HOD of the updated SLA targets to ensure timely resolution of apparatus faults.',
      severityLevel: 'info',
    }
  }

  // 6. USER ACCESS & ROLES
  if (entity_type === 'user_role') {
    const newRole = after.role ? String(after.role).toUpperCase() : 'MODIFIED'
    return {
      headline: 'User Access Credentials Modified',
      narrative: `Account permissions for "${entity_label}" were elevated or shifted to ${newRole}.`,
      impactMessage:
        'User will have immediate access to the permissions and scopes associated with this institutional role upon their next action.',
      actionAdvice:
        'Verify that this role assignment aligns with institutional policy and that the staff member is aware of their operational responsibilities.',
      severityLevel: 'caution',
    }
  }

  // Default Fallback
  return {
    headline: `${action} Mutation Recorded`,
    narrative: `${action} operation completed on ${entity_label} (${entity_type}).`,
    impactMessage: 'Audit ledger captured cryptographic diff between states.',
    actionAdvice: 'Review key-by-key changes below to verify compliance with administrative intentions.',
    severityLevel: 'info',
  }
}
