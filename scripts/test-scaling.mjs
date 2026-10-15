import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function testCount(count) {
  const rows = Array.from({ length: count }, (_, i) => `
    <tr>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">2026-03-01</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Period 1</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Class 11</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Physics Lab - Vernier Caliper</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Topic ${i}</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Teacher</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">38/40</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Done</td>
      <td style="padding: 4px 6px; border: 1px solid #d1d5db;">Remarks</td>
    </tr>
  `).join('');

  const rowsDense = Array.from({ length: count }, (_, i) => `
    <tr>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">2026-03-01</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Period 1</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Class 11</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Physics Lab - Vernier Caliper</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Topic ${i}</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Teacher</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">38/40</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Done</td>
      <td style="padding: 2.5px 5px; border: 1px solid #d1d5db; line-height: 1.15; font-size: 8pt;">Remarks</td>
    </tr>
  `).join('');

  const htmlBefore = `<!DOCTYPE html><html><head><style>@page { size: A4 landscape; margin: 8mm 10mm; } body { font-family: sans-serif; margin: 0; } table { width: 100%; border-collapse: collapse; font-size: 9.5px; } thead { display: table-header-group; } tr { break-inside: avoid; }</style></head><body><div style="height: 70px; border-bottom: 2px solid black;">HEADER</div><table><thead><tr><th>Date</th><th>Slot</th><th>Class</th><th>Subject</th><th>Topic</th><th>Teacher</th><th>Att</th><th>Status</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table><div style="height: 50px;">SIGS</div></body></html>`;

  const htmlAfter = `<!DOCTYPE html><html><head><style>@page { size: A4 landscape; margin: 6mm 8mm; } body { font-family: sans-serif; margin: 0; } table { width: 100%; border-collapse: collapse; font-size: 8.5pt; } thead { display: table-header-group; } tr { break-inside: avoid; }</style></head><body><div style="height: 70px; border-bottom: 2px solid black;">HEADER</div><table><thead><tr><th style="padding: 2.5px 5px; font-size: 8pt;">Date</th><th style="padding: 2.5px 5px; font-size: 8pt;">Slot</th><th style="padding: 2.5px 5px; font-size: 8pt;">Class</th><th style="padding: 2.5px 5px; font-size: 8pt;">Subject</th><th style="padding: 2.5px 5px; font-size: 8pt;">Topic</th><th style="padding: 2.5px 5px; font-size: 8pt;">Teacher</th><th style="padding: 2.5px 5px; font-size: 8pt;">Att</th><th style="padding: 2.5px 5px; font-size: 8pt;">Status</th><th style="padding: 2.5px 5px; font-size: 8pt;">Remarks</th></tr></thead><tbody>${rowsDense}</tbody></table><div style="height: 50px;">SIGS</div></body></html>`;

  fs.writeFileSync('scratch/test_b.html', htmlBefore);
  fs.writeFileSync('scratch/test_a.html', htmlAfter);
  execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\test_b.pdf', 'D:\\Projects\\LMR\\scratch\\test_b.html']);
  execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\test_a.pdf', 'D:\\Projects\\LMR\\scratch\\test_a.html']);
  const pB = (fs.readFileSync('scratch/test_b.pdf', 'utf8').match(/\/MediaBox/g) || []).length;
  const pA = (fs.readFileSync('scratch/test_a.pdf', 'utf8').match(/\/MediaBox/g) || []).length;
  console.log(`Count ${count} -> BEFORE: ${pB} pages (${(count/pB).toFixed(1)} rows/p), AFTER: ${pA} pages (${(count/pA).toFixed(1)} rows/p)`);
}

testCount(40);
testCount(60);
testCount(75);
testCount(100);
