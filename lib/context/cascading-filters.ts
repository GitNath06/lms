import { matchesGrade } from '@/lib/master-data'
import type { UserScopeContext } from '@/lib/context/user-scope'

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
 * For privileged users (super_admin, hod, lab_incharge), allows all rows returned from PostgreSQL directly.
 */
export function getCascadingOptions(
  scope: UserScopeContext,
  selections: CascadingSelections = {},
  customData?: CascadingCustomData
): CascadingOptions {
  const { labId, classBatch, subjectCode, teacherId } = selections

  // 1. Initial base set based on user role and live PostgreSQL customData
  let baseTeachers = customData?.teachers && customData.teachers.length > 0
    ? customData.teachers.map((t) => ({ id: t.id, name: t.name || t.full_name || 'Faculty', email: t.email || '' }))
    : scope.isPrivileged
    ? []
    : [{ id: scope.userId || 'self', name: scope.fullName, email: scope.email }]

  let rawLabs = (customData?.labs && customData.labs.length > 0)
    ? customData.labs
    : (!scope.isPrivileged && scope.assignedLabIds && scope.assignedLabIds.length > 0)
    ? scope.assignedLabIds.map((id) => ({ id, name: id.toUpperCase() }))
    : []
  let baseLabs = scope.isPrivileged ? rawLabs : rawLabs.filter((l) => scope.assignedLabIds.includes(l.id))

  let rawClasses = (customData?.classes && customData.classes.length > 0)
    ? customData.classes.map((c) => ({
        id: c.id,
        name: c.name,
        fullName: c.stream ? `${c.name} (${c.stream})` : c.name,
      }))
    : (!scope.isPrivileged && scope.assignedClasses && scope.assignedClasses.length > 0)
    ? scope.assignedClasses.map((clsName) => ({
        id: clsName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        name: clsName,
        fullName: clsName,
      }))
    : []
  let baseClasses = scope.isPrivileged ? rawClasses : rawClasses.filter((c) => scope.assignedClasses.includes(c.name))

  let rawSubjects = (customData?.subjects && customData.subjects.length > 0)
    ? customData.subjects.map((s: any) => ({
        code: s.code,
        title: s.title || s.name || s.code,
        grade: s.grade,
        labId: s.labId || 'comp',
        labName: s.lab || 'Laboratory',
      }))
    : (!scope.isPrivileged && scope.assignedSubjects && scope.assignedSubjects.length > 0)
    ? scope.assignedSubjects
    : []
  let baseSubjects = scope.isPrivileged ? rawSubjects : (scope.assignedSubjects.length > 0 ? scope.assignedSubjects : rawSubjects)

  // 2. Cascade by teacher selection
  const activeTeacherId = (!scope.isPrivileged ? scope.fullName : teacherId) || ''
  if (activeTeacherId && activeTeacherId !== 'all') {
    if (customData?.subjects && customData.subjects.length > 0) {
      const teacherSubs = customData.subjects.filter(
        (s: any) => s.teacherId === activeTeacherId || s.teacherName === activeTeacherId
      )
      if (teacherSubs.length > 0) {
        baseSubjects = teacherSubs.map((s: any) => ({
          code: s.code,
          title: s.title || s.name || s.code,
          grade: s.grade,
          labId: s.labId || 'comp',
          labName: s.lab || 'Laboratory',
        }))
        baseClasses = baseClasses.filter((c) =>
          teacherSubs.some((ts: any) => matchesGrade(ts.grade, c.name))
        )
      }
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
    const matchingSubs = baseSubjects.filter((s) => s.code.toUpperCase().startsWith(cleanSubCode))
    if (matchingSubs.length > 0) {
      const validLabIds = new Set(matchingSubs.map((s) => s.labId))
      baseLabs = baseLabs.filter((l) => validLabIds.has(l.id))
      baseClasses = baseClasses.filter((c) =>
        matchingSubs.some((ms) => matchesGrade(c.name, ms.grade))
      )
    }
  }

  // Deduplicate validSubjects by subject code so cascading options and React keys are strictly unique
  const seenSubjectCodes = new Set<string>()
  const uniqueSubjects: typeof baseSubjects = []
  for (const s of baseSubjects) {
    const code = s.code.trim().toUpperCase()
    if (!seenSubjectCodes.has(code)) {
      seenSubjectCodes.add(code)
      uniqueSubjects.push(s)
    }
  }

  // Deduplicate validClasses by unique identifier
  const seenClassKeys = new Set<string>()
  const uniqueClasses: typeof baseClasses = []
  for (const c of baseClasses) {
    const key = (c.id || c.name).trim().toLowerCase()
    if (!seenClassKeys.has(key)) {
      seenClassKeys.add(key)
      uniqueClasses.push(c)
    }
  }

  return {
    validLabs: baseLabs.map((l) => ({ id: l.id, name: l.name })),
    validClasses: uniqueClasses,
    validSubjects: uniqueSubjects,
    validTeachers: baseTeachers,
  }
}

