import { spawn } from 'child_process';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const USER_DATA_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\scratch\\edge-profile';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await sleep(500);
  }
  throw new Error('Could not connect to Edge DevTools');
}

async function run() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,1050',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  try {
    const wsUrl = await getDebuggerUrl();
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/login`, { method: 'PUT' });
    const pageData = await newPageRes.json();

    const ws = new WebSocket(pageData.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.onopen = resolve);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const currentId = id++;
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === currentId) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: currentId, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    }

    await send('Page.enable');
    await send('Runtime.enable');

    console.log('Waiting for login...');
    await sleep(2500);

    // Click demo card
    console.log('Selecting demo account...');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Super Admin'));
        if (btn) btn.click();
      })()
    `);
    await sleep(500);

    // Click submit button
    console.log('Clicking sign in...');
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign In to'));
        if (btn) btn.click();
      })()
    `);
    await sleep(3500);

    const currentUrl = await evaluate('window.location.href');
    console.log('Current URL after login:', currentUrl);

    // Navigate to /admin
    await send('Page.navigate', { url: 'http://localhost:3000/admin' });
    await sleep(3500);

    const adminUrl = await evaluate('window.location.href');
    console.log('Current URL after /admin navigation:', adminUrl);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\admin_test_logged_in.png', Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved!');

    await fetch(`http://127.0.0.1:${PORT}/json/close/${pageData.id}`);
    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(console.error);
