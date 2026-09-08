import { Pool } from 'pg'

declare global {
  var __PG_POOL__: Pool | undefined
}

export function getPgPool(): Pool {
  if (!globalThis.__PG_POOL__) {
    globalThis.__PG_POOL__ = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return globalThis.__PG_POOL__
}
