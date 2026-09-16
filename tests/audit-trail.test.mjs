import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import fs from 'fs';
import { computeStructuredDiff } from '../lib/audit-diff.ts';

// Extract database connection string from .env.local
const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

describe('Institutional Audit Trail Engine & Security Suite', () => {
  test('Secret and credential redaction scrubs sensitive fields', () => {
    const beforeState = {
      user_id: 'u-123',
      email: 'teacher@rrl.edu.np',
      password: 'OldPlaintextPassword123!',
      token: 'jwt-secret-token-abc',
      role: 'teacher',
    };

    const afterState = {
      user_id: 'u-123',
      email: 'teacher@rrl.edu.np',
      new_password: 'NewPlaintextPassword456!',
      token: 'jwt-secret-token-xyz',
      role: 'super_admin',
    };

    const diff = computeStructuredDiff(beforeState, afterState);
    assert.ok(diff);
    assert.ok(diff.before);
    assert.ok(diff.after);

    // Ensure role change is captured
    assert.equal(diff.before.role, 'teacher');
    assert.equal(diff.after.role, 'super_admin');

    // Ensure secrets are strictly redacted
    assert.equal(diff.before.password, '[REDACTED]');
    assert.equal(diff.after.new_password, '[REDACTED]');
    assert.equal(diff.before.token, '[REDACTED]');
    assert.equal(diff.after.token, '[REDACTED]');

    // Unchanged email should be stripped from diff
    assert.equal(diff.before.email, undefined);
    assert.equal(diff.after.email, undefined);
  });

  test('Bulk payload safeguard caps changes exceeding 50 keys', () => {
    const bigBefore = {};
    const bigAfter = {};
    for (let i = 0; i < 60; i++) {
      bigBefore[`prop_${i}`] = `old_${i}`;
      bigAfter[`prop_${i}`] = `new_${i}`;
    }

    const diff = computeStructuredDiff(bigBefore, bigAfter);
    assert.ok(diff);
    assert.equal(diff.bulk_overflow, true);
    assert.ok(diff.summary.includes('Bulk operation modified 60 properties'));
    assert.equal(diff.count, 60);
  });

  test('Database schema integrity: public.audit_logs exists with correct columns', async () => {
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    try {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `);

      const colNames = res.rows.map((r) => r.column_name);
      assert.ok(colNames.includes('id'), 'Missing id column');
      assert.ok(colNames.includes('created_at'), 'Missing created_at column');
      assert.ok(colNames.includes('actor_id'), 'Missing actor_id column');
      assert.ok(colNames.includes('actor_name'), 'Missing actor_name column');
      assert.ok(colNames.includes('actor_role'), 'Missing actor_role column');
      assert.ok(colNames.includes('action'), 'Missing action column');
      assert.ok(colNames.includes('entity_type'), 'Missing entity_type column');
      assert.ok(colNames.includes('entity_id'), 'Missing entity_id column');
      assert.ok(colNames.includes('entity_label'), 'Missing entity_label column');
      assert.ok(colNames.includes('changes'), 'Missing changes column');
      assert.ok(colNames.includes('metadata'), 'Missing metadata column');
    } finally {
      await pool.end();
    }
  });

  test('Append-only ledger insert and verification', async () => {
    const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const testEntityId = `test-lab-${Date.now()}`;
    try {
      const insertRes = await pool.query(
        `
        INSERT INTO public.audit_logs (
          actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, changes, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id;
        `,
        [
          null,
          'Test Suite Admin',
          'super_admin',
          'UPDATE',
          'lab',
          testEntityId,
          'Test Physics Lab',
          JSON.stringify({ before: { status: 'Operational' }, after: { status: 'Under Maintenance' } }),
          JSON.stringify({ test_suite: true }),
        ]
      );

      assert.ok(insertRes.rows[0]?.id);

      const fetchRes = await pool.query(
        `SELECT * FROM public.audit_logs WHERE id = $1;`,
        [insertRes.rows[0].id]
      );

      assert.equal(fetchRes.rows.length, 1);
      const row = fetchRes.rows[0];
      assert.equal(row.actor_name, 'Test Suite Admin');
      assert.equal(row.action, 'UPDATE');
      assert.equal(row.entity_type, 'lab');
      assert.equal(row.entity_id, testEntityId);
      assert.equal(row.changes.before.status, 'Operational');
      assert.equal(row.changes.after.status, 'Under Maintenance');
    } finally {
      await pool.end();
    }
  });
});
