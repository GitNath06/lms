import { getPgPool } from '../lib/db.ts'

async function check() {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    const res = await client.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger
      WHERE tgrelid IN ('public.profiles'::regclass, 'auth.users'::regclass);
    `)
    console.log('Triggers found:')
    for (const row of res.rows) {
      console.log('---', row.tgname, '---')
      console.log(row.def)
    }

    const funcs = await client.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname IN ('protect_profile_escalation', 'handle_new_user', 'on_auth_user_created');
    `)
    console.log('\nFunctions found:')
    for (const f of funcs.rows) {
      console.log('---', f.proname, '---')
      console.log(f.prosrc)
    }
  } catch (err) {
    console.error(err)
  } finally {
    client.release()
    await pool.end()
  }
}

check()
