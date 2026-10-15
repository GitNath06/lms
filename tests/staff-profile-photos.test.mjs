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

describe('Staff & Faculty Profile Pictures Test Suite', () => {
  let pool;
  let testProfileId = null;
  let originalProfileState = null;

  before(async () => {
    const rawUrl = process.env.DATABASE_URL;
    const connectionString = resolveDatabaseUrl(rawUrl);
    const isSupabase = connectionString && (connectionString.includes('supabase.co') || connectionString.includes('supabase.com'));

    pool = new pg.Pool({
      connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
    });

    // Find an existing faculty/staff profile
    const existing = await pool.query(
      `SELECT id, full_name, role, photo_url, avatar_url FROM public.profiles LIMIT 1;`
    );

    if (existing.rows.length > 0) {
      testProfileId = existing.rows[0].id;
      originalProfileState = existing.rows[0];
    }
  });

  after(async () => {
    if (testProfileId && originalProfileState) {
      await pool.query(
        `UPDATE public.profiles SET photo_url = $1, avatar_url = $2, role = $3 WHERE id = $4::uuid`,
        [originalProfileState.photo_url, originalProfileState.avatar_url, originalProfileState.role, testProfileId]
      );
    }
    await pool.end();
  });

  it('1. Verifies public.profiles schema includes photo_url and avatar_url columns', async () => {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name IN ('photo_url', 'avatar_url')
      ORDER BY column_name;
    `);

    assert.equal(res.rows.length, 2, 'Expected both photo_url and avatar_url columns to exist');
    const colNames = res.rows.map(r => r.column_name);
    assert.ok(colNames.includes('photo_url'), 'Expected photo_url in profiles');
    assert.ok(colNames.includes('avatar_url'), 'Expected avatar_url in profiles');
  });

  it('2. Verifies updating staff profile photo_url and avatar_url', async () => {
    assert.ok(testProfileId, 'Expected at least one profile in database');

    const mockPhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...mockStaffAvatarData';

    await pool.query(
      `
      UPDATE public.profiles
      SET photo_url = $1, avatar_url = $1
      WHERE id = $2::uuid;
      `,
      [mockPhotoDataUrl, testProfileId]
    );

    const queryRes = await pool.query(
      `SELECT id, full_name, photo_url, avatar_url FROM public.profiles WHERE id = $1::uuid`,
      [testProfileId]
    );

    assert.equal(queryRes.rows.length, 1);
    const profile = queryRes.rows[0];
    assert.equal(profile.photo_url, mockPhotoDataUrl);
    assert.equal(profile.avatar_url, mockPhotoDataUrl);
  });

  it('3. Verifies photo updates across institutional roles (Teacher, Lab Incharge, HOD, Super Admin)', async () => {
    assert.ok(testProfileId, 'Expected at least one profile in database');
    const roles = ['teacher', 'lab_incharge', 'hod', 'super_admin'];

    for (const role of roles) {
      const updatedPhotoUrl = `data:image/jpeg;base64,mockUpdatedPhotoFor_${role}`;

      await pool.query(
        `
        UPDATE public.profiles
        SET role = $1, photo_url = $2, avatar_url = $2
        WHERE id = $3::uuid;
        `,
        [role, updatedPhotoUrl, testProfileId]
      );

      const checkRes = await pool.query(
        `SELECT role, photo_url, avatar_url FROM public.profiles WHERE id = $1::uuid`,
        [testProfileId]
      );

      assert.equal(checkRes.rows[0].role, role);
      assert.equal(checkRes.rows[0].photo_url, updatedPhotoUrl);
      assert.equal(checkRes.rows[0].avatar_url, updatedPhotoUrl);
    }
  });

  it('4. Verifies photo removal (clearing back to null)', async () => {
    assert.ok(testProfileId, 'Expected at least one profile in database');

    await pool.query(
      `
      UPDATE public.profiles
      SET photo_url = NULL, avatar_url = NULL
      WHERE id = $1::uuid;
      `,
      [testProfileId]
    );

    const checkRes = await pool.query(
      `SELECT photo_url, avatar_url FROM public.profiles WHERE id = $1::uuid`,
      [testProfileId]
    );

    assert.equal(checkRes.rows[0].photo_url, null);
    assert.equal(checkRes.rows[0].avatar_url, null);
  });
});
