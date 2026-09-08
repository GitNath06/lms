import { UserProfile, UserRole } from '@/lib/permissions'
import { getCurrentUserProfile } from '@/app/actions/auth'
import {
  getTeacherAssignments,
  TeacherAssignment,
  INSTITUTIONAL_TEACHERS,
} from '@/lib/context/institutional-relationships'
import { LAB_ROOMS, DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '@/lib/master-data'

export interface UserScopeContext {
  userId: string
  fullName: string
  email: string
  role: UserRole
  department: string
  isPrivileged: boolean // super_admin, hod, lab_incharge
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
      department: 'Science & Technology',
      isPrivileged: false,
      isTeacher: true,
      assignedLabIds: [],
      assignedClasses: [],
      assignedSubjects: [],
      defaultViewMode: 'my_data',
      teacherProfile: null,
    }
  }

  const role = profile.role
  const isPrivileged = role === 'super_admin' || role === 'hod' || role === 'lab_incharge'
  const isTeacher = role === 'teacher'

  // If user is a teacher or specifically assigned, resolve their curriculum responsibilities
  const teacherAssign = getTeacherAssignments(profile.id) ||
    getTeacherAssignments(profile.email) ||
    getTeacherAssignments(profile.full_name)

  if (isPrivileged) {
    // Privileged users have institutional access across all labs, classes, and subjects
    return {
      userId: profile.id,
      fullName: profile.full_name,
      email: profile.email || '',
      role,
      department: profile.department || 'Science & Technology Laboratories',
      isPrivileged: true,
      isTeacher: false,
      assignedLabIds: LAB_ROOMS.map((l) => l.id),
      assignedClasses: DEFAULT_CLASSES.map((c) => c.name),
      assignedSubjects: DEFAULT_SUBJECTS.map((s) => ({
        code: s.code,
        title: s.title,
        grade: s.grade,
        labId: s.labId,
        labName: s.lab,
        defaultTopic: s.defaultTopic,
      })),
      defaultViewMode: 'institutional',
      teacherProfile: teacherAssign,
    }
  }

  // Regular teacher scope: strictly scoped to assigned curriculum
  const assignedClasses = teacherAssign?.assignedClasses || DEFAULT_CLASSES.map((c) => c.name)
  const assignedSubjects = teacherAssign?.assignedSubjects || DEFAULT_SUBJECTS.map((s) => ({
    code: s.code,
    title: s.title,
    grade: s.grade,
    labId: s.labId,
    labName: s.lab,
    defaultTopic: s.defaultTopic,
  }))
  const assignedLabIds = teacherAssign?.assignedLabIds || LAB_ROOMS.map((l) => l.id)

  return {
    userId: profile.id,
    fullName: profile.full_name,
    email: profile.email || '',
    role: 'teacher',
    department: profile.department || teacherAssign?.department || 'Science Department',
    isPrivileged: false,
    isTeacher: true,
    assignedLabIds,
    assignedClasses,
    assignedSubjects,
    defaultViewMode: 'my_data',
    teacherProfile: teacherAssign,
  }
}

/**
 * Server-side helper to get the authenticated user's scope context
 */
export async function getServerUserScope(): Promise<UserScopeContext> {
  const profile = await getCurrentUserProfile()
  return resolveUserScope(profile)
}
