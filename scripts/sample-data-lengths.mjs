import pg from 'pg';
import { resolveDatabaseUrl } from '../lib/db.ts';

const connectionString = resolveDatabaseUrl(process.env.DATABASE_URL);
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  console.log('=== PRACTICAL LOGS ===');
  const pStats = await client.query(`
    SELECT 
      count(*) as total_rows,
      min(length(topic_learned)) as min_topic,
      round(avg(length(topic_learned))) as avg_topic,
      max(length(topic_learned)) as max_topic,
      min(length(remarks)) as min_remarks,
      round(avg(length(remarks))) as avg_remarks,
      max(length(remarks)) as max_remarks,
      min(length(skip_reason)) as min_skip,
      round(avg(length(skip_reason))) as avg_skip,
      max(length(skip_reason)) as max_skip
    FROM public.practical_logs;
  `);
  console.log(pStats.rows[0]);

  const pSamples = await client.query(`
    SELECT topic_learned, remarks, skip_reason 
    FROM public.practical_logs 
    WHERE remarks IS NOT NULL OR topic_learned IS NOT NULL OR skip_reason IS NOT NULL 
    LIMIT 5;
  `);
  console.log('Practical Samples:', pSamples.rows);

  console.log('\n=== LAB INCIDENTS ===');
  const incStats = await client.query(`
    SELECT 
      count(*) as total_rows,
      min(length(title)) as min_title,
      round(avg(length(title))) as avg_title,
      max(length(title)) as max_title,
      min(length(circumstances)) as min_circ,
      round(avg(length(circumstances))) as avg_circ,
      max(length(circumstances)) as max_circ,
      min(length(resolution_notes)) as min_res,
      round(avg(length(resolution_notes))) as avg_res,
      max(length(resolution_notes)) as max_res
    FROM public.lab_incidents;
  `);
  console.log(incStats.rows[0]);

  const incSamples = await client.query(`
    SELECT equipment_name, title, circumstances, resolution_notes 
    FROM public.lab_incidents 
    LIMIT 5;
  `);
  console.log('Incident Samples:', incSamples.rows);

  console.log('\n=== MAINTENANCE LOGS ===');
  const maintStats = await client.query(`
    SELECT 
      count(*) as total_rows,
      min(length(work_performed)) as min_work,
      round(avg(length(work_performed))) as avg_work,
      max(length(work_performed)) as max_work,
      min(length(remarks)) as min_rem,
      round(avg(length(remarks))) as avg_rem,
      max(length(remarks)) as max_rem
    FROM public.maintenance_logs;
  `);
  console.log(maintStats.rows[0]);

  const maintSamples = await client.query(`
    SELECT asset_identifier, work_performed, remarks 
    FROM public.maintenance_logs 
    LIMIT 5;
  `);
  console.log('Maintenance Samples:', maintSamples.rows);

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
