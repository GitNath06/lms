import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const query = `
      SELECT 
        c.table_name, 
        c.column_name, 
        c.is_nullable, 
        rc.delete_rule,
        tc.constraint_name
      FROM information_schema.columns c
      JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc 
        ON kcu.constraint_name = rc.constraint_name
      JOIN information_schema.table_constraints tc 
        ON tc.constraint_name = rc.constraint_name
      WHERE rc.delete_rule = 'SET NULL' AND c.is_nullable = 'NO';
    `;
    const res = await pool.query(query);
    console.log('Columns with SET NULL that are NOT NULL:');
    console.table(res.rows);
  } finally {
    await pool.end();
  }
}

main();
