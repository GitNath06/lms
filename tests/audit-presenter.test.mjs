import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isInternalSystemKey,
  getHumanFieldLabel,
  formatAuditValue,
  generateOperationalGuidance,
  resolveLabName,
} from '../lib/audit-presenter.ts'

test('Institutional Audit Presenter & Intelligence Engine Suite', async (t) => {
  await t.test('1. Internal System Keys Filter properly separates DB plumbing from business data', () => {
    assert.equal(isInternalSystemKey('span'), true)
    assert.equal(isInternalSystemKey('is_merged'), true)
    assert.equal(isInternalSystemKey('created_at'), true)
    assert.equal(isInternalSystemKey('updated_at'), true)
    assert.equal(isInternalSystemKey('id'), true)
    assert.equal(isInternalSystemKey('schedule_id'), true)

    // Meaningful business keys must NOT be classified as internal
    assert.equal(isInternalSystemKey('subject_name'), false)
    assert.equal(isInternalSystemKey('batch_name'), false)
    assert.equal(isInternalSystemKey('capacity'), false)
    assert.equal(isInternalSystemKey('status'), false)
    assert.equal(isInternalSystemKey('lab_id'), false)
    assert.equal(isInternalSystemKey('precaution_active'), false)
  })

  await t.test('2. Human Field Labels translate column names into professional institutional terminology', () => {
    assert.equal(getHumanFieldLabel('subject_name'), 'Subject / Practical')
    assert.equal(getHumanFieldLabel('batch_name'), 'Target Class Batch')
    assert.equal(getHumanFieldLabel('lab_id'), 'Laboratory Facility')
    assert.equal(getHumanFieldLabel('capacity'), 'Workstation Capacity')
    assert.equal(getHumanFieldLabel('precaution_active'), 'Precaution Safety Lock')
    assert.equal(getHumanFieldLabel('sla_hours'), 'Resolution SLA Target')
    assert.equal(getHumanFieldLabel('severity'), 'Incident Severity Tier')
  })

  await t.test('3. Smart Value Formatter handles initial nulls, lab names, and metadata unfolding', () => {
    // 3a. Initial null state formatting
    const nullFmt = formatAuditValue('subject_name', null)
    assert.equal(nullFmt.isNull, true)
    assert.equal(nullFmt.isInitial, true)
    assert.equal(nullFmt.display, 'Unassigned (Initial)')

    // 3b. Lab ID mapping
    const labFmt = formatAuditValue('lab_id', 'chem')
    assert.equal(labFmt.display, 'Chemistry Laboratory')
    assert.equal(labFmt.badgeStyle, 'indigo')

    // 3c. Status formatting with semantic badges
    const maintFmt = formatAuditValue('status', 'Under Maintenance')
    assert.equal(maintFmt.display, 'Under Maintenance')
    assert.equal(maintFmt.badgeStyle, 'amber')

    const opFmt = formatAuditValue('status', 'Operational')
    assert.equal(opFmt.display, 'Operational')
    assert.equal(opFmt.badgeStyle, 'emerald')

    // 3d. Metadata object unfolding
    const metaFmt = formatAuditValue('metadata', {
      labName: 'Chemistry Laboratory',
      teacher: 'CHEM12-Teacher',
      studentsCount: 38,
      is_multi_lab: false,
    })
    assert.ok(metaFmt.subDetails)
    assert.equal(metaFmt.subDetails.length, 4)
    assert.equal(metaFmt.subDetails.find((s) => s.label === 'Instructor')?.value, 'CHEM12-Teacher')
    assert.equal(metaFmt.subDetails.find((s) => s.label === 'Students')?.value, '38 Students')
  })

  await t.test('4. Operational Guidance Engine produces actionable advice for Lab Maintenance', () => {
    const labLog = {
      id: 'test-log-1',
      created_at: new Date().toISOString(),
      actor_id: 'admin-1',
      actor_name: 'Principal Admin',
      actor_role: 'super_admin',
      action: 'UPDATE',
      entity_type: 'lab',
      entity_id: 'chem',
      entity_label: 'Chemistry Laboratory',
      changes: {
        before: { status: 'Operational' },
        after: { status: 'Under Maintenance' },
      },
      metadata: {},
    }

    const guidance = generateOperationalGuidance(labLog)
    assert.equal(guidance.severityLevel, 'warning')
    assert.equal(guidance.headline, 'Facility Under Maintenance')
    assert.match(guidance.impactMessage, /automatically suspended/i)
    assert.match(guidance.actionAdvice, /Restore status to "Operational"/i)
  })

  await t.test('5. Operational Guidance Engine produces actionable advice for Timetable Scheduling', () => {
    const schedLog = {
      id: 'test-log-2',
      created_at: new Date().toISOString(),
      actor_id: 'admin-1',
      actor_name: 'Principal Admin',
      actor_role: 'super_admin',
      action: 'UPDATE',
      entity_type: 'schedule',
      entity_id: 'tue-2',
      entity_label: 'CHEM-12 - Chemistry Lab • TUE',
      changes: {
        after: {
          subject_name: 'CHEM-12 - Chemistry Lab',
          batch_name: '12C',
          start_time: '11:00',
          end_time: '11:45',
          lab_id: 'chem',
        },
      },
      metadata: {},
    }

    const guidance = generateOperationalGuidance(schedLog)
    assert.equal(guidance.severityLevel, 'info')
    assert.equal(guidance.headline, 'Practical Session Allocated / Modified')
    assert.match(guidance.narrative, /CHEM-12 - Chemistry Lab/i)
    assert.match(guidance.actionAdvice, /prepares apparatus/i)
  })

  await t.test('6. Operational Guidance Engine produces actionable advice for Precaution Active Unlock', () => {
    const policyLog = {
      id: 'test-log-3',
      created_at: new Date().toISOString(),
      actor_id: 'admin-1',
      actor_name: 'Principal Admin',
      actor_role: 'super_admin',
      action: 'UPDATE',
      entity_type: 'policy',
      entity_id: 'precaution_safety_mode',
      entity_label: 'Precaution Active Safety Lock',
      changes: {
        before: { precaution_active: true, edit_mode_unlocked: false },
        after: { precaution_active: false, edit_mode_unlocked: true },
      },
      metadata: {},
    }

    const guidance = generateOperationalGuidance(policyLog)
    assert.equal(guidance.severityLevel, 'caution')
    assert.equal(guidance.headline, 'Administrative Precaution Lock Disabled')
    assert.match(guidance.impactMessage, /Destructive administrative mutations/i)
    assert.match(guidance.actionAdvice, /Immediately re-lock "Precaution Active"/i)
  })
})
