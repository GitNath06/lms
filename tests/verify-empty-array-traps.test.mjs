import test, { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import './register-hooks.mjs'

import { getSchedules } from '../app/actions/schedules.ts'
import { getSubjectsAction } from '../app/actions/subjects.ts'
import { getClassesAction } from '../app/actions/classes.ts'
import { getLabFacilitiesAction } from '../app/actions/labs.ts'
import { getTeachers, getScopedLogFormOptions } from '../app/actions/logs.ts'
import { resolveUserScope } from '../lib/context/user-scope.ts'
import { getCascadingOptions } from '../lib/context/cascading-filters.ts'

describe('Verification of 3 Empty Array Traps & Canonical Data Integrity', () => {
  describe('Trap 2: Schedules Data Integrity & Dummy String Purge', () => {
    it('Schedules query returns valid routine sessions', async () => {
      const items = await getSchedules()
      assert.ok(Array.isArray(items), 'Must return an array of schedule items')
    })

    it('Zero dummy "*-Teacher" strings exist in any routine session or co-teacher', async () => {
      const items = await getSchedules()
      const dummyTeachers = items.filter((item) => {
        const hasDummyMain = typeof item.teacher === 'string' && item.teacher.includes('-Teacher')
        const hasDummyCo = typeof item.coTeacher === 'string' && item.coTeacher.includes('-Teacher')
        return hasDummyMain || hasDummyCo
      })

      assert.deepEqual(
        dummyTeachers.map((i) => ({ id: i.id, teacher: i.teacher, coTeacher: i.coTeacher })),
        [],
        'All dummy *-Teacher strings must be replaced with canonical faculty names'
      )
    })
  })

  describe('Trap 1: PostgreSQL Canonical Truth & Filter Bar Subject Count', () => {
    it('getSubjectsAction returns all 29 PostgreSQL subjects', async () => {
      const res = await getSubjectsAction({ activeOnly: true })
      assert.equal(res.success, true, 'getSubjectsAction must succeed')
      assert.ok(res.data, 'Must return data')
      assert.equal(res.data.length, 29, `Must return exactly 29 active subjects, got ${res.data.length}`)
    })

    it('getClassesAction returns active classes catalog', async () => {
      const res = await getClassesAction({ activeOnly: true })
      assert.equal(res.success, true, 'getClassesAction must succeed')
      assert.ok(res.data, 'Must return data')
      assert.ok(res.data.length >= 9, `Must return at least 9 active classes, got ${res.data.length}`)
      const classIds = res.data.map((c) => c.id)
      assert.ok(classIds.includes('11eng'), 'Must include 11eng')
      assert.ok(classIds.includes('12eng'), 'Must include 12eng')
    })

    it('getLabFacilitiesAction returns operational laboratory facilities', async () => {
      const res = await getLabFacilitiesAction()
      assert.equal(res.success, true, 'getLabFacilitiesAction must succeed')
      assert.ok(res.data.length >= 3, 'Must return at least 3 operational labs')
    })

    it('PracticalFilterBar cascading returns all 29 subjects when fed canonical data', async () => {
      const subjectsRes = await getSubjectsAction({ activeOnly: true })
      const classesRes = await getClassesAction({ activeOnly: true })
      const labsRes = await getLabFacilitiesAction()

      const adminProfile = {
        id: '11111111-0000-0000-0000-000000000000',
        email: 'admin@rrl.edu.np',
        full_name: 'Super Administrator',
        role: 'super_admin',
        is_active: true,
        approval_status: 'approved',
        created_at: new Date().toISOString(),
      }
      const adminScope = resolveUserScope(adminProfile)

      // Simulate PracticalFilterBar passing live infra state to getCascadingOptions
      const cascading = getCascadingOptions(
        adminScope,
        {},
        {
          subjects: subjectsRes.data.map((s) => ({
            code: s.code,
            title: s.name,
            grade: s.code.includes('-11') ? 'Class 11' : s.code.includes('-10') ? 'Class 10' : s.code.includes('-9') ? 'Class 9' : s.code.includes('-8') ? 'Class 8' : s.code.includes('-7') ? 'Class 7' : s.code.includes('-6') ? 'Class 6' : 'Class 12',
            labId: s.default_lab_id || 'comp',
          })),
          classes: classesRes.data.map((c) => ({
            id: c.id,
            name: c.name,
            stream: c.stream_id,
          })),
          labs: labsRes.data.map((l) => ({
            id: l.id,
            name: l.name,
          })),
        }
      )

      assert.equal(cascading.validSubjects.length, 29, 'Filter bar must display all 29 subjects')
      assert.ok(cascading.validClasses.length >= 9, 'Filter bar must display active classes')
      assert.ok(cascading.validLabs.length >= 3, 'Filter bar must display operational labs')
    })

    it('PracticalFilterBar cascading allows all live PostgreSQL rows for privileged scope', async () => {
      const subjectsRes = await getSubjectsAction({ activeOnly: true })
      const classesRes = await getClassesAction({ activeOnly: true })
      const labsRes = await getLabFacilitiesAction()

      const adminProfile = {
        id: '11111111-0000-0000-0000-000000000000',
        email: 'admin@rrl.edu.np',
        full_name: 'Super Administrator',
        role: 'super_admin',
        is_active: true,
        approval_status: 'approved',
        created_at: new Date().toISOString(),
      }
      const adminScope = resolveUserScope(adminProfile)

      const cascading = getCascadingOptions(
        adminScope,
        {},
        {
          subjects: subjectsRes.data,
          classes: classesRes.data,
          labs: labsRes.data,
        }
      )

      assert.equal(cascading.validSubjects.length, 29, 'Filter bar must display all 29 subjects')
      assert.ok(cascading.validClasses.length >= 9, 'Filter bar must display active classes')
      assert.ok(cascading.validLabs.length >= 3, 'Filter bar must display operational labs')
    })
  })

  describe('Trap 3: User Scope Defaults & /records/new Log Form', () => {
    it('Privileged user receives unconstrained institutional scope with zero hardcoded prototype arrays', () => {
      const adminProfile = {
        id: 'admin-uuid',
        email: 'incharge@rrl.edu.np',
        full_name: 'Lab In-Charge',
        role: 'lab_incharge',
        is_active: true,
        approval_status: 'approved',
        created_at: new Date().toISOString(),
      }
      const scope = resolveUserScope(adminProfile)

      assert.equal(scope.isPrivileged, true)
      assert.equal(scope.isTeacher, false)
      assert.equal(scope.defaultViewMode, 'institutional')
      // Zero hardcoded prototype arrays
      assert.deepEqual(scope.assignedLabIds, [], 'Privileged user must have empty assignedLabIds array')
      assert.deepEqual(scope.assignedClasses, [], 'Privileged user must have empty assignedClasses array')
      assert.deepEqual(scope.assignedSubjects, [], 'Privileged user must have empty assignedSubjects array')
    })

    it('Security: Fail-closed policy blocks accounts with undefined or non-approved status', () => {
      const undefinedStatusProfile = {
        id: 'test-uuid-1',
        email: 'test@rrl.edu.np',
        full_name: 'Test Admin',
        role: 'super_admin',
        is_active: true,
        created_at: new Date().toISOString(),
      }
      const scope = resolveUserScope(undefinedStatusProfile)
      assert.equal(scope.isPrivileged, false, 'Undefined status must NEVER be privileged')
      assert.equal(scope.approvalStatus, 'pending', 'Must fail-closed to pending')

      const rejectedProfile = {
        id: 'test-uuid-2',
        email: 'rejected@rrl.edu.np',
        full_name: 'Rejected Teacher',
        role: 'teacher',
        approval_status: 'rejected',
        is_active: true,
        created_at: new Date().toISOString(),
      }
      const rejectedScope = resolveUserScope(rejectedProfile)
      assert.equal(rejectedScope.isTeacher, false, 'Rejected teacher must not have active teacher scope')
      assert.equal(rejectedScope.approvalStatus, 'rejected')
    })

    it('Unassigned teacher receives empty scope and cannot access unauthorized classes/labs', () => {
      const unassignedProfile = {
        id: 'unassigned-uuid',
        email: 'unassigned@rrl.edu.np',
        full_name: 'Unassigned Faculty',
        role: 'teacher',
        is_active: true,
        approval_status: 'approved',
        created_at: new Date().toISOString(),
      }
      const scope = resolveUserScope(unassignedProfile)

      assert.equal(scope.isPrivileged, false)
      assert.equal(scope.isTeacher, true)
      assert.deepEqual(scope.assignedClasses, [], 'Must have empty assignedClasses')
      assert.deepEqual(scope.assignedSubjects, [], 'Must have empty assignedSubjects')
      assert.deepEqual(scope.assignedLabIds, [], 'Must have empty assignedLabIds')
    })

    it('getScopedLogFormOptions returns active options without throwing', async () => {
      const res = await getScopedLogFormOptions()
      assert.ok(res, 'getScopedLogFormOptions must return object')
      assert.ok(res.scope, 'Must contain scope')
    })
  })

  after(() => {
    setTimeout(() => process.exit(0), 100)
  })
})
