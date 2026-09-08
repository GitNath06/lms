import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runTests() {
  console.log('--- TEST SUITE: INSTITUTION SETTINGS SINGLE SOURCE OF TRUTH ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Table existence and RLS check
    const rlsRes = await pool.query(`
      SELECT rowsecurity FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'institution_settings';
    `);
    assert(rlsRes.rows.length === 1, 'Table public.institution_settings exists');
    assert(rlsRes.rows[0]?.rowsecurity === true, 'Row Level Security is enabled on institution_settings');

    // 2. Realtime Publication check
    const pubRes = await pool.query(`
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'institution_settings';
    `);
    assert(pubRes.rows.length === 1, 'institution_settings is published in supabase_realtime publication');

    // 3. Required Institutional Keys check
    const keysRes = await pool.query(`
      SELECT key FROM public.institution_settings ORDER BY key;
    `);
    const foundKeys = keysRes.rows.map(r => r.key);
    const expectedKeys = [
      'calendar_settings',
      'infrastructure_classes',
      'infrastructure_incident_categories',
      'infrastructure_incident_settings',
      'infrastructure_periods',
      'infrastructure_subjects',
    ];

    for (const key of expectedKeys) {
      assert(foundKeys.includes(key), `Key "${key}" is stored in PostgreSQL institution_settings`);
    }

    // 4. Verify calendar_settings schema
    const calRes = await pool.query(`
      SELECT value FROM public.institution_settings WHERE key = 'calendar_settings';
    `);
    const calVal = calRes.rows[0]?.value;
    assert(calVal && typeof calVal === 'object', 'calendar_settings value is a valid JSON object');
    assert('startDay' in calVal, 'calendar_settings contains startDay');
    assert('sundayWeekend' in calVal, 'calendar_settings contains sundayWeekend');
    assert('saturdayWeekend' in calVal, 'calendar_settings contains saturdayWeekend');

    // 5. Verify periods schema
    const perRes = await pool.query(`
      SELECT value FROM public.institution_settings WHERE key = 'infrastructure_periods';
    `);
    const perVal = perRes.rows[0]?.value;
    assert(Array.isArray(perVal) && perVal.length > 0, 'infrastructure_periods is a non-empty array');
    assert(perVal[0]?.id && perVal[0]?.name && perVal[0]?.label, 'Period item has id, name, label');

    console.log(`\nResults: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Error running test suite:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
