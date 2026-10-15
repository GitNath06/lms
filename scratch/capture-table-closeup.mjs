import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const USER_DATA_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\scratch\\edge-profile';
const BASE_OUTPUT = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  await sleep(1500);

  try {
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/records`, { method: 'PUT' });
  const pageData = await newPageRes.json();
  const ws = new WebSocket(pageData.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

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
  await sleep(2000);

  // Set dark theme
  await evaluate(`
    (() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    })()
  `);
  await sleep(1000);

  // Get table rect
  const clip = await evaluate(`
    (() => {
      const tableWrapper = document.querySelector('.rounded-2xl.border');
      if (!tableWrapper) return null;
      const rect = tableWrapper.getBoundingClientRect();
      return {
        x: Math.max(0, rect.x - 10),
        y: Math.max(0, rect.y - 10),
        width: rect.width + 20,
        height: rect.height + 20,
        scale: 1
      };
    })()
  `);

  console.log('Clip rect:', clip);
  if (clip) {
    const shot = await send('Page.captureScreenshot', { format: 'png', clip });
    fs.writeFileSync(path.join(BASE_OUTPUT, 'practical_table_close_up.png'), Buffer.from(shot.data, 'base64'));
    console.log('Saved practical_table_close_up.png');
  }

  await fetch(`http://127.0.0.1:${PORT}/json/close/${pageData.id}`);
  ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(console.error);
