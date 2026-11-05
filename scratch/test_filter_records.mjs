import { getPracticalRecords } from '../app/actions/records.ts';

async function testFilter() {
  console.log('Testing getPracticalRecords with date range 2026-10-05 to 2026-10-12...');
  const res = await getPracticalRecords({
    academic_year_id: 'all',
    lab_id: 'all',
    date_from: '2026-10-05',
    date_to: '2026-10-12',
    page: 1,
    pageSize: 10,
  });
  console.log('Result success:', res.success, 'totalCount:', res.totalCount, 'records length:', res.records.length);
  res.records.forEach((r, i) => {
    console.log(`[${i}] date:`, r.date, 'title:', r.practical_title);
  });

  console.log('\nTesting with BS date strings if passed directly: date_from: 2083-06-19, date_to: 2083-06-26...');
  const resBs = await getPracticalRecords({
    academic_year_id: 'all',
    lab_id: 'all',
    date_from: '2083-06-19',
    date_to: '2083-06-26',
    page: 1,
    pageSize: 10,
  });
  console.log('BS Result success:', resBs.success, 'totalCount:', resBs.totalCount);
}

testFilter().catch(console.error);
