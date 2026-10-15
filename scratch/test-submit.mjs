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
    const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000/login?redirect=/admin`, { method: 'PUT' });
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
    await sleep(2500);

    // Set React inputs properly
    console.log('Filling inputs via React setter...');
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
      })()
    `);
    await sleep(500);

    // Submit form
    console.log('Submitting form...');
    await evaluate(`
      (() => {
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      })()
    `);

    // Poll URL
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const url = await evaluate('window.location.href');
      console.log(`[t=${i}s] URL: ${url}`);
      if (url.includes('/admin') && !url.includes('/login')) {
        console.log('Successfully arrived at /admin!');
        break;
      }
    }

    await sleep(2000);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\admin_submit_result.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved admin_submit_result.png');

    await fetch(`http://127.0.0.1:${PORT}/json/close/${pageData.id}`);
    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(console.error);
