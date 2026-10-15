import fs from 'fs';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lttqolqgtyrvtxkkgmow.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

// Read .env.local if needed
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345'
  });
  if (error) {
    console.error('Login failed:', error);
    process.exit(1);
  }

  const session = data.session;
  const cookieVal = encodeURIComponent(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }));
  const cookieName = 'sb-' + projectRef + '-auth-token';
  const cookieHeader = cookieName + '=' + cookieVal;

  console.log('Fetching /print/records with session cookie...');
  const res = await fetch('http://localhost:3001/print/records', {
    headers: { 'Cookie': cookieHeader }
  });
  console.log('Status:', res.status);
  let html = await res.text();

  // Force dark class on html
  html = html.replace('<html', '<html class="dark"');
  // Inject base href so CSS loads
  html = html.replace('<head>', '<head><base href="http://localhost:3001/">');

  const htmlFile = 'D:\\Projects\\LMR\\scratch\\live_dark_records.html';
  const pngFile = 'D:\\Projects\\LMR\\scratch\\live_dark_records.png';
  const pdfFile = 'D:\\Projects\\LMR\\scratch\\live_dark_records.pdf';

  fs.writeFileSync(htmlFile, html);

  console.log('Capturing screenshot with Chrome headless...');
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--window-size=1400,900',
    `--screenshot=${pngFile}`,
    htmlFile
  ]);
  console.log('Screenshot saved to:', pngFile);

  console.log('Generating print PDF with Chrome headless...');
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    `--print-to-pdf=${pdfFile}`,
    htmlFile
  ]);
  console.log('PDF saved to:', pdfFile);
}

run().catch(console.error);
