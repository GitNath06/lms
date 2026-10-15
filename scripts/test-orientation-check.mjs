import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const tests = [
  { name: 'current_a4_landscape', css: '@page { size: A4 landscape; margin: 8mm 10mm; }' },
  { name: 'just_landscape', css: '@page { size: landscape; margin: 8mm 10mm; }' },
  { name: 'trimmed_a4_landscape', css: '@page { size: A4 landscape; margin: 6mm 8mm; }' },
  { name: 'dimensions_297_210', css: '@page { size: 297mm 210mm; margin: 6mm 8mm; }' },
  { name: 'wrapped_in_h_screen', css: '@page { size: A4 landscape; margin: 8mm 10mm; }', bodyWrapper: true }
];

fs.mkdirSync('scratch', { recursive: true });

for (const t of tests) {
  let bodyContent = '<h1>Test ' + t.name + '</h1><p>Testing print orientation</p>';
  if (t.bodyWrapper) {
    bodyContent = '<div style="height: 100vh; overflow: hidden;"><div style="overflow-y: auto; height: 100%;">' + bodyContent + '</div></div>';
  }
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${t.css}
body { font-family: sans-serif; margin: 0; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  const htmlPath = 'D:\\Projects\\LMR\\scratch\\' + t.name + '.html';
  const pdfPath = 'D:\\Projects\\LMR\\scratch\\' + t.name + '.pdf';
  fs.writeFileSync(htmlPath, html);
  
  try {
    execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=' + pdfPath, htmlPath]);
    const pdf = fs.readFileSync(pdfPath, 'utf8');
    const m = [...pdf.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)][0];
    if (m) {
      const w = parseFloat(m[3]) - parseFloat(m[1]);
      const h = parseFloat(m[4]) - parseFloat(m[2]);
      const isLandscape = w > h;
      console.log(`${t.name}: w=${w.toFixed(1)}pt (${(w * 25.4 / 72).toFixed(1)}mm), h=${h.toFixed(1)}pt (${(h * 25.4 / 72).toFixed(1)}mm) -> ${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}`);
    }
  } catch (e) {
    console.error(t.name, 'failed:', e.message);
  }
}
