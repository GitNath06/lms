import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveUserScope } from '../lib/context/user-scope.ts'
import { validatePasswordPolicy } from '../lib/auth-policy.ts'
import { generateAndSendSignupOtp } from '../app/actions/otp.ts'
import { createPracticalLog, updatePracticalLog, deletePracticalLog } from '../app/actions/logs.ts'
import { submitLiveSession, createAdHocSession } from '../app/actions/live-session.ts'
import { reportWorkstationIssue } from '../app/actions/workstations.ts'
import { reportIncident, escalateIncidentToHOD, updateIncidentStatus } from '../app/actions/incidents.ts'
import { createSchedule, deleteSchedule } from '../app/actions/schedules.ts'

test('Pending User Security & Operational Lockdown Suite', async (t) => {
  // Test 1: User Scope lockdown
  await t.test('1. resolveUserScope strictly locks down pending users regardless of declared role', () => {
    const pendingTeacherScope = resolveUserScope({
      id: 'usr-pending-1',
      email: 'newbie@rrl.edu.np',
      full_name: 'Pending Teacher',
      role: 'teacher',
      approval_status: 'pending',
      is_active: true,
      permissions: {},
      created_at: new Date().toISOString(),
    })

    assert.strictEqual(pendingTeacherScope.approvalStatus, 'pending')
    assert.strictEqual(pendingTeacherScope.isPending, true)
    assert.strictEqual(pendingTeacherScope.isPrivileged, false)
    assert.deepStrictEqual(pendingTeacherScope.assignedClasses, [])
    assert.deepStrictEqual(pendingTeacherScope.assignedSubjects, [])
    assert.deepStrictEqual(pendingTeacherScope.assignedLabIds, [])
    assert.strictEqual(pendingTeacherScope.defaultViewMode, 'my_data')

    // Even if user claimed to be lab_incharge or super_admin on registration
    const pendingAdminPretenceScope = resolveUserScope({
      id: 'usr-pending-fake-admin',
      email: 'hacker@rrl.edu.np',
      full_name: 'Fake Admin',
      role: 'lab_incharge',
      approval_status: 'pending',
      is_active: true,
      permissions: {},
      created_at: new Date().toISOString(),
    })

    assert.strictEqual(pendingAdminPretenceScope.approvalStatus, 'pending')
    assert.strictEqual(pendingAdminPretenceScope.isPending, true)
    assert.strictEqual(pendingAdminPretenceScope.isPrivileged, false, 'Pending lab_incharge MUST NOT be privileged')
    assert.deepStrictEqual(pendingAdminPretenceScope.assignedClasses, [])
    assert.deepStrictEqual(pendingAdminPretenceScope.assignedLabIds, [])
  })

  // Test 2: Password requirement checked BEFORE OTP generation
  await t.test('2. generateAndSendSignupOtp strictly requires valid password policy before generating OTP', async () => {
    // Missing password
    const resNoPass = await generateAndSendSignupOtp('newbie@rrl.edu.np', 'Newbie Teacher', '')
    assert.ok(resNoPass.error, 'Must error when password is empty')
    assert.ok(resNoPass.error.includes('Password is required'))

    // Weak password failing criteria
    const resWeakPass = await generateAndSendSignupOtp('newbie@rrl.edu.np', 'Newbie Teacher', 'weak')
    assert.ok(resWeakPass.error, 'Must error when password fails criteria')
    assert.ok(resWeakPass.error.includes('Password requirement not met'))
  })

  // Test 3: Operational mutation lockdown when authenticated user is pending
  await t.test('3. Server mutations reject execution when TEST_USER_OVERRIDE represents a pending account', async () => {
    // Simulate pending authenticated user session
    process.env.TEST_USER_OVERRIDE = JSON.stringify({
      id: 'usr-pending-test-mock',
      email: 'pending.mock@rrl.edu.np',
      full_name: 'Pending Mock Faculty',
      role: 'teacher',
      approval_status: 'pending',
      is_active: true,
      permissions: {},
      created_at: new Date().toISOString(),
    })

    try {
      // 3.1 Practical Logs
      const logRes = await createPracticalLog({
        lab_id: 'comp',
        subject_name: 'COMP-11',
        practical_title: 'Unauthorized Log Attempt',
        date: '2026-10-18',
        period_label: 'Period 1 & 2',
        total_students: 40,
        present_students: 40,
        absent_students: 0,
      })
      assert.strictEqual(logRes.success, false)
      assert.ok(logRes.error?.includes('pending verification'))

      const updateRes = await updatePracticalLog('log-seed-1', { remarks: 'Bypassed remarks' })
      assert.strictEqual(updateRes.success, false)
      assert.ok(updateRes.error?.includes('pending verification'))

      const deleteRes = await deletePracticalLog('log-seed-1')
      assert.strictEqual(deleteRes.success, false)
      assert.ok(deleteRes.error?.includes('pending verification'))

      // 3.2 Live Session
      const liveRes = await submitLiveSession({
        scheduleId: 'mon-1',
        practicalTitle: 'Test Live',
        date: '2026-10-18',
        attendance: [],
      })
      assert.strictEqual(liveRes.success, false)
      assert.ok(liveRes.error?.includes('pending verification'))

      const adHocRes = await createAdHocSession({
        classSubjectId: 'cs-mock-1',
        labId: 'comp',
        startTime: '10:10',
        endTime: '11:45',
        date: '2026-10-18',
      })
      assert.strictEqual(adHocRes.success, false)
      assert.ok(adHocRes.error?.includes('pending verification'))

      // 3.3 Incidents
      const incRes = await reportIncident({
        lab_id: 'comp',
        date: '2026-10-18',
        session_label: 'Period 1',
        subject_name: 'COMP-11',
        subject_teacher_name: 'Pending Mock Faculty',
        batch_name: '11C',
        title: 'Broken Keyboard',
        equipment_name: 'Keyboard',
        quantity: 1,
        severity: 'minor',
        incident_type: 'breakage',
        reported_by: 'Pending Mock Faculty',
      })
      assert.strictEqual(incRes.success, false)
      assert.ok(incRes.error?.includes('pending institutional verification'))

      const escRes = await escalateIncidentToHOD('inc-seed-1', 'Need immediate review')
      assert.strictEqual(escRes.success, false)
      assert.ok(escRes.error?.includes('pending institutional verification'))

      const updateIncRes = await updateIncidentStatus('inc-seed-1', {
        status: 'resolved',
        resolved_by: 'Pending Mock',
      })
      assert.strictEqual(updateIncRes.success, false)
      assert.ok(updateIncRes.error?.includes('pending institutional verification'))

      // 3.4 Workstation Issue
      const wsRes = await reportWorkstationIssue({
        workstation_id: 'ws-mock-uuid',
        title: 'Monitor flickering',
        severity: 'medium',
      })
      assert.strictEqual(wsRes.success, false)
      assert.ok(wsRes.error?.includes('pending verification'))

      // 3.5 Timetable Schedule
      const schedRes = await createSchedule({
        lab_id: 'comp',
        subject_name: 'COMP-11',
        batch_name: '11C',
        day_key: 'sun',
        slot_id: 't1',
        start_time: '10:10',
        end_time: '11:45',
      })
      assert.ok(schedRes.error?.includes('pending institutional verification') || schedRes.error?.includes('pending verification'))

      const delSchedRes = await deleteSchedule('sched-mock-1')
      assert.strictEqual(delSchedRes.success, false)
      assert.ok(delSchedRes.error?.includes('pending verification'))
    } finally {
      delete process.env.TEST_USER_OVERRIDE
    }
  })
})
