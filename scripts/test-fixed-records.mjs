import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let html = fs.readFileSync('scratch/live_records.html', 'utf8');

const fixedCss = `
<style>
  @page {
    size: A4 landscape;
    margin: 6mm 8mm;
  }
  @media print {
    html, body {
      height: auto !important;
      overflow: visible !important;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .h-screen, main, [class*='overflow-'] {
      height: auto !important;
      overflow: visible !important;
    }
  }
</style>
`;

html = html.replace('</head>', fixedCss + '</head>');
fs.writeFileSync('scratch/live_records_fixed.html', html);

execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\live_records_fixed.pdf', 'D:\\Projects\\LMR\\scratch\\live_records_fixed.html']);

const pdf = fs.readFileSync('D:\\Projects\\LMR\\scratch\\live_records_fixed.pdf', 'utf8');
const mediaBoxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
console.log('Total Pages:', mediaBoxes.length);
mediaBoxes.forEach((m, idx) => {
  const w = parseFloat(m[3]) - parseFloat(m[1]);
  const h = parseFloat(m[4]) - parseFloat(m[2]);
  const isLandscape = w > h;
  console.log(`  Page ${idx + 1}: w=${w.toFixed(1)}pt (${(w * 25.4 / 72).toFixed(1)}mm), h=${h.toFixed(1)}pt (${(h * 25.4 / 72).toFixed(1)}mm) -> ${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}`);
});
