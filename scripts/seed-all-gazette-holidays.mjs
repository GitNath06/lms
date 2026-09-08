import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadEnv('.env.local');
loadEnv('.env');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function seed() {
  await client.connect();
  console.log('Connected to PostgreSQL database.');

  const masterDataContent = fs.readFileSync('lib/master-data.ts', 'utf8');
  const startMarker = 'export const DEFAULT_HOLIDAYS: HolidayItem[] = [';
  const startIdx = masterDataContent.indexOf(startMarker);
  const endMarker = 'import { parseSlotTimeRange }';
  const endIdx = masterDataContent.indexOf(endMarker);
  const arrayText = masterDataContent.slice(startIdx + startMarker.length - 1, endIdx).trim();

  const holidays = eval(arrayText);
  console.log('Found holidays count in master-data:', holidays.length);

  for (const h of holidays) {
    const q = `
      INSERT INTO public.academic_holidays (
        id, title, name, title_np, date_start, date_end, bs_date_str,
        holiday_type, description, practicals_suspended, is_national
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        name = EXCLUDED.name,
        title_np = EXCLUDED.title_np,
        date_start = EXCLUDED.date_start,
        date_end = EXCLUDED.date_end,
        bs_date_str = EXCLUDED.bs_date_str,
        holiday_type = EXCLUDED.holiday_type,
        description = EXCLUDED.description,
        practicals_suspended = EXCLUDED.practicals_suspended,
        is_national = EXCLUDED.is_national;
    `;
    await client.query(q, [
      h.id,
      h.title,
      h.name || h.title,
      h.titleNp || h.title,
      h.dateStr,
      h.endDateStr || h.dateStr,
      h.bsDateStr || '',
      h.type,
      h.description || 'Public Holiday',
      true,
      true
    ]);
  }

  const { rows } = await client.query('SELECT count(*) as count FROM public.academic_holidays');
  console.log('Total seeded holidays in database:', rows[0].count);
  await client.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
