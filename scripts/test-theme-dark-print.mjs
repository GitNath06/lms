import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let html = fs.readFileSync('scratch/live_records.html', 'utf8');

// Force dark class on <html>
html = html.replace('<html', '<html class="dark"');

// Save dark version without explicit print light-mode forcing
fs.writeFileSync('scratch/live_records_dark_unforced.html', html);

execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\live_records_dark_unforced.pdf', 'D:\\Projects\\LMR\\scratch\\live_records_dark_unforced.html']);

console.log('Generated live_records_dark_unforced.pdf');
