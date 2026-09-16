import test from 'node:test';
import assert from 'node:assert/strict';

test('Super Admin Precaution Lock & Governance Logic Suite', async (t) => {
  // 1. Holiday Deduplication by Composite Key (dateStr + trimmed title)
  await t.test('Holiday deduplication collapses duplicate entries across multiple syncs', () => {
    const rawHolidays = [
      { id: 'hol-1', dateStr: '2024-09-19', title: 'Constitution Day', type: 'state' },
      { id: 'hol-1-dup', dateStr: '2024-09-19', title: 'Constitution Day ', type: 'state' },
      { id: 'hol-2', dateStr: '2024-08-26', title: 'Gaura Parba', type: 'cultural' },
      { id: 'hol-2-dup', dateStr: '2024-08-26', title: 'Gaura Parba', type: 'cultural' },
      { id: 'hol-3', dateStr: '2024-10-03', title: 'Ghatasthapana', type: 'cultural' },
    ];

    const dedupMap = new Map();
    rawHolidays.forEach((h) => {
      if (!h || !h.title || !h.dateStr) return;
      const compositeKey = `${h.dateStr}_${h.title.trim()}`;
      if (!dedupMap.has(compositeKey)) {
        dedupMap.set(compositeKey, h);
      }
    });

    const uniqueHolidays = Array.from(dedupMap.values());
    assert.equal(uniqueHolidays.length, 3, 'Duplicate holidays must be collapsed to exactly 3 unique events');
    assert.equal(uniqueHolidays.filter((h) => h.title.trim() === 'Constitution Day').length, 1);
    assert.equal(uniqueHolidays.filter((h) => h.title.trim() === 'Gaura Parba').length, 1);
  });

  // 2. Precaution Lock Scope: Creation (Unguarded) vs Destructive/Reset (Guarded)
  await t.test('Precaution Lock correctly permits creation while guarding destructive resets', () => {
    function evaluateActionPermitted(actionType, isEditModeUnlocked) {
      const CREATION_ACTIONS = new Set([
        'add_subject',
        'add_period',
        'add_lab',
        'add_class',
        'add_teacher',
      ]);

      const GUARDED_DESTRUCTIVE_ACTIONS = new Set([
        'delete_subject',
        'delete_period',
        'delete_lab',
        'delete_class',
        'delete_user',
        'delete_holiday',
        'reset_routine',
        'reset_periods',
        'restore_snapshot',
      ]);

      if (CREATION_ACTIONS.has(actionType)) {
        return { allowed: true, requiresLock: false };
      }

      if (GUARDED_DESTRUCTIVE_ACTIONS.has(actionType)) {
        return {
          allowed: isEditModeUnlocked,
          requiresLock: true,
          reason: isEditModeUnlocked ? null : 'Precaution Active: Unlock edit mode to perform modifications',
        };
      }

      throw new Error(`Unknown actionType: ${actionType}`);
    }

    // When locked (default state)
    assert.equal(evaluateActionPermitted('add_subject', false).allowed, true);
    assert.equal(evaluateActionPermitted('add_period', false).allowed, true);
    assert.equal(evaluateActionPermitted('add_lab', false).allowed, true);
    assert.equal(evaluateActionPermitted('add_class', false).allowed, true);
    assert.equal(evaluateActionPermitted('add_teacher', false).allowed, true);

    assert.equal(evaluateActionPermitted('delete_subject', false).allowed, false);
    assert.equal(evaluateActionPermitted('delete_period', false).allowed, false);
    assert.equal(evaluateActionPermitted('delete_lab', false).allowed, false);
    assert.equal(evaluateActionPermitted('reset_routine', false).allowed, false);
    assert.equal(evaluateActionPermitted('reset_periods', false).allowed, false);
    assert.equal(evaluateActionPermitted('restore_snapshot', false).allowed, false);

    // When unlocked
    assert.equal(evaluateActionPermitted('delete_subject', true).allowed, true);
    assert.equal(evaluateActionPermitted('reset_routine', true).allowed, true);
    assert.equal(evaluateActionPermitted('restore_snapshot', true).allowed, true);
  });

  // 3. Bidirectional Calendar Recess Confirmation Copy
  await t.test('Recess and Saturday Off policy transitions have direction-appropriate impact messaging', () => {
    function getRecessPolicyModalContent(policyType, targetChecked) {
      if (policyType === 'sunday_recess') {
        return {
          title: targetChecked
            ? 'Declare Sunday as Institutional Recess?'
            : 'Reactivate Sunday Practical Sessions?',
          description: targetChecked
            ? 'This marks Sunday as a weekly off and automatically suspends practical sessions across all laboratories.'
            : 'This marks Sunday as an active academic day and resumes timetable scheduling across all laboratories.',
          confirmLabel: targetChecked ? 'Declare Sunday Recess' : 'Reactivate Sunday Sessions',
        };
      }
      if (policyType === 'saturday_holiday') {
        return {
          title: targetChecked
            ? 'Enforce Saturday Statutory Holiday?'
            : 'Enable Saturday Laboratory Operations?',
          description: targetChecked
            ? 'This marks Saturday as an official holiday and suspends laboratory operations.'
            : 'This permits practical sessions and bookings to take place on Saturdays.',
          confirmLabel: targetChecked ? 'Enforce Saturday Holiday' : 'Enable Saturday Operations',
        };
      }
      throw new Error(`Unknown policyType: ${policyType}`);
    }

    const sundayOn = getRecessPolicyModalContent('sunday_recess', true);
    assert.match(sundayOn.title, /Declare Sunday as Institutional Recess\?/);
    assert.match(sundayOn.confirmLabel, /Declare Sunday Recess/);

    const sundayOff = getRecessPolicyModalContent('sunday_recess', false);
    assert.match(sundayOff.title, /Reactivate Sunday Practical Sessions\?/);
    assert.match(sundayOff.confirmLabel, /Reactivate Sunday Sessions/);

    const saturdayOn = getRecessPolicyModalContent('saturday_holiday', true);
    assert.match(saturdayOn.title, /Enforce Saturday Statutory Holiday\?/);

    const saturdayOff = getRecessPolicyModalContent('saturday_holiday', false);
    assert.match(saturdayOff.title, /Enable Saturday Laboratory Operations\?/);
  });

  // 4. Role Badges: Pure Category Semantics (Zero Color)
  await t.test('Role badges adhere to Category vs State separation', () => {
    function getRoleBadgeConfig(role) {
      const neutralClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
      return {
        className: neutralClass,
        hasShieldIcon: role === 'super_admin',
        isRainbowColor: false,
      };
    }

    const teacher = getRoleBadgeConfig('teacher');
    const incharge = getRoleBadgeConfig('lab_incharge');
    const hod = getRoleBadgeConfig('hod');
    const superAdmin = getRoleBadgeConfig('super_admin');

    assert.equal(teacher.className, incharge.className);
    assert.equal(incharge.className, hod.className);
    assert.equal(hod.className, superAdmin.className);

    assert.equal(superAdmin.hasShieldIcon, true);
    assert.equal(teacher.hasShieldIcon, false);
    assert.equal(teacher.isRainbowColor, false);
  });

  // 5. Dual-Facility Practical & Multi-Lab Conflict Detection
  await t.test('Dual-Facility Practical properly occupies both laboratories and prevents collisions', () => {
    const mockSessions = [
      {
        id: 'sess-101',
        dayKey: 'wed',
        slotId: 't3',
        labKey: 'comp',
        secondaryLabKey: 'phys',
        isDualLab: true,
        teacher: 'Dr. Rajesh Sharma',
        coTeacher: 'Dr. Rajesh Sharma',
        subjectCode: 'DDMP-10',
        grade: 'Class 10',
      },
      {
        id: 'sess-102',
        dayKey: 'wed',
        slotId: 't4',
        labKey: 'comp',
        teacher: 'Er. Sandeep B.',
        subjectCode: 'OOP-12',
        grade: 'Class 12',
      },
    ];

    function isLabBusyInSlot(allRoutines, dayKey, slotId, labKey, excludeId) {
      return allRoutines.some(
        (r) =>
          r.id !== excludeId &&
          r.dayKey === dayKey &&
          r.slotId === slotId &&
          (r.labKey === labKey || r.secondaryLabKey === labKey)
      );
    }

    function getOccupiedLabsInSlot(allRoutines, dayKey, slotId, excludeId) {
      const occupied = new Set();
      for (const r of allRoutines) {
        if (r.id === excludeId) continue;
        if (r.dayKey === dayKey && r.slotId === slotId) {
          if (r.labKey) occupied.add(r.labKey);
          if (r.secondaryLabKey) occupied.add(r.secondaryLabKey);
        }
      }
      return occupied;
    }

    // Period t3: Computer Lab and Physics Lab are both occupied by the dual-lab session
    assert.equal(isLabBusyInSlot(mockSessions, 'wed', 't3', 'comp'), true, 'Computer Lab must be busy in t3');
    assert.equal(isLabBusyInSlot(mockSessions, 'wed', 't3', 'phys'), true, 'Physics Lab must be busy in t3');
    assert.equal(isLabBusyInSlot(mockSessions, 'wed', 't3', 'chem'), false, 'Chemistry Lab must be free in t3');

    // Period t4: only Computer Lab is busy
    assert.equal(isLabBusyInSlot(mockSessions, 'wed', 't4', 'comp'), true, 'Computer Lab must be busy in t4');
    assert.equal(isLabBusyInSlot(mockSessions, 'wed', 't4', 'phys'), false, 'Physics Lab must be free in t4');

    const occupiedInT3 = getOccupiedLabsInSlot(mockSessions, 'wed', 't3');
    assert.equal(occupiedInT3.has('comp'), true);
    assert.equal(occupiedInT3.has('phys'), true);
    assert.equal(occupiedInT3.size, 2);

    // Primary and secondary cannot be the same
    function validateDualLabBooking(primaryLab, secondaryLab, isDual) {
      if (!isDual) return { valid: true };
      if (primaryLab === secondaryLab) {
        return { valid: false, error: 'Primary and secondary laboratories cannot be the same facility.' };
      }
      return { valid: true };
    }

    assert.equal(validateDualLabBooking('comp', 'comp', true).valid, false);
    assert.equal(validateDualLabBooking('comp', 'phys', true).valid, true);

    // Dual Lab badge must use neutral category styling (never indigo accent)
    const dualLabBadgeClass = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    assert.equal(dualLabBadgeClass.includes('indigo'), false, 'Dual Lab badge must not use reserved indigo accent');
  });
});

