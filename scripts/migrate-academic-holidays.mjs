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

const OFFICIAL_2083_HOLIDAYS = [
  {
    id: 'hol-gaura',
    title: 'Gaura Parba (गौरा पर्व)',
    name: 'Gaura Parba',
    title_np: 'गौरा पर्व बिदा',
    date_start: '2026-09-04',
    date_end: '2026-09-04',
    bs_date_str: '२०८३ भदौ १९',
    holiday_type: 'cultural',
    description: 'Traditional Cultural Festival Public Holiday (Practicals Suspended)',
    is_national: true,
  },
  {
    id: 'hol-const',
    title: 'Constitution Day (संविधान दिवस)',
    name: 'Constitution Day',
    title_np: 'राष्ट्रिय संविधान दिवस',
    date_start: '2026-09-19',
    date_end: '2026-09-19',
    bs_date_str: '२०८३ असोज ०३',
    holiday_type: 'state',
    description: 'National Constitution Day Public Holiday',
    is_national: true,
  },
  {
    id: 'hol-dashain',
    title: 'Bada Dashain Vacation (बडा दसैं बिदा)',
    name: 'Bada Dashain Vacation',
    title_np: 'बडा दसैं बिदा',
    date_start: '2026-10-10',
    date_end: '2026-10-22',
    bs_date_str: '२०८३ असोज २४ - कात्तिक ०५',
    holiday_type: 'cultural',
    description: 'Annual National Autumn Festival Recess (13 Days)',
    is_national: true,
  },
  {
    id: 'hol-tihar',
    title: 'Tihar & Chhath Recess (तिहार तथा छठ बिदा)',
    name: 'Tihar & Chhath Recess',
    title_np: 'तिहार तथा छठ पर्व बिदा',
    date_start: '2026-11-08',
    date_end: '2026-11-13',
    bs_date_str: '२०८३ कात्तिक २३ - २८',
    holiday_type: 'cultural',
    description: 'Festival of Lights & Chhath Pooja Recess (6 Days)',
    is_national: true,
  },
  {
    id: 'hol-winter',
    title: 'Winter Vacation (हिउँदे बिदा)',
    name: 'Winter Vacation',
    title_np: 'हिउँदे बिदा',
    date_start: '2027-01-01',
    date_end: '2027-01-14',
    bs_date_str: '२०८३ पुस १७ - ३०',
    holiday_type: 'vacation',
    description: 'Mid-term Winter Vacation (14 Days)',
    is_national: true,
  },
  {
    id: 'hol-maghe',
    title: 'Maghe Sankranti (माघे संक्रान्ति)',
    name: 'Maghe Sankranti',
    title_np: 'माघे संक्रान्ति बिदा',
    date_start: '2027-01-15',
    date_end: '2027-01-15',
    bs_date_str: '२०८३ माघ ०१',
    holiday_type: 'cultural',
    description: 'Makar Sankranti National Public Holiday',
    is_national: true,
  },
  {
    id: 'hol-shivaratri',
    title: 'Maha Shivaratri (महाशिवरात्री)',
    name: 'Maha Shivaratri',
    title_np: 'महाशिवरात्री बिदा',
    date_start: '2027-03-06',
    date_end: '2027-03-06',
    bs_date_str: '२०८३ फागुन २२',
    holiday_type: 'cultural',
    description: 'Maha Shivaratri National Public Holiday',
    is_national: true,
  },
  {
    id: 'hol-holi',
    title: 'Holi / Fagu Purnima (होली पर्व)',
    name: 'Fagu Purnima (Holi)',
    title_np: 'फागु पूर्णिमा बिदा',
    date_start: '2027-03-22',
    date_end: '2027-03-22',
    bs_date_str: '२०८३ चैत ०८',
    holiday_type: 'cultural',
    description: 'Festival of Colors Public Holiday',
    is_national: true,
  },
  {
    id: 'hol-newyear',
    title: 'Nepali New Year (नयाँ वर्ष २०८४)',
    name: 'Nepali New Year 2084',
    title_np: 'नयाँ वर्ष बिदा',
    date_start: '2027-04-14',
    date_end: '2027-04-14',
    bs_date_str: '२०८४ बैशाख ०१',
    holiday_type: 'state',
    description: 'National New Year Public Holiday',
    is_national: true,
  },
  {
    id: 'hol-buddha',
    title: 'Buddha Jayanti (बुद्ध जयन्ती)',
    name: 'Buddha Jayanti',
    title_np: 'बुद्ध जयन्ती बिदा',
    date_start: '2027-05-11',
    date_end: '2027-05-11',
    bs_date_str: '२०८४ बैशाख २८',
    holiday_type: 'cultural',
    description: 'Buddha Jayanti & Ubhauli Parba Public Holiday',
    is_national: true,
  },
];

