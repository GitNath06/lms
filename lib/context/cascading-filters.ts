import { LAB_ROOMS, DEFAULT_CLASSES, DEFAULT_SUBJECTS } from '@/lib/master-data'
import {
  INSTITUTIONAL_TEACHERS,
  getTeacherAssignments,
  matchesGrade,
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

export interface CascadingCustomData {
  classes?: Array<{ id: string; name: string; stream?: string; capacity?: number }>
  subjects?: Array<{ code: string; title: string; grade: string; labId?: string; lab?: string; teacherId?: string; teacherName?: string }>
  labs?: Array<{ id: string; name: string }>
  teachers?: Array<{ id: string; name?: string; full_name?: string; email?: string }>
}

/**
 * Pure calculation of dynamic cascading options based on current user scope and active selections.
 */
export function getCascadingOptions(
  scope: UserScopeContext,
  selections: CascadingSelections = {},
  customData?: CascadingCustomData
): CascadingOptions {
  const { labId, classBatch, subjectCode, teacherId } = selections

  // 1. Initial base set based on user role and customData
  let baseTeachers = customData?.teachers && customData.teachers.length > 0
    ? customData.teachers.map((t) => ({ id: t.id, name: t.name || t.full_name || 'Faculty', email: t.email || '' }))
    : scope.isPrivileged
    ? INSTITUTIONAL_TEACHERS.map((t) => ({ id: t.teacherId, name: t.name, email: t.email }))
    : [{ id: scope.userId || 'self', name: scope.fullName, email: scope.email }]

  let rawLabs = (customData?.labs && customData.labs.length > 0) ? customData.labs : LAB_ROOMS
  let baseLabs = rawLabs.filter((l) => scope.isPrivileged || scope.assignedLabIds.includes(l.id))

  let rawClasses = (customData?.classes && customData.classes.length > 0)
    ? customData.classes.map((c) => ({
        id: c.id,
        name: c.name,
        fullName: c.stream ? `${c.name} (${c.stream})` : c.name,
      }))
    : DEFAULT_CLASSES.map((c) => ({ id: c.id, name: c.name, fullName: c.fullName }))
  let baseClasses = rawClasses.filter((c) => scope.isPrivileged || scope.assignedClasses.includes(c.name))

  let rawSubjects = (customData?.subjects && customData.subjects.length > 0)
    ? customData.subjects.map((s) => ({
        code: s.code,
        title: s.title,
        grade: s.grade,
        labId: s.labId || 'comp',
        labName: s.lab || 'Laboratory',
      }))
    : DEFAULT_SUBJECTS.map((s) => ({
        code: s.code,
        title: s.title,
        grade: s.grade,
        labId: s.labId,
        labName: s.lab,
      }))
  let baseSubjects = scope.isPrivileged ? rawSubjects : scope.assignedSubjects

  // 2. Cascade by teacher selection
  const activeTeacherId = (!scope.isPrivileged ? scope.fullName : teacherId) || ''
  if (activeTeacherId && activeTeacherId !== 'all') {
    const teacherData = getTeacherAssignments(activeTeacherId)
    if (teacherData) {
      baseClasses = baseClasses.filter((c) =>
        teacherData.assignedClasses.some((ac) => matchesGrade(ac, c.name))
      )
      baseSubjects = baseSubjects.filter((s) =>
        teacherData.assignedSubjects.some((ts) => ts.code.toLowerCase() === s.code.toLowerCase())
      )
      baseLabs = baseLabs.filter((l) => teacherData.assignedLabIds.includes(l.id))
    }
  }

  // 3. Cascade by Lab selection
  if (labId && labId !== 'all') {
    const labFilteredSubs = baseSubjects.filter((s) => s.labId === labId)
    if (labFilteredSubs.length > 0) {
      baseSubjects = labFilteredSubs
      baseClasses = baseClasses.filter((c) =>
        labFilteredSubs.some((s) => matchesGrade(s.grade, c.name))
      )
    }
  }

  // 4. Cascade by Class/Grade selection
  if (classBatch && classBatch !== 'all') {
    const classFilteredSubs = baseSubjects.filter((s) => matchesGrade(s.grade, classBatch))
    if (classFilteredSubs.length > 0) {
      baseSubjects = classFilteredSubs
      const validLabsInClass = new Set(classFilteredSubs.map((s) => s.labId))
      baseLabs = baseLabs.filter((l) => validLabsInClass.has(l.id))
    }
  }

  // 5. Cascade by Subject selection
  if (subjectCode && subjectCode !== 'all') {
    const cleanSubCode = subjectCode.split(/[\s-—]/)[0].toUpperCase()
    const targetSub = baseSubjects.find((s) => s.code.toUpperCase().startsWith(cleanSubCode))
    if (targetSub) {
      baseLabs = baseLabs.filter((l) => l.id === targetSub.labId)
      baseClasses = baseClasses.filter((c) => matchesGrade(c.name, targetSub.grade))
    }
  }

  return {
    validLabs: baseLabs.map((l) => ({ id: l.id, name: l.name })),
    validClasses: baseClasses,
    validSubjects: baseSubjects,
    validTeachers: baseTeachers,
  }
}

