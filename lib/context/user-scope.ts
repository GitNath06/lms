import type { UserProfile, UserRole } from '../permissions'
export interface TeacherAssignment {
  teacherId: string
  name: string
  email: string
  department?: string
  assignedClasses: string[]
  assignedSubjects: Array<{
    code: string
    title: string
    grade: string
    labId: string
    labName: string
    defaultTopic?: string
  }>
  assignedLabIds: string[]
}

export interface UserScopeContext {
  userId: string
  fullName: string
  email: string
  role: UserRole
  department: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
  isPending: boolean
  isPrivileged: boolean // super_admin, hod, lab_incharge (only when approved)
  isTeacher: boolean
  
  // Scoped Responsibilities:
  assignedLabIds: string[]
  assignedClasses: string[]
  assignedSubjects: Array<{
    code: string
    title: string
    grade: string
    labId: string
    labName: string
    defaultTopic?: string
  }>
  
  // Default and active scoping
  defaultViewMode: 'my_data' | 'institutional'
  teacherProfile: TeacherAssignment | null
}

/**
 * Pure function to calculate user scope from a profile
 */
export function resolveUserScope(profile: UserProfile | null): UserScopeContext {
  if (!profile) {
    // Default guest / unauthenticated scope
    return {
      userId: '',
      fullName: 'Guest User',
      email: '',
      role: 'teacher',
      department: '',
      approvalStatus: 'pending',
      isPending: true,
      isPrivileged: false,
      isTeacher: false,
      assignedLabIds: [],
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: 'my_data',
      teacherProfile: null,
    }
  }

  const role = profile.role
  const isPending = profile.approval_status === 'pending'
  const isRejected = profile.approval_status === 'rejected'
  // STRICT FAIL-CLOSED: only exact 'approved' status grants authorized scope
  const isApproved = profile.approval_status === 'approved'
  const approvalStatus = isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'
  const isActive = Boolean((profile as any)?.is_active ?? true)

  // Privileged strictly if role is administrative AND account is officially approved AND active
  const isPrivileged =
    isApproved &&
    isActive &&
    (role === 'super_admin' || role === 'hod' || role === 'lab_incharge')
  const isTeacher = isApproved && isActive && role === 'teacher'

  // If user is pending approval, strictly isolate their scope
  if (isPending) {
    return {
      userId: profile.id,
      fullName: profile.full_name,
      email: profile.email || '',
      role: profile.role,
      department: profile.department || '',
      approvalStatus: 'pending',
      isPending: true,
      isPrivileged: false,
      isTeacher: false,
      assignedLabIds: [],
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: 'my_data',
      teacherProfile: null,
    }
  }

  // If user is rejected, deactivated, or not officially approved, completely lock down their scope
  if (!isApproved || !isActive) {
    return {
      userId: profile.id,
      fullName: profile.full_name,
      email: profile.email || '',
      role: profile.role,
      department: profile.department || '',
      approvalStatus: isRejected ? 'rejected' : isPending ? 'pending' : (!isActive ? 'rejected' : 'pending'),
      isPending: isPending,
      isPrivileged: false,
      isTeacher: false,
      assignedLabIds: [],
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: 'my_data',
      teacherProfile: null,
    }
  }

  if (isPrivileged) {
    // Privileged users have institutional access across all labs, classes, and subjects.
    // Zero hardcoded arrays: UI filters and server actions query live PostgreSQL directly.
    return {
      userId: profile.id,
      fullName: profile.full_name,
      email: profile.email || '',
      role,
      department: profile.department || '',
      approvalStatus: 'approved',
      isPending: false,
      isPrivileged: true,
      isTeacher: false,
      assignedLabIds: [],
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: 'institutional',
      teacherProfile: null,
    }
  }

  // Regular teacher scope: strictly scoped to assigned curriculum from PostgreSQL
  return {
    userId: profile.id,
    fullName: profile.full_name,
    email: profile.email || '',
    role: 'teacher',
    department: profile.department || '',
    approvalStatus: 'approved',
    isPending: false,
    isPrivileged: false,
    isTeacher: true,
    assignedLabIds: [],
    assignedClasses: [],
    assignedSubjects: [],
    defaultViewMode: 'my_data',
    teacherProfile: null,
  }
}


