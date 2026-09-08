// Verification test suite for Context-First Architecture
import { INSTITUTIONAL_TEACHERS, getTeacherAssignments, getSubjectsForClass, getLabForSubject } from '../lib/context/institutional-relationships'
import { getCascadingOptions } from '../lib/context/cascading-filters'
import { resolveUserScope } from '../lib/context/user-scope'

console.log('--- TEST SUITE: CONTEXT-FIRST ARCHITECTURE ---')

let passed = 0
let failed = 0

function assert(condition: boolean | undefined | null, desc: string) {
  if (Boolean(condition)) {
    console.log(`✅ PASS: ${desc}`)
    passed++
  } else {
    console.error(`❌ FAIL: ${desc}`)
    failed++
  }
}

// 1. Teacher Assignment Resolution Tests
const anish = getTeacherAssignments('f3ad9570-a56c-4727-82b7-b3edd942896c')
assert(anish !== null, 'Er. Anish Karki profile resolved by UUID')
assert(anish?.name === 'Er. Anish Karki', 'Teacher name matches canonical profile')
assert(Boolean(anish?.assignedClasses.includes('12C') && anish?.assignedClasses.includes('11C')), 'Assigned classes 12C and 11C present')
assert(Boolean(anish?.assignedLabIds.includes('comp')), 'Primary lab is Computer Lab')

const prakash = getTeacherAssignments('a0110dea-ef2a-4fc1-b60a-6415fcc36bd1')
assert(prakash?.name === 'Dr. Prakash Adhikari', 'Dr. Prakash Adhikari resolved by UUID')
assert(Boolean(prakash?.assignedLabIds.includes('phys')), 'Primary lab is Physics Lab')

// 2. Class -> Subject Mapping Tests
const subjects12C = getSubjectsForClass('12C')
assert(subjects12C.length > 0, 'Class 12C returns valid subjects')
assert(subjects12C.some(s => s.code.includes('COMP') || s.code.includes('DBMS') || s.code.includes('WEB')), '12C contains Computer subjects')

// 3. User Scope Resolution Tests
const adminScope = resolveUserScope({
  id: '1cb09b62-8dd2-445f-b5ae-a186df967cf5',
  email: 'admin@school.edu.np',
  full_name: 'System Administrator',
  role: 'super_admin',
  department: 'Administration',
  is_active: true,
  created_at: new Date().toISOString(),
})
assert(adminScope.isPrivileged === true, 'Admin has isPrivileged = true')
assert(adminScope.defaultViewMode === 'institutional', 'Admin default view mode is institutional')

const teacherScope = resolveUserScope({
  id: 'f3ad9570-a56c-4727-82b7-b3edd942896c',
  email: 'anish.karki@school.edu.np',
  full_name: 'Anish Karki',
  role: 'teacher',
  department: 'Electronics & Computer',
  is_active: true,
  created_at: new Date().toISOString(),
})
assert(teacherScope.isTeacher === true, 'Teacher has isTeacher = true')
assert(teacherScope.isPrivileged === false, 'Teacher has isPrivileged = false')
assert(teacherScope.defaultViewMode === 'my_data', 'Teacher default view mode is my_data')
assert(teacherScope.assignedClasses.includes('12C'), 'Teacher assigned classes resolved correctly')
assert(teacherScope.teacherProfile?.name === 'Er. Anish Karki', 'Teacher canonical profile linked to user')

// 4. Cascading Filter Engine Tests
// Unrestricted Admin Options
const adminCascade = getCascadingOptions(adminScope, {})
assert(adminCascade.validLabs.length >= 4, 'Admin gets all labs')
assert(adminCascade.validTeachers.length >= 4, 'Admin gets all teachers')

// Cascading: Selected Computer Lab -> Available Classes should only be classes with Comp Lab
const compCascade = getCascadingOptions(adminScope, { labId: 'comp' })
assert(compCascade.validClasses.length > 0, 'Classes returned for comp lab')
assert(compCascade.validClasses.some(c => c.name.includes('12') || c.name.includes('11')), 'Comp lab includes 12C/11C')

// Cascading: Teacher Scope -> Only Assigned Classes and Labs
const teacherCascade = getCascadingOptions(teacherScope, {})
assert(teacherCascade.validClasses.every(c => teacherScope.assignedClasses.includes(c.name)), 'Teacher cascade restricts classes to assigned classes')
assert(teacherCascade.validTeachers.length === 1, 'Teacher filter locks teacher to self')

// Cascading: Selected Class 12C -> Only Subjects for 12C
const class12CCascade = getCascadingOptions(teacherScope, { classBatch: '12C' })
assert(class12CCascade.validSubjects.length > 0, 'Subjects returned for 12C')
assert(class12CCascade.validSubjects.every(s => s.grade === '12C' || s.grade.includes('12')), 'All returned subjects belong to 12C')

console.log(`\nResults: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
