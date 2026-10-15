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

const envContent = fs.readFileSync(envPath, 'utf8')
const rawUrl = envContent.match(/DATABASE_URL=(.*)/)?.[1]?.trim().replace(/^['"]|['"]$/g, '')
const resolvedUrl = resolveDatabaseUrl(rawUrl)
process.env.DATABASE_URL = resolvedUrl

const pool = new pg.Pool({ connectionString: resolvedUrl, ssl: { rejectUnauthorized: false } })

// Import Server Actions
const {
  verifySignupAndCreateAccount,
  generateAndSendSignupOtp,
} = await import('../app/actions/otp.ts')

async function runTests() {
  const client = await pool.connect()
  console.log('🔒 =============================================================')
  console.log('🔒 STARTING OTP SECURITY FIX VERIFICATION SUITE')
  console.log('🔒 =============================================================\n')

  try {
    const testEmail = 'security_concurrency_test@ratnarajya.edu.np'
    const cooldownEmail = 'security_cooldown_test@ratnarajya.edu.np'

    // Clean up previous test runs
    await client.query(`DELETE FROM public.email_otps WHERE email IN ($1, $2)`, [testEmail, cooldownEmail])
    await client.query(`DELETE FROM public.rate_limit_events WHERE key LIKE '127.0.0.1:%'`)

    // ---------------------------------------------------------------------------
    // TEST 1: Concurrency Race Condition Test (Atomic WHERE attempts < 5)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 1: Concurrency Race Condition (20 Parallel Bad Code Guesses) ---')
    
    // Seed an OTP record with attempts = 0
    const seedRes = await client.query(`
      INSERT INTO public.email_otps (email, otp_code, purpose, expires_at, created_at, attempts, is_verified)
      VALUES ($1, '849201', 'signup', now() + interval '10 minutes', now(), 0, false)
      RETURNING id, otp_code, attempts;
    `, [testEmail])
    
    const seededOtp = seedRes.rows[0]
    console.log(`✅ Seeded OTP: ID = ${seededOtp.id}, Code = ${seededOtp.otp_code}, Initial Attempts = ${seededOtp.attempts}`)

    // Prepare 20 simultaneous verify requests with WRONG code ('000000')
    const createFormData = () => {
      const fd = new FormData()
      fd.append('email', testEmail)
      fd.append('password', 'ValidPass123!')
      fd.append('full_name', 'Concurrency Test Teacher')
      fd.append('department', 'Science Department')
      return fd
    }

    console.log('⚡ Firing 20 simultaneous verifySignupAndCreateAccount calls with incorrect code "000000"...')
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(verifySignupAndCreateAccount(createFormData(), '000000'))
    }

    const results = await Promise.all(promises)

    // Inspect database row directly
    const verifyDbRes = await client.query(`
      SELECT id, email, attempts, is_verified
      FROM public.email_otps
      WHERE id = $1;
    `, [seededOtp.id])

    const finalRow = verifyDbRes.rows[0]
    console.log('\n📊 Concurrency Test Results:')
    console.log('==============================================')
    console.log(`🎯 FINAL ATTEMPTS IN POSTGRES DATABASE: ${finalRow.attempts}`)
    console.log('==============================================')

    const invalidCodeResponses = results.filter(r => r.error && r.error.includes('Invalid verification code'))
    const lockedResponses = results.filter(r => r.error && r.error.includes('Too many incorrect attempts'))
    const rateLimitResponses = results.filter(r => r.error && r.error.includes('Rate limit exceeded'))

    console.log(`- Total Parallel Requests: 20`)
    console.log(`- "Invalid verification code" responses: ${invalidCodeResponses.length}`)
    console.log(`- "Too many incorrect attempts" responses: ${lockedResponses.length}`)
    console.log(`- "Rate limit exceeded" responses: ${rateLimitResponses.length}`)

    if (finalRow.attempts !== 5) {
      throw new Error(`❌ CONCURRENCY TEST FAILED! Final attempts in DB is ${finalRow.attempts}, expected exactly 5!`)
    }
    console.log('✅ PASS: Concurrency race condition completely closed. Attempts strictly capped at 5 in database!\n')

    // ---------------------------------------------------------------------------
    // TEST 2: Per-Email Generation Cooldown Test (60 Seconds)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 2: Per-Email Generation Cooldown (Rapid Double Generation) ---')
    // Reset rate limits for test IP to isolate cooldown logic
    await client.query(`DELETE FROM public.rate_limit_events WHERE key LIKE '127.0.0.1:%'`)

    console.log(`1. Dispatching initial signup OTP for ${cooldownEmail}...`)
    const firstGen = await generateAndSendSignupOtp(cooldownEmail, 'Cooldown Test Teacher')
    console.log('First call result:', firstGen.message || firstGen.error)

    console.log('2. Immediately firing rapid second signup OTP call for same email...')
    const secondGen = await generateAndSendSignupOtp(cooldownEmail, 'Cooldown Test Teacher')
    console.log('Second call result:', secondGen.message || secondGen.error)

    const cooldownRows = await client.query(`
      SELECT id, email, created_at
      FROM public.email_otps
      WHERE email = $1 AND purpose = 'signup'
      ORDER BY created_at DESC;
    `, [cooldownEmail])

    console.log(`Database row count for ${cooldownEmail}: ${cooldownRows.rowCount}`)

    if (!secondGen.error || !secondGen.error.includes('Please wait before requesting another code')) {
      throw new Error(`❌ COOLDOWN TEST FAILED: Second call was not rejected with cooldown message! Got: ${JSON.stringify(secondGen)}`)
    }
    if (cooldownRows.rowCount !== 1) {
      throw new Error(`❌ COOLDOWN TEST FAILED: Expected 1 OTP row in database, found ${cooldownRows.rowCount}!`)
    }
    console.log('✅ PASS: Per-email 60-second cooldown rejected second generation and prevented extra row creation.\n')

    // ---------------------------------------------------------------------------
    // TEST 3: IP-Based Rate Limiting Test (20 Verify Attempts / 10 Min)
    // ---------------------------------------------------------------------------
    console.log('--- TEST 3: IP-Based Rate Limiting Verification ---')
    const ipTestKey = '127.0.0.1:verify_signup_otp'
    
    // Clear and pre-populate 20 rate limit events for 127.0.0.1
    await client.query(`DELETE FROM public.rate_limit_events WHERE key = $1`, [ipTestKey])
    for (let i = 0; i < 20; i++) {
      await client.query(`
        INSERT INTO public.rate_limit_events (key, action, created_at)
        VALUES ($1, 'verify_signup_otp', now() - interval '1 minute');
      `, [ipTestKey])
    }

    const currentCount = await client.query(`SELECT count(*)::int as c FROM public.rate_limit_events WHERE key = $1`, [ipTestKey])
    console.log(`Simulated event count for ${ipTestKey}: ${currentCount.rows[0].c}`)

    console.log('Triggering 21st verification call from 127.0.0.1...')
    const rateLimitedCall = await verifySignupAndCreateAccount(createFormData(), '123456')
    console.log('Result on 21st call:', rateLimitedCall)

    if (!rateLimitedCall.error || !rateLimitedCall.error.toLowerCase().includes('rate limit exceeded')) {
      throw new Error(`❌ RATE LIMIT TEST FAILED: Call 21 was not blocked by IP rate limiter! Got: ${JSON.stringify(rateLimitedCall)}`)
    }
    console.log('✅ PASS: 21st request was blocked by IP rate limiter.\n')

    // Clean up test data
    await client.query(`DELETE FROM public.email_otps WHERE email IN ($1, $2)`, [testEmail, cooldownEmail])
    await client.query(`DELETE FROM public.rate_limit_events WHERE key LIKE '127.0.0.1:%'`)
    console.log('🧹 Cleaned up all test database records.')

    console.log('\n=============================================================')
    console.log('🎉 ALL THREE SECURITY CHECKS PASSED WITH 100% SUCCESS!')
    console.log('=============================================================')

  } finally {
    client.release()
    await pool.end()
  }
}

runTests().catch(err => {
  console.error('❌ Test execution error:', err)
  process.exit(1)
})
