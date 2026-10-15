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
    '--window-size=1440,1050',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  try {
    const wsUrl = await getDebuggerUrl();
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/login?redirect=/records`, { method: 'PUT' });
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
    await sleep(2000);

    // Check if on login
    let url = await evaluate('window.location.href');
    if (url && url.includes('/login')) {
      console.log('Logging in as Super Admin...');
      await evaluate(`
        (() => {
          function setNativeValue(element, value) {
            const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
            const prototype = Object.getPrototypeOf(element);
            const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
            if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
              prototypeValueSetter.call(element, value);
            } else if (valueSetter) {
              valueSetter.call(element, value);
            } else {
              element.value = value;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const emailInput = document.querySelector('input[name="email"]');
          const passInput = document.querySelector('input[name="password"]');
          if (emailInput && passInput) {
            setNativeValue(emailInput, 'admin@rrl.edu.np');
            setNativeValue(passInput, 'Admin@12345');
          }
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        })()
      `);
      await sleep(3500);
    }

    async function capture(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const fullPath = path.join(BASE_OUTPUT, filename);
      fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
      console.log('Saved:', filename);
    }

    async function waitForLoaded() {
      await sleep(1500);
      for (let i = 0; i < 40; i++) {
        const hasSpinner = await evaluate(`Boolean(document.querySelector('.animate-spin'))`);
        const hasTable = await evaluate(`Boolean(document.querySelector('table tbody'))`);
        if (!hasSpinner && hasTable) {
          await sleep(800);
          return;
        }
        await sleep(400);
      }
    }

    // 1. Practical Records Table (Dark Mode)
    console.log('Navigating to /records (Dark Mode)...');
    await send('Page.navigate', { url: 'http://localhost:3000/records' });
    await sleep(2000);
    await evaluate(`
      (() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      })()
    `);
    await waitForLoaded();
    await evaluate(`
      (() => {
        const table = document.querySelector('table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `);
    await sleep(600);
    await capture('practical_records_parity_dark.png');

    // 2. Incident Records Table (Dark Mode)
    console.log('Navigating to /records/incidents (Dark Mode)...');
    await send('Page.navigate', { url: 'http://localhost:3000/records/incidents' });
    await sleep(2000);
    await evaluate(`
      (() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      })()
    `);
    await waitForLoaded();
    await capture('incident_records_parity_dark.png');

    // 3. Practical Records Table (Light Mode)
    console.log('Navigating to /records (Light Mode)...');
    await send('Page.navigate', { url: 'http://localhost:3000/records' });
    await sleep(2000);
    await evaluate(`
      (() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      })()
    `);
    await waitForLoaded();
    await evaluate(`
      (() => {
        const table = document.querySelector('table');
        if (table) table.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `);
    await sleep(600);
    await capture('practical_records_parity_light.png');

    // 4. Incident Records Table (Light Mode)
    console.log('Navigating to /records/incidents (Light Mode)...');
    await send('Page.navigate', { url: 'http://localhost:3000/records/incidents' });
    await sleep(2000);
    await evaluate(`
      (() => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      })()
    `);
    await waitForLoaded();
    await capture('incident_records_parity_light.png');

    console.log('All parity screenshots captured successfully!');
    await fetch(`http://127.0.0.1:${PORT}/json/close/${pageData.id}`);
    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(console.error);
