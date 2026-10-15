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
  // 1. Supabase session cookie
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

  await getDebuggerUrl();
  console.log('Edge headless ready');

  async function captureRoute(testName, path) {
    console.log(`\n--- Testing ${testName}: ${path} ---`);
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000${path}`, { method: 'PUT' });
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

    await send('Network.enable');
    await send('Network.setCookie', {
      name: cookieName,
      value: cookieVal,
      domain: 'localhost',
      path: '/'
    });

    await send('Page.enable');
    await send('Page.navigate', { url: `http://localhost:3000${path}` });
    await sleep(4000);

    // Get table columns on screen
    const screenCols = await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('table thead tr th')).map(th => th.innerText.trim())`,
      returnByValue: true
    });
    console.log(`[${testName}] Screen Columns (${screenCols.result.value.length}):`, screenCols.result.value);

    // Screen screenshot
    const screenShot = await send('Page.captureScreenshot', { format: 'png' });
    const screenPath = `D:\\Projects\\LMR\\scratch\\${testName}_screen.png`;
    fs.writeFileSync(screenPath, Buffer.from(screenShot.data, 'base64'));
    console.log(`[${testName}] Saved screen capture to ${screenPath}`);

    // Emulate print media
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(500);

    // Get table columns in print media
    const printCols = await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('table thead tr th')).map(th => th.innerText.trim())`,
      returnByValue: true
    });
    console.log(`[${testName}] Print Columns (${printCols.result.value.length}):`, printCols.result.value);

    // Print screenshot
    const printShot = await send('Page.captureScreenshot', { format: 'png' });
    const printPath = `D:\\Projects\\LMR\\scratch\\${testName}_print.png`;
    fs.writeFileSync(printPath, Buffer.from(printShot.data, 'base64'));
    console.log(`[${testName}] Saved print capture to ${printPath}`);

    // Clean up
    await send('Page.close');
    ws.close();

    return {
      screenCols: screenCols.result.value,
      printCols: printCols.result.value,
      screenPath,
      printPath,
    };
  }

  // Test 1: Full columns (Default)
  const fullResult = await captureRoute('full_columns', '/print/records');

  // Test 2: Toggled columns (Remarks excluded via Columns dropdown)
  const toggledResult = await captureRoute(
    'toggled_no_remarks',
    '/print/records?cols=date,period,facility,class_batch,subject,experiment,teacher,attendance,status'
  );

  edge.kill();

  console.log('\n================ VERIFICATION SUMMARY ================');
  console.log('1. Full Columns Test:');
  console.log('   Screen cols count:', fullResult.screenCols.length, 'Has Remarks:', fullResult.screenCols.includes('VERIFICATION REMARKS'));
  console.log('   Print cols count:', fullResult.printCols.length, 'Has Remarks:', fullResult.printCols.includes('VERIFICATION REMARKS'));
  console.log('2. Toggled Column Off Test (Remarks Excluded):');
  console.log('   Screen cols count:', toggledResult.screenCols.length, 'Has Remarks:', toggledResult.screenCols.includes('VERIFICATION REMARKS'));
  console.log('   Print cols count:', toggledResult.printCols.length, 'Has Remarks:', toggledResult.printCols.includes('VERIFICATION REMARKS'));

  const parity1 = JSON.stringify(fullResult.screenCols) === JSON.stringify(fullResult.printCols);
  const parity2 = JSON.stringify(toggledResult.screenCols) === JSON.stringify(toggledResult.printCols);
  console.log('\nColumn Parity Full:', parity1 ? 'PASS (IDENTICAL)' : 'FAIL');
  console.log('Column Parity Toggled:', parity2 ? 'PASS (IDENTICAL)' : 'FAIL');

  process.exit(parity1 && parity2 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });
