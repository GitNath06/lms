import type { UserProfile, UserRole } from '../permissions'
import {
  getTeacherAssignments,
  type TeacherAssignment,
  INSTITUTIONAL_TEACHERS,
} from './institutional-relationships'
import { LAB_ROOMS, DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '../master-data'

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
  // CRITICAL FIX: Unmatched / unassigned teachers receive empty scope, NEVER institutional broad defaults
  const assignedClasses = teacherAssign?.assignedClasses || []
  const assignedSubjects = teacherAssign?.assignedSubjects || []
  const assignedLabIds = teacherAssign?.assignedLabIds || []

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