async function migrate() {
  try {
    await client.connect();
    console.log('🔗 Connected to PostgreSQL database.');

    // 1. Create table public.academic_holidays
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.academic_holidays (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        name TEXT NOT NULL,
        title_np TEXT,
        date_start DATE NOT NULL,
        date_end DATE,
        bs_date_str TEXT,
        holiday_type TEXT NOT NULL DEFAULT 'cultural',
        description TEXT,
        practicals_suspended BOOLEAN NOT NULL DEFAULT TRUE,
        is_national BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_academic_holidays_dates 
        ON public.academic_holidays(date_start, date_end);

      -- Deduplicate any existing duplicates before creating unique index
      DELETE FROM public.academic_holidays a USING public.academic_holidays b
      WHERE a.ctid < b.ctid AND a.date_start = b.date_start AND a.title = b.title;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_holidays_date_title
        ON public.academic_holidays(date_start, title);
    `);
    console.log('✅ Created public.academic_holidays table & indexes (including composite unique index).');

    // 2. Enable RLS
    await client.query(`
      ALTER TABLE public.academic_holidays ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Allow public read academic_holidays" ON public.academic_holidays;
      CREATE POLICY "Allow public read academic_holidays" 
        ON public.academic_holidays FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Allow authenticated insert academic_holidays" ON public.academic_holidays;
      CREATE POLICY "Allow authenticated insert academic_holidays" 
        ON public.academic_holidays FOR INSERT WITH CHECK (true);

      DROP POLICY IF EXISTS "Allow authenticated update academic_holidays" ON public.academic_holidays;
      CREATE POLICY "Allow authenticated update academic_holidays" 
        ON public.academic_holidays FOR UPDATE USING (true);

      DROP POLICY IF EXISTS "Allow authenticated delete academic_holidays" ON public.academic_holidays;
      CREATE POLICY "Allow authenticated delete academic_holidays" 
        ON public.academic_holidays FOR DELETE USING (true);
    `);
    console.log('✅ Configured RLS policies for academic_holidays.');

    // 3. Realtime publication
    try {
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_holidays;`);
      console.log('✅ Added academic_holidays to supabase_realtime publication.');
    } catch (pubErr) {
      console.log('ℹ️ Table may already be in publication:', pubErr.message);
    }

    // 4. Seed official 2083 BS Gazette holidays
    for (const h of OFFICIAL_2083_HOLIDAYS) {
      await client.query(`
        INSERT INTO public.academic_holidays (
          id, title, name, title_np, date_start, date_end, bs_date_str, holiday_type, description, practicals_suspended, is_national
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (date_start, title) DO UPDATE SET
          name = EXCLUDED.name,
          title_np = EXCLUDED.title_np,
          date_end = EXCLUDED.date_end,
          bs_date_str = EXCLUDED.bs_date_str,
          holiday_type = EXCLUDED.holiday_type,
          description = EXCLUDED.description,
          practicals_suspended = EXCLUDED.practicals_suspended,
          is_national = EXCLUDED.is_national,
          updated_at = now();
      `, [
        h.id,
        h.title,
        h.name,
        h.title_np,
        h.date_start,
        h.date_end,
        h.bs_date_str,
        h.holiday_type,
        h.description,
        true,
        h.is_national
      ]);
    }
    console.log(`✅ Seeded ${OFFICIAL_2083_HOLIDAYS.length} official national holidays into public.academic_holidays.`);

    const countRes = await client.query('SELECT count(*) FROM public.academic_holidays');
    console.log(`📊 Total holidays in database: ${countRes.rows[0].count}`);

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
