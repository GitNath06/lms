const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const res = await pool.query(`
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'session_status';
    `);
    console.log('Enum labels for session_status:', res.rows.map(r => r.enumlabel));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
})();