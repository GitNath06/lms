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

async function testActions() {
  const { getClassesAction, getClassEnrollmentStats } = await import('../app/actions/classes.js').catch(async () => {
    // If strip-types or direct ts
    return await import('../app/actions/classes.ts');
  });

  console.log('Testing getClassesAction...');
  const classRes = await getClassesAction();
  console.log('getClassesAction result:', classRes);

  console.log('\nTesting getClassEnrollmentStats(2083)...');
  const statsRes = await getClassEnrollmentStats('2083');
  console.log('getClassEnrollmentStats result:', statsRes);
}

testActions().catch(console.error);
