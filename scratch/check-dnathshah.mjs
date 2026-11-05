import { getPgPool } from '../lib/db.ts'

async function checkUser() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    const email = 'dnathshah11@gmail.com'
    const u = await client.query('SELECT id, email, created_at FROM auth.users WHERE email = $1', [email])
    console.log('auth.users:', u.rows)
    const p = await client.query('SELECT id, email, role, approval_status, is_active FROM public.profiles WHERE email = $1', [email])
    console.log('public.profiles:', p.rows)
    const o = await client.query('SELECT id, email, otp_code, attempts, is_verified, expires_at FROM public.email_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 3', [email])
    console.log('email_otps:', o.rows)
  } finally {
    client.release()
    await pool.end()
  }
}

checkUser()
