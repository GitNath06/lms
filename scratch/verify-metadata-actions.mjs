import fs from 'fs';
import path from 'path';

// Set up env
const envPath = path.resolve(process.cwd(), '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
for (const line of content.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
}

async function verify() {
  const { getAcademicYears } = await import('../app/actions/academic-years.ts');
  const { getClassesAction, getClassEnrollmentStats } = await import('../app/actions/classes.ts');

  const [years, classes, stats2083, stats2084] = await Promise.all([
    getAcademicYears(),
    getClassesAction(),
    getClassEnrollmentStats('2083'),
    getClassEnrollmentStats('2084'),
  ]);

  console.log('Years success:', years.success, 'Count:', years.data?.length);
  console.log('Classes success:', classes.success, 'Count:', classes.data?.length);
  console.log('Stats 2083:', stats2083);
  console.log('Stats 2084:', stats2084);
  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
