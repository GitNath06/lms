import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Generate 50 realistic practical records
const mock50Practical = Array.from({ length: 50 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  const grades = ['Grade 11 - Sci A', 'Grade 11 - Sci B', 'Grade 12 - Sci A', 'Grade 12 - Sci B'];
  const subjects = [
    { code: 'PHY-101', name: 'Physics Laboratory', title: 'Measurement with Vernier Caliper & Screw Gauge', topic: 'Error Analysis & Least Count' },
    { code: 'CHEM-201', name: 'Chemistry Laboratory', title: 'Titration of 0.1M HCl against Na2CO3', topic: 'Volumetric Analysis & Neutralization' },
    { code: 'BIO-101', name: 'Biology Laboratory', title: 'Microscopic examination of plant mitosis (Onion root)', topic: 'Cell Division & Prophase Stages' },
    { code: 'COMP-101', name: 'Computer Lab 01', title: 'Implementation of Binary Search in C++', topic: 'Divide and Conquer Algorithms' }
  ];
  const sub = subjects[i % subjects.length];
  const isSkipped = i % 9 === 0;
  return {
    id: `log-${i + 1}`,
    date: `2026-03-${day}`,
    period_label: `Period ${(i % 6) + 1}`,
    batch_group: grades[i % grades.length],
    subject_name: sub.name,
    practical_title: sub.title,
    topic_learned: isSkipped ? null : sub.topic,
    profiles: { full_name: 'Er. Anish Karki' },
    total_students: 40,
    present_students: isSkipped ? 0 : 36,
    status: isSkipped ? 'skipped' : 'completed',
    skip_reason: isSkipped ? 'Holiday' : null,
    remarks: isSkipped ? null : 'Completed.'
  };
});

function getHtml(isDense) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: ${isDense ? '6mm 8mm' : '8mm 10mm'}; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: white; color: black; }
  table { width: 100%; border-collapse: collapse; font-size: ${isDense ? '8.5pt' : '9.5px'}; }
  th {
    padding: ${isDense ? '2.5px 5px' : '4px 6px'};
    border: 1px solid #d1d5db;
    background: #f3f4f6;
    text-transform: uppercase;
    font-family: monospace;
    font-size: ${isDense ? '8pt' : '9px'};
    font-weight: bold;
    height: ${isDense ? '20px' : 'auto'};
  }
  td {
    padding: ${isDense ? '2.5px 5px' : '4px 6px'};
    border: 1px solid #d1d5db;
    line-height: ${isDense ? '1.15' : '1.25'};
    vertical-align: top;
    font-size: ${isDense ? '8pt' : '9px'};
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .header-box { border-bottom: 2px solid #18181b; padding-bottom: 6px; margin-bottom: 6px; }
  .sig-box { display: grid; grid-template-columns: 1fr 1fr; margin-top: 12px; padding-top: 6px; text-align: center; break-inside: avoid; }
  .sig-line { border-top: 2px solid #18181b; width: 180px; margin: 0 auto; padding-top: 3px; font-weight: bold; font-size: 8pt; }
</style>
</head>
<body>
  <div class="header-box">
    <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #52525b;">NEPAL SECONDARY EDUCATION BOARD • CENTRAL CAMPUS</div>
    <div style="font-size: 13px; font-weight: 900; text-transform: uppercase;">SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL</div>
    <div style="font-size: 8.5px; color: #52525b;">OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (50 SESSIONS)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 70px;">Date</th>
        <th style="width: 75px;">Slot</th>
        <th style="width: 80px;">Class/Batch</th>
        <th>Subject & Practical Experiment</th>
        <th>Topic Learned</th>
        <th style="width: 100px;">Subject Teacher</th>
        <th style="width: 60px; text-align: center;">Attendance</th>
        <th style="width: 50px; text-align: center;">Status</th>
        <th style="width: 120px;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${mock50Practical.map(r => `
        <tr>
          <td style="font-family: monospace;">${r.date}</td>
          <td style="font-family: monospace;">${r.period_label}</td>
          <td><strong>${r.batch_group}</strong></td>
          <td><strong>${r.subject_name}</strong><br><span style="color: #4b5563;">${r.practical_title}</span></td>
          <td style="font-style: italic;">${r.topic_learned || '—'}</td>
          <td>${r.profiles.full_name}</td>
          <td style="text-align: center; font-family: monospace;"><strong>${r.present_students}</strong>/${r.total_students}</td>
          <td style="text-align: center;"><span style="font-weight: bold; text-transform: uppercase;">${r.status}</span></td>
          <td>${r.remarks || r.skip_reason || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="sig-box">
    <div><div class="sig-line">SUBJECT TEACHER</div></div>
    <div><div class="sig-line">LAB IN-CHARGE</div></div>
  </div>
</body>
</html>`;
}

fs.writeFileSync('scratch/benchmark/records_50_before.html', getHtml(false));
execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\benchmark\\records_50_before.pdf', 'D:\\Projects\\LMR\\scratch\\benchmark\\records_50_before.html']);
const pdfBefore = fs.readFileSync('D:\\Projects\\LMR\\scratch\\benchmark\\records_50_before.pdf', 'utf8');
const pagesBefore = (pdfBefore.match(/\/MediaBox/g) || []).length;

fs.writeFileSync('scratch/benchmark/records_50_after.html', getHtml(true));
execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\benchmark\\records_50_after.pdf', 'D:\\Projects\\LMR\\scratch\\benchmark\\records_50_after.html']);
const pdfAfter = fs.readFileSync('D:\\Projects\\LMR\\scratch\\benchmark\\records_50_after.pdf', 'utf8');
const pagesAfter = (pdfAfter.match(/\/MediaBox/g) || []).length;

console.log(`50 Practical Records BEFORE: ${pagesBefore} pages (${(50 / pagesBefore).toFixed(1)} rows/page)`);
console.log(`50 Practical Records AFTER: ${pagesAfter} pages (${(50 / pagesAfter).toFixed(1)} rows/page)`);
