import { LAB_ROOMS, DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '@/lib/master-data'
import {
  INSTITUTIONAL_TEACHERS,
  getTeacherAssignments,
} from '@/lib/context/institutional-relationships'
import { UserScopeContext } from '@/lib/context/user-scope'

export interface CascadingSelections {
  labId?: string
  classBatch?: string
  subjectCode?: string
  teacherId?: string
}

export interface CascadingOptions {
  validLabs: Array<{ id: string; name: string }>
  validClasses: Array<{ id: string; name: string; fullName: string }>
  validSubjects: Array<{ code: string; title: string; grade: string; labId: string; labName: string }>
  validTeachers: Array<{ id: string; name: string; email: string }>
}

/**
 * Pure calculation of dynamic cascading options based on current user scope and active selections.
 */
export function getCascadingOptions(
  scope: UserScopeContext,
  selections: CascadingSelections = {}
): CascadingOptions {
  const { labId, classBatch, subjectCode, teacherId } = selections

  // 1. Initial base set based on user role
  let baseTeachers = scope.isPrivileged
    ? INSTITUTIONAL_TEACHERS.map((t) => ({ id: t.teacherId, name: t.name, email: t.email }))
    : [{ id: scope.userId || 'self', name: scope.fullName, email: scope.email }]

  let baseLabs = LAB_ROOMS.filter((l) => scope.isPrivileged || scope.assignedLabIds.includes(l.id))
  let baseClasses = DEFAULT_CLASSES.filter((c) => scope.isPrivileged || scope.assignedClasses.includes(c.name))
  let baseSubjects = scope.isPrivileged
    ? DEFAULT_SUBJECTS.map((s) => ({ code: s.code, title: s.title, grade: s.grade, labId: s.labId, labName: s.lab }))
    : scope.assignedSubjects

  // 2. Cascade by teacher selection
  const activeTeacherId = (!scope.isPrivileged ? scope.fullName : teacherId) || ''
  if (activeTeacherId && activeTeacherId !== 'all') {
    const teacherData = getTeacherAssignments(activeTeacherId)
    if (teacherData) {
      baseClasses = baseClasses.filter((c) => teacherData.assignedClasses.includes(c.name))
      baseSubjects = baseSubjects.filter((s) => teacherData.assignedSubjects.some((ts) => ts.code === s.code))
      baseLabs = baseLabs.filter((l) => teacherData.assignedLabIds.includes(l.id))
    }
  }

  // 3. Cascade by Lab selection
  if (labId && labId !== 'all') {
    baseSubjects = baseSubjects.filter((s) => s.labId === labId)
    const validGradesInLab = new Set(baseSubjects.map((s) => s.grade))
    baseClasses = baseClasses.filter((c) => validGradesInLab.has(c.name))
  }

  // 4. Cascade by Class/Grade selection
  if (classBatch && classBatch !== 'all') {
    const cleanClass = classBatch.trim().replace(/^Class\s+/i, '').toLowerCase()
    baseSubjects = baseSubjects.filter((s) => {
      const sGrade = s.grade.trim().replace(/^Class\s+/i, '').toLowerCase()
      return sGrade === cleanClass || sGrade.startsWith(cleanClass) || cleanClass.startsWith(sGrade)
    })
    const validLabsInClass = new Set(baseSubjects.map((s) => s.labId))
    baseLabs = baseLabs.filter((l) => validLabsInClass.has(l.id))
  }

  // 5. Cascade by Subject selection
  if (subjectCode && subjectCode !== 'all') {
    const cleanSubCode = subjectCode.split(/[\s-—]/)[0].toUpperCase()
    const targetSub = DEFAULT_SUBJECTS.find((s) => s.code.toUpperCase().startsWith(cleanSubCode))
    if (targetSub) {
      baseLabs = baseLabs.filter((l) => l.id === targetSub.labId)
      baseClasses = baseClasses.filter((c) => c.name === targetSub.grade)
    }
  }

  return {
    validLabs: baseLabs.map((l) => ({ id: l.id, name: l.name })),
    validClasses: baseClasses.map((c) => ({ id: c.id, name: c.name, fullName: c.fullName })),
    validSubjects: baseSubjects,
    validTeachers: baseTeachers,
  }
}
