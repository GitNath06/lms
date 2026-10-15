import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      return `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

let databaseUrl = process.env.DATABASE_URL
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/DATABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (match) databaseUrl = match
  const sUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (sUrl) supabaseUrl = sUrl
  const aKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
  if (aKey) anonKey = aKey
}

const resolvedUrl = resolveDatabaseUrl(databaseUrl)
const pool = new pg.Pool({ connectionString: resolvedUrl, ssl: { rejectUnauthorized: false } })

console.log('🔒 [Security Verification] Testing RLS Hardening for email_otps and email_dispatch_logs...\n')

async function runVerification() {
  const client = await pool.connect()

  try {
    // --------------------------------------------------------------------------
    // 1. Check pg_tables for RLS on both tables
    // --------------------------------------------------------------------------
    console.log('--- 1. Verifying RLS Enabled via pg_tables ---')
    const rlsRes = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('email_otps', 'email_dispatch_logs')
      ORDER BY tablename;
    `)
    for (const row of rlsRes.rows) {
      if (!row.rowsecurity) {
        throw new Error(`❌ Table ${row.tablename} has rowsecurity = false!`)
      }
      console.log(`✅ ${row.tablename}: rowsecurity = true`)
    }

    // --------------------------------------------------------------------------
    // 2. Check Supabase Advisor query for any tables without RLS
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Checking Supabase Advisor RLS Query ---')
    const advisorRes = await client.query(`
      SELECT c.relname
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relkind = 'r' AND n.nspname = 'public' AND NOT c.relrowsecurity;
    `)
    if (advisorRes.rows.length > 0) {
      throw new Error(`❌ Unsecured tables still exist: ${advisorRes.rows.map(r => r.relname).join(', ')}`)
    }
    console.log('✅ Supabase Advisor check: 0 tables without RLS found in public schema. Both CRITICAL findings cleared!')

    // --------------------------------------------------------------------------
    // 3. Check Table Grants for anon and authenticated
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Verifying Revoked Privileges (Grants) ---')
    const grantsRes = await client.query(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_name IN ('email_otps', 'email_dispatch_logs') AND grantee IN ('anon', 'authenticated')
      ORDER BY table_name, grantee, privilege_type;
    `)
    console.log(`Current grants for anon/authenticated (${grantsRes.rows.length} total):`)
    console.table(grantsRes.rows)

    const otpsGrants = grantsRes.rows.filter(r => r.table_name === 'email_otps')
    if (otpsGrants.length > 0) {
      throw new Error(`❌ email_otps has remaining grants for anon/authenticated: ${JSON.stringify(otpsGrants)}`)
    }
    console.log('✅ public.email_otps: 0 grants for anon and authenticated (cleanly revoked).')

    const dispatchNonSelect = grantsRes.rows.filter(r => r.table_name === 'email_dispatch_logs' && r.privilege_type !== 'SELECT')
    if (dispatchNonSelect.length > 0) {
      throw new Error(`❌ email_dispatch_logs has remaining write grants: ${JSON.stringify(dispatchNonSelect)}`)
    }
    console.log('✅ public.email_dispatch_logs: 0 write grants for anon/authenticated (SELECT only for authenticated).')

    // --------------------------------------------------------------------------
    // 4. Test Client-Side RLS Enforcement (PostgREST / Supabase Client Simulation)
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Client-Side RLS / Permission Enforcement ---')
    // Test anon direct query simulation via PostgreSQL role switching
    await client.query('BEGIN;')
    try {
      await client.query('SET LOCAL ROLE anon;')
      let anonOtpsBlocked = false
      try {
        await client.query('SELECT * FROM public.email_otps LIMIT 1;')
      } catch (err) {
        anonOtpsBlocked = true
        console.log(`🛡️ anon querying email_otps: Blocked with error: ${err.message}`)
      }
      if (!anonOtpsBlocked) {
        throw new Error('❌ anon was NOT blocked from querying email_otps!')
      }

      let anonDispatchBlocked = false
      try {
        await client.query('SELECT * FROM public.email_dispatch_logs LIMIT 1;')
      } catch (err) {
        anonDispatchBlocked = true
        console.log(`🛡️ anon querying email_dispatch_logs: Blocked with error: ${err.message}`)
      }
      if (!anonDispatchBlocked) {
        throw new Error('❌ anon was NOT blocked from querying email_dispatch_logs!')
      }
    } finally {
      await client.query('ROLLBACK;')
    }

    // Test authenticated teacher role simulation (should see 0 dispatch logs or be denied writes)
    await client.query('BEGIN;')
    try {
      await client.query('SET LOCAL ROLE authenticated;')
      let writeBlocked = false
      try {
        await client.query(`INSERT INTO public.email_dispatch_logs (dispatch_type, recipient_email) VALUES ('test', 'attacker@test.com');`)
      } catch (err) {
        writeBlocked = true
        console.log(`🛡️ authenticated client inserting into email_dispatch_logs: Blocked with error: ${err.message}`)
      }
      if (!writeBlocked) {
        throw new Error('❌ authenticated client was able to insert into email_dispatch_logs!')
      }
    } finally {
      await client.query('ROLLBACK;')
    }

    // --------------------------------------------------------------------------
    // 5. End-to-End Server-Side OTP Flow Verification (Superuser / Server Action)
    // --------------------------------------------------------------------------
    console.log('\n--- 5. End-to-End Server-Side OTP Flow Verification ---')
    const testEmail = 'sec-verify-test@rrl.edu.np'
    const testOtp = '849201'

    // Clean any prior run
    await client.query('DELETE FROM public.email_otps WHERE email = $1;', [testEmail])

    // Step A: Invalidate older codes
    await client.query(
      `UPDATE public.email_otps SET is_verified = TRUE WHERE email = $1 AND purpose = 'signup'`,
      [testEmail]
    )

    // Step B: Insert new OTP
    const insertRes = await client.query(
      `
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at)
      VALUES ($1, $2, 'signup', now() + interval '10 minutes', now())
      RETURNING id, email, otp_code, purpose, is_verified;
      `,
      [testEmail, testOtp]
    )
    console.log(`✅ Server action successfully inserted OTP record: ID = ${insertRes.rows[0].id}`)

    // Step C: Query active OTP
    const fetchRes = await client.query(
      `
      SELECT id, otp_code, attempts, expires_at
      FROM public.email_otps
      WHERE email = $1 AND purpose = 'signup' AND is_verified = FALSE
      ORDER BY created_at DESC
      LIMIT 1;
      `,
      [testEmail]
    )
    if (fetchRes.rows.length === 0 || fetchRes.rows[0].otp_code !== testOtp) {
      throw new Error('❌ Failed to retrieve active OTP record during verification!')
    }
    console.log(`✅ Server action retrieved active OTP: Code = ${fetchRes.rows[0].otp_code}`)

    // Step D: Increment attempt and mark verified
    await client.query(`UPDATE public.email_otps SET attempts = attempts + 1 WHERE id = $1;`, [fetchRes.rows[0].id])
    await client.query(`UPDATE public.email_otps SET is_verified = TRUE WHERE id = $1;`, [fetchRes.rows[0].id])
    console.log('✅ Server action updated OTP status to is_verified = TRUE.')

    // Clean up test OTP
    await client.query('DELETE FROM public.email_otps WHERE email = $1;', [testEmail])
    console.log('✅ Cleaned up test OTP.')

    // --------------------------------------------------------------------------
    // 6. End-to-End Server-Side Email Dispatch Logging Verification
    // --------------------------------------------------------------------------
    console.log('\n--- 6. End-to-End Email Dispatch Logging Verification ---')
    const testDispatchType = 'security_verification_test'
    const testRecipient = 'admin.notice@rrl.edu.np'
    const todayStr = new Date().toISOString().split('T')[0]

    // Clean prior test
    await client.query(
      `DELETE FROM public.email_dispatch_logs WHERE dispatch_type = $1 AND recipient_email = $2 AND reference_date = $3;`,
      [testDispatchType, testRecipient, todayStr]
    )

    // Insert dispatch log (idempotent pattern used by notifications.ts)
    const logRes1 = await client.query(
      `
      INSERT INTO public.email_dispatch_logs (dispatch_type, recipient_email, reference_date, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dispatch_type, recipient_email, reference_date) DO NOTHING
      RETURNING id;
      `,
      [testDispatchType, testRecipient, todayStr, JSON.stringify({ verified_by: 'security_audit' })]
    )
    if (logRes1.rows.length === 0) {
      throw new Error('❌ Failed to insert initial dispatch log!')
    }
    console.log(`✅ First dispatch logged: ID = ${logRes1.rows[0].id}`)

    // Test idempotency: duplicate insert on same day should return 0 rows
    const logRes2 = await client.query(
      `
      INSERT INTO public.email_dispatch_logs (dispatch_type, recipient_email, reference_date, metadata)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dispatch_type, recipient_email, reference_date) DO NOTHING
      RETURNING id;
      `,
      [testDispatchType, testRecipient, todayStr, JSON.stringify({ verified_by: 'security_audit' })]
    )
    if (logRes2.rows.length !== 0) {
      throw new Error('❌ Idempotency failed: Duplicate dispatch was recorded!')
    }
    console.log('✅ Idempotency test passed: duplicate dispatch suppressed as expected.')

    // Clean up test dispatch log
    await client.query(
      `DELETE FROM public.email_dispatch_logs WHERE dispatch_type = $1 AND recipient_email = $2 AND reference_date = $3;`,
      [testDispatchType, testRecipient, todayStr]
    )
    console.log('✅ Cleaned up test dispatch log.')

    // --------------------------------------------------------------------------
    // 7. Plaintext vs Hashed Storage Investigation
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Storage Format Analysis: Plaintext vs Hashed OTP ---')
    const colTypeRes = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'email_otps' AND column_name = 'otp_code';
    `)
    console.log('Database column definition:', colTypeRes.rows[0])

    console.log('\n=============================================================')
    console.log('🎉 ALL RLS & OPERATIONAL VERIFICATION CHECKS PASSED!')
    console.log('=============================================================')

  } finally {
    client.release()
    await pool.end()
  }
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err)
  process.exit(1)
})
