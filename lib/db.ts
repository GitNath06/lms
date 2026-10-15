import { Pool } from 'pg'

declare global {
  var __PG_POOL__: Pool | undefined
}

export function resolveDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl
  if (rawUrl.includes('db.') && rawUrl.includes('.supabase.co')) {
    const match = rawUrl.match(/postgresql:\/\/([^:]+):(.+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.+)$/)
    if (match) {
      const [, , pass, ref, db] = match
      const decodedPass = decodeURIComponent(pass)
      return `postgresql://postgres.${ref}:${encodeURIComponent(decodedPass)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/${db}`
    }
  }
  return rawUrl
}

export function getPgPool(): Pool {
  if (!globalThis.__PG_POOL__) {
    const connectionString = resolveDatabaseUrl(process.env.DATABASE_URL)
    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
    // Attach error handler to prevent idle connection termination from bubbling as unhandled errors
    pool.on('error', (err) => {
      console.warn('PostgreSQL pool idle client warning:', err.message)
    })
    globalThis.__PG_POOL__ = pool
  }
  return globalThis.__PG_POOL__
}
