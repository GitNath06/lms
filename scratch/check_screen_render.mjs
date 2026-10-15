import fs from 'fs';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = new URL(url).hostname.split('.')[0];
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345'
  });
  if (error) { console.error(error); process.exit(1); }
  const session = data.session;
  const cookieVal = encodeURIComponent(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  }));
  const cookieHeader = 'sb-' + projectRef + '-auth-token=' + cookieVal;
  
  const res = await fetch('http://localhost:3000/print/records', {
    headers: { 'Cookie': cookieHeader }
  });
  const html = await res.text();
  const htmlWithBase = html.replace('<head>', '<head><base href="http://localhost:3000/">');
  const absHtml = 'D:\\Projects\\LMR\\scratch\\test_preview_full.html';
  const absPng = 'D:\\Projects\\LMR\\scratch\\test_preview_full.png';
  fs.writeFileSync(absHtml, htmlWithBase);

  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--window-size=1400,1000',
    `--screenshot=${absPng}`,
    absHtml
  ]);
  console.log('Saved ' + absPng);
}
run();
