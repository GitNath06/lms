/**
 * Idempotent SQL migration & backfill script for canonical classes and clean subjects.
 *
 * Runs against PostgreSQL to:
 * 1. Normalize legacy batch/class names in practical_logs and lab_incidents to canonical Admin Panel classes.
 * 2. Strip repeating/stuttered subject code prefixes (e.g. "COMP-12 - COMP-12 — ..." -> "COMP-12 — ...").
 *
 * Usage:
 *   node scripts/backfill-canonical-classes-subjects.mjs [--dry-run]
 */

import pg from 'pg';
import fs from 'fs';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    for (const line of env.split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && k.trim() === 'DATABASE_URL') dbUrl = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
}

const isDryRun = process.argv.includes('--dry-run') || !dbUrl;

console.log(`[Migration] Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'LIVE EXECUTION'}`);

const CLASS_NORMALIZATION_RULES = [
  {
    target: '12 Eng',
    patterns: [
      '12C - Tech Stream Sec A',
      '12C - Tech Stream',
      '12C',
      'Class 12',
      '12-Eng',
      '12C-A',
    ],
  },
  {
    target: '11 Eng',
    patterns: [
      '11 Sc - Science Stream Sec B',
      '11 Sc - Science Sec B',
      '11 Sc',
      'Class 11',
      '11-Eng',
      '11Sc-B',
      '11Sc',
    ],
  },
  {
    target: '12 Mgt',
    patterns: [
      '12 Mgt - Mgmt Stream Sec A',
      '12-Mgt',
    ],
  },
  {
    target: '11 Mgt',
    patterns: [
      '11C - Computer Tech Sec A',
      '11C',
      '11-Mgt',
    ],
  },
];

async function run() {
  if (isDryRun && !dbUrl) {
    console.log('[Migration] No DATABASE_URL found or --dry-run specified. Printing generated SQL statements:\n');
  }

  const sqlStatements = [];

  // 1. Practical Logs Class Normalization
  for (const rule of CLASS_NORMALIZATION_RULES) {
    const inList = rule.patterns.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
    sqlStatements.push({
      desc: `Normalize practical_logs.batch_group to '${rule.target}'`,
      sql: `UPDATE practical_logs SET batch_group = '${rule.target}' WHERE batch_group IN (${inList});`,
    });
  }

  // 2. Lab Incidents Class Normalization
  for (const rule of CLASS_NORMALIZATION_RULES) {
    const inList = rule.patterns.map((p) => `'${p.replace(/'/g, "''")}'`).join(', ');
    sqlStatements.push({
      desc: `Normalize lab_incidents.batch_name to '${rule.target}'`,
      sql: `UPDATE lab_incidents SET batch_name = '${rule.target}' WHERE batch_name IN (${inList});`,
    });
  }

  // 3. Stuttered Subject Cleaning
  sqlStatements.push({
    desc: `Clean duplicate code prefixes in practical_logs.subject_name`,
    sql: `UPDATE practical_logs 
          SET subject_name = regexp_replace(subject_name, '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]\\s*', '\\1 — ', 'i')
          WHERE subject_name ~* '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]';`,
  });

  sqlStatements.push({
    desc: `Clean duplicate code prefixes in lab_incidents.subject_name`,
    sql: `UPDATE lab_incidents 
          SET subject_name = regexp_replace(subject_name, '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]\\s*', '\\1 — ', 'i')
          WHERE subject_name ~* '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]';`,
  });

  sqlStatements.push({
    desc: `Clean duplicate code prefixes in schedules.subject_name`,
    sql: `UPDATE schedules 
          SET subject_name = regexp_replace(subject_name, '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]\\s*', '\\1 — ', 'i')
          WHERE subject_name ~* '^([A-Z0-9-]+)\\s*[-–—]\\s*\\1\\s*[-–—]';`,
  });

  if (isDryRun && !process.argv.includes('--execute')) {
    for (const stmt of sqlStatements) {
      console.log(`-- ${stmt.desc}`);
      console.log(`${stmt.sql}\n`);
    }
    console.log('[Migration] Dry run completed successfully.');
    return;
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('[Migration] Connected to PostgreSQL. Applying updates...');

    for (const stmt of sqlStatements) {
      console.log(`[Executing] ${stmt.desc}...`);
      const res = await client.query(stmt.sql);
      console.log(`  -> Affected rows: ${res.rowCount || 0}`);
    }

    console.log('[Migration] All updates completed successfully.');
  } catch (err) {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
