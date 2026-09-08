export type UserRole = 'super_admin' | 'lab_incharge' | 'hod' | 'teacher'

export interface UserPermissions {
  can_view_logs?: boolean
  can_create_logs?: boolean
  can_delete_logs?: boolean
  can_view_incidents?: boolean
  can_report_incidents?: boolean
  can_manage_incidents?: boolean
  can_resolve_incidents?: boolean
  can_manage_schedules?: boolean
  can_manage_maintenance?: boolean
  can_manage_users?: boolean
  can_access_admin?: boolean
}

export interface UserProfile {
  id: string
  email?: string | null
  phone?: string | null
  full_name: string
  role: UserRole
  department: string | null
  is_active: boolean
  approval_status?: 'pending' | 'approved' | 'rejected' | null
  permissions?: UserPermissions
  custom_permissions?: UserPermissions
  created_at: string
}

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  super_admin: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: true,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: true,
    can_manage_maintenance: true,
    can_manage_users: true,
    can_access_admin: true,
  },
  lab_incharge: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: true,
    can_manage_maintenance: true,
    can_manage_users: false,
    can_access_admin: false,
  },
  hod: {
    can_view_logs: true,
    can_create_logs: false,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: true,
    can_resolve_incidents: true,
    can_manage_schedules: false,
    can_manage_maintenance: true,
    can_manage_users: false,
    can_access_admin: false,
  },
  teacher: {
    can_view_logs: true,
    can_create_logs: true,
    can_delete_logs: false,
    can_view_incidents: true,
    can_report_incidents: true,
    can_manage_incidents: false,
    can_resolve_incidents: false,
    can_manage_schedules: false,
    can_manage_maintenance: false,
    can_manage_users: false,
    can_access_admin: false,
  },
}
