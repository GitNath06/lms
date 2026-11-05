import { Pool, types } from 'pg'

// Force PostgreSQL DATE (1082), TIMESTAMP (1114), and TIMESTAMPTZ (1184) 
// to return as plain ISO strings to prevent React 19 '[object Date]' crashes
types.setTypeParser(1082, (val: string) => val)
types.setTypeParser(1114, (val: string) => val)
types.setTypeParser(1184, (val: string) => val)

declare global {
  var __PG_POOL__: Pool | undefined
}

export function resolveDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl
  let url = rawUrl.trim().replace(/^["']|["']$/g, '')
  if (url.includes('db.') && url.includes('.supabase.co')) {
    const match = url.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      url = `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/${db}`
    }
  }
  // Convert any session mode pooler (port 5432) to transaction mode pooler (port 6543)
  // to avoid connection starvation and ECONNRESET drops under multi-tab load
  if (url.includes('.pooler.supabase.com:5432')) {
    url = url.replace('.pooler.supabase.com:5432', '.pooler.supabase.com:6543')
  }
  return url
}

export function getPgPool(): Pool {
  if (!globalThis.__PG_POOL__) {
    const connectionString = resolveDatabaseUrl(process.env.DATABASE_URL)
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    })
    // Attach error handler to prevent idle connection termination from bubbling as unhandled errors
    pool.on('error', (err) => {
      console.warn('PostgreSQL pool client warning:', err.message)
    })
    globalThis.__PG_POOL__ = pool
  }
  return globalThis.__PG_POOL__
}
