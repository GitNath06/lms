import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { resolveDatabaseUrl } from '../lib/db.ts';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

describe('Teacher Profile & Preferences Persistence Suite', () => {
  let pool;

  before(async () => {
    const rawUrl = process.env.DATABASE_URL;
    const connectionString = resolveDatabaseUrl(rawUrl);
    const isSupabase = connectionString && (connectionString.includes('supabase.co') || connectionString.includes('supabase.com'));

    pool = new pg.Pool({
      connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    });
  });

  after(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('1. Verifies honorific, phone, bio, and teaching_preferences columns exist on public.profiles', async () => {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name IN ('honorific', 'phone', 'bio', 'teaching_preferences')
    `);
    const colNames = res.rows.map((r) => r.column_name);
    assert.ok(colNames.includes('honorific'), 'honorific column must exist');
    assert.ok(colNames.includes('phone'), 'phone column must exist');
    assert.ok(colNames.includes('bio'), 'bio column must exist');
    assert.ok(colNames.includes('teaching_preferences'), 'teaching_preferences column must exist');
  });

  it('2. Verifies updating teacher preferences and bio in database', async () => {
    const profileRes = await pool.query(`SELECT id FROM public.profiles WHERE role = 'teacher' LIMIT 1`);
    if (profileRes.rows.length === 0) {
      assert.ok(true, 'No teacher profile found to test update, skipping');
      return;
    }

    const testId = profileRes.rows[0].id;
    const testPrefs = {
      specializations: ['Physics Practical', 'Computer Science'],
      notifyScheduleConflicts: true,
      notifyUpcomingLabs: false,
    };

    await pool.query(`
      UPDATE public.profiles
      SET 
        honorific = 'Er.',
        phone = '+977 9841234567',
        bio = 'Computer Systems & Lab In-Charge Test Bio',
        teaching_preferences = $1
      WHERE id = $2
    `, [JSON.stringify(testPrefs), testId]);

    const verifyRes = await pool.query(`
      SELECT honorific, phone, bio, teaching_preferences 
      FROM public.profiles 
      WHERE id = $1
    `, [testId]);

    const row = verifyRes.rows[0];
    assert.strictEqual(row.honorific, 'Er.');
    assert.strictEqual(row.phone, '+977 9841234567');
    assert.strictEqual(row.bio, 'Computer Systems & Lab In-Charge Test Bio');
    assert.deepStrictEqual(row.teaching_preferences.specializations, ['Physics Practical', 'Computer Science']);
    assert.strictEqual(row.teaching_preferences.notifyScheduleConflicts, true);
    assert.strictEqual(row.teaching_preferences.notifyUpcomingLabs, false);
  });
});
