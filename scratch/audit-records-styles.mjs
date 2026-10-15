import fs from 'fs';

const files = [
  'components/records/practical-records-table.tsx',
  'components/records/incident-records-table.tsx',
  'components/maintenance/maintenance-ledger-table.tsx',
  'components/records/practical-filter-bar.tsx',
  'components/records/incident-filter-bar.tsx',
  'components/print/print-layout.tsx'
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  console.log('\n========================================');
  console.log('FILE:', file);
  console.log('========================================');
  lines.forEach((line, idx) => {
    if (/(text-zinc-|text-\[|TableHead|<th|<label|<p className=)/.test(line)) {
      if (!line.includes('import ') && !line.includes('//')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    }
  });
}
