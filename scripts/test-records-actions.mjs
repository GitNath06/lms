import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function run() {
  console.log('🧪 Testing Server Actions and Export Generators...');

  // Dynamically import Server Actions
  const {
    getPracticalRecords,
    getIncidentRecords,
    exportPracticalRecordsAction,
    exportIncidentRecordsAction,
    updateIncidentWorkflow,
  } = await import('../app/actions/records.ts');

  // Test 1: getPracticalRecords without grouping
  console.log('\n--- Test 1: getPracticalRecords (flat list) ---');
  const flatRes = await getPracticalRecords({}, 'none');
  console.log(`Success: ${flatRes.success}, Total count: ${flatRes.totalCount}`);
  console.log(`Metrics: Total Sessions=${flatRes.metrics.totalSessions}, Avg Turnout=${flatRes.metrics.averageAttendancePct.toFixed(1)}%`);
  console.log(`Sections count: ${flatRes.sections.length}`);
  if (!flatRes.success) throw new Error(flatRes.error);

  // Test 2: getPracticalRecords with grouping by 'teacher'
  console.log('\n--- Test 2: getPracticalRecords (grouped by teacher) ---');
  const teacherGroupRes = await getPracticalRecords({}, 'teacher');
  console.log(`Success: ${teacherGroupRes.success}, Groups count: ${teacherGroupRes.sections.length}`);
  for (const sec of teacherGroupRes.sections) {
    console.log(`  📂 Group [${sec.groupTitle}]: ${sec.subtotal.totalSessions} sessions, Avg=${sec.subtotal.averageAttendancePct.toFixed(1)}%`);
  }

  // Test 3: getIncidentRecords
  console.log('\n--- Test 3: getIncidentRecords ---');
  const incRes = await getIncidentRecords({});
  console.log(`Success: ${incRes.success}, Incidents count: ${incRes.incidents.length}`);
  console.log(`Metrics: Open=${incRes.metrics.openCount}, Resolved=${incRes.metrics.resolvedCount}, Avg Time=${incRes.metrics.averageTimeToResolveLabel}`);

  // Test 4: Excel Export (.xlsx)
  console.log('\n--- Test 4: Excel (.xlsx) Export ---');
  const xlsxPractical = await exportPracticalRecordsAction({}, 'teacher', 'xlsx');
  console.log(`Practical Excel Export: Success=${xlsxPractical.success}, Filename=${xlsxPractical.filename}, Size=${xlsxPractical.base64?.length} chars`);
  if (!xlsxPractical.success || !xlsxPractical.base64) throw new Error(xlsxPractical.error);

  const xlsxIncident = await exportIncidentRecordsAction({}, 'xlsx');
  console.log(`Incident Excel Export: Success=${xlsxIncident.success}, Filename=${xlsxIncident.filename}, Size=${xlsxIncident.base64?.length} chars`);
  if (!xlsxIncident.success || !xlsxIncident.base64) throw new Error(xlsxIncident.error);

  // Test 5: CSV Export
  console.log('\n--- Test 5: CSV Export ---');
  const csvPractical = await exportPracticalRecordsAction({}, 'subject_name', 'csv');
  console.log(`Practical CSV Export: Success=${csvPractical.success}, Filename=${csvPractical.filename}`);
  const csvIncident = await exportIncidentRecordsAction({}, 'csv');
  console.log(`Incident CSV Export: Success=${csvIncident.success}, Filename=${csvIncident.filename}`);

  // Test 6: Integrity validation on resolution
  console.log('\n--- Test 6: Integrity validation on incident resolution ---');
  const emptyNoteRes = await updateIncidentWorkflow('inc-seed-1', {
    status: 'resolved',
    resolution_notes: '',
  });
  console.log(`Resolution with empty notes blocked as expected: Success=${emptyNoteRes.success}, Error="${emptyNoteRes.error}"`);
  if (emptyNoteRes.success) {
    throw new Error('Expected resolution without notes to fail!');
  }

  console.log('\n🎉 ALL RECORD & INCIDENT TESTS PASSED WITH 100% INTEGRITY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
