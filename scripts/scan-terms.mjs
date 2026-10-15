import fs from 'fs';
import path from 'path';

const targetDirs = ['components', 'app', 'lib', 'types'];
targetDirs.forEach(dir => {
  function scan(d) {
    fs.readdirSync(d).forEach(f => {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) scan(p);
      else if (/\.(tsx?|jsx?)$/.test(f)) {
        const text = fs.readFileSync(p, 'utf8');
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          if (/\b(batch|batches)\b/i.test(line)) {
            // Check if it's user-facing text, label, title, or comment
            if (/(['">`]|label|title|header|placeholder)[^'"`]*\b(batch|batches)\b/i.test(line)) {
              console.log('[BATCH]', p, idx + 1, line.trim());
            }
          }
          if (/recess/i.test(line)) {
            console.log('[RECESS]', p, idx + 1, line.trim());
          }
        });
      }
    });
  }
  scan(dir);
});
