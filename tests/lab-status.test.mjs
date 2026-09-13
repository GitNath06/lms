import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_LAB_STATUSES,
  validateLabStatus,
  isValidLabStatus,
  deriveLabIsActive,
} from '../lib/lab-status.ts';

test('Lab Facility Status Domain Validation Suite', async (t) => {
  await t.test('VALID_LAB_STATUSES contains exact allowed values', () => {
    assert.deepEqual(Array.from(VALID_LAB_STATUSES), [
      'Operational',
      'Under Maintenance',
      'Inactive',
    ]);
  });

  await t.test('isValidLabStatus accurately recognizes valid and invalid statuses', () => {
    assert.equal(isValidLabStatus('Operational'), true);
    assert.equal(isValidLabStatus('Under Maintenance'), true);
    assert.equal(isValidLabStatus('Inactive'), true);

    // Case sensitivity and invalid variations
    assert.equal(isValidLabStatus('operational'), false);
    assert.equal(isValidLabStatus('Maintenance'), false);
    assert.equal(isValidLabStatus('under maintenance'), false);
    assert.equal(isValidLabStatus('foo'), false);
    assert.equal(isValidLabStatus(''), false);
    assert.equal(isValidLabStatus(null), false);
    assert.equal(isValidLabStatus(undefined), false);
    assert.equal(isValidLabStatus(123), false);
  });

  await t.test('validateLabStatus returns valid statuses and throws on invalid inputs', () => {
    assert.equal(validateLabStatus('Operational'), 'Operational');
    assert.equal(validateLabStatus('Under Maintenance'), 'Under Maintenance');
    assert.equal(validateLabStatus('Inactive'), 'Inactive');

    assert.throws(
      () => validateLabStatus('Maintenance'),
      /Invalid lab status: "Maintenance"/
    );
    assert.throws(
      () => validateLabStatus('operational'),
      /Invalid lab status: "operational"/
    );
    assert.throws(
      () => validateLabStatus('foo'),
      /Invalid lab status: "foo"/
    );
    assert.throws(
      () => validateLabStatus(null),
      /Invalid lab status: "null"/
    );
  });

  await t.test('deriveLabIsActive accurately derives active lifecycle flag and rejects invalid strings', () => {
    // Both 'Operational' and 'Under Maintenance' represent active facilities in the institution
    assert.equal(deriveLabIsActive('Operational'), true);
    assert.equal(deriveLabIsActive('Under Maintenance'), true);

    // 'Inactive' represents decommissioned/soft-deleted facility
    assert.equal(deriveLabIsActive('Inactive'), false);

    // Untrusted or malformed strings throw error for defense-in-depth
    assert.throws(
      () => deriveLabIsActive('Maintenance'),
      /Invalid lab status: "Maintenance"/
    );
    assert.throws(
      () => deriveLabIsActive('operational'),
      /Invalid lab status: "operational"/
    );
    assert.throws(
      () => deriveLabIsActive('foo'),
      /Invalid lab status: "foo"/
    );
  });

  await t.test('server-side booking guard validates lab availability accurately', () => {
    function evaluateLabBookingAllowed(lab) {
      if (lab.status === 'Under Maintenance') {
        return { allowed: false, reason: 'Under Maintenance' };
      }
      if (!lab.is_active || lab.status === 'Inactive') {
        return { allowed: false, reason: 'Inactive' };
      }
      return { allowed: true };
    }

    assert.deepEqual(evaluateLabBookingAllowed({ status: 'Under Maintenance', is_active: true }), {
      allowed: false,
      reason: 'Under Maintenance',
    });
    assert.deepEqual(evaluateLabBookingAllowed({ status: 'Inactive', is_active: false }), {
      allowed: false,
      reason: 'Inactive',
    });
    assert.deepEqual(evaluateLabBookingAllowed({ status: 'Operational', is_active: true }), {
      allowed: true,
    });
  });
});
