import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

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
  console.log('Launching Edge headless...');
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

  try {
    const wsUrl = await getDebuggerUrl();
    console.log('Connected to debugger:', wsUrl);

    // Create a new target/page
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/admin`, { method: 'PUT' });
    const pageData = await newPageRes.json();
    console.log('Created page:', pageData.id);

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

    await send('Page.enable');
    await send('Network.enable');

    console.log('Waiting for page to load...');
    await sleep(3000);

    // Take a test screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outputPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\test_shot.png';
    fs.writeFileSync(outputPath, Buffer.from(shot.data, 'base64'));
    console.log('Screenshot successfully saved to:', outputPath);

    // Close page
    await fetch(`http://127.0.0.1:${PORT}/json/close/${pageData.id}`);
    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
