import { spawn } from 'child_process';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const USER_DATA_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\scratch\\edge-profile';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('Could not connect to Edge');
}

async function run() {
  // 1. Get Supabase session cookie
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const projectRef = new URL(url).hostname.split('.')[0];
  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@rrl.edu.np',
    password: 'Admin@12345'
  });
  if (error) { console.error('Login error:', error); process.exit(1); }
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

  // 2. Launch Edge
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  const browserWsUrl = await getDebuggerUrl();
  console.log('Edge started');

  // Open page
  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/print/records`, { method: 'PUT' });
  const pageData = await newPageRes.json();
  const ws = new WebSocket(pageData.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(msg.error);
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  // Set auth cookie
  await send('Network.enable');
  await send('Network.setCookie', {
    name: cookieName,
    value: cookieVal,
    domain: 'localhost',
    path: '/'
  });

  // Reload with cookie
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:3000/print/records' });
  await sleep(3500);

  // Check columns present in DOM
  const evalRes = await send('Runtime.evaluate', {
    expression: `
      Array.from(document.querySelectorAll('table th')).map(th => th.innerText.trim())
    `,
    returnByValue: true
  });
  console.log('Columns in DOM on /print/records:', evalRes.result.value);

  // 1. Capture screen view
  const screenShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('D:\\Projects\\LMR\\scratch\\screen_preview.png', Buffer.from(screenShot.data, 'base64'));
  console.log('Saved screen_preview.png');

  // 2. Emulate print media
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(500);
  const printShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('D:\\Projects\\LMR\\scratch\\print_preview.png', Buffer.from(printShot.data, 'base64'));
  console.log('Saved print_preview.png');

  // Close tab
  await send('Page.close');
  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
