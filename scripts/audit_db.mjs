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

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");

  const profiles = await client.query("SELECT id, full_name, email, role, department, permissions FROM profiles ORDER BY full_name");

  const labs = await client.query("SELECT id, name, type, capacity, is_active FROM labs ORDER BY id");

  const schedules = await client.query("SELECT id, lab_id, teacher_id, subject_name, batch_name, slot_id, day_key, start_time, end_time, status, metadata FROM schedules ORDER BY lab_id, day_key, slot_id");

  const schedulesByTeacher = await client.query(`
    SELECT s.teacher_id, p.full_name, p.role, count(*) as session_count,
           array_agg(DISTINCT s.subject_name) as subjects,
           array_agg(DISTINCT s.batch_name) as batches,
           array_agg(DISTINCT s.lab_id) as labs
    FROM schedules s
    LEFT JOIN profiles p ON s.teacher_id = p.id
    GROUP BY s.teacher_id, p.full_name, p.role
  `);

  const practicalLogs = await client.query("SELECT id, lab_id, teacher_id, date, period_label, subject_name, batch_group, practical_title, total_students, present_students, absent_students, topic_learned, status FROM practical_logs ORDER BY date DESC");

  const incidents = await client.query("SELECT id, lab_id, subject_name, subject_teacher_name, batch_name, title, status, severity, reported_by, reported_by_id, resolved_by_id FROM lab_incidents");

  const dump = {
    tables: tables.rows.map(r => r.table_name),
    profiles: profiles.rows,
    labs: labs.rows,
    schedulesCount: schedules.rows.length,
    teacherAssignments: schedulesByTeacher.rows,
    sampleSchedules: schedules.rows.slice(0, 15),
    practicalLogs: practicalLogs.rows,
    incidents: incidents.rows,
  };

  fs.writeFileSync('scratch_db_dump.json', JSON.stringify(dump, null, 2));
  console.log('Successfully wrote scratch_db_dump.json');

  await client.end();
}

run().catch(console.error);
