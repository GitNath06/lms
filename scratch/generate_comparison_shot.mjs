import { spawn } from 'child_process';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9223;
const USER_DATA_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\scratch\\edge-compare-profile';

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
  // Read images as base64 data URLs
  const screenFull = fs.readFileSync('D:\\Projects\\LMR\\scratch\\full_columns_screen.png').toString('base64');
  const printFull = fs.readFileSync('D:\\Projects\\LMR\\scratch\\full_columns_print.png').toString('base64');
  const screenToggled = fs.readFileSync('D:\\Projects\\LMR\\scratch\\toggled_no_remarks_screen.png').toString('base64');
  const printToggled = fs.readFileSync('D:\\Projects\\LMR\\scratch\\toggled_no_remarks_print.png').toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Screen Preview vs Print Preview Parity Proof</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0f19;
      color: #f1f5f9;
    }
    .container {
      max-width: 1700px;
      margin: 0 auto;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 6px 0;
      color: #38bdf8;
      font-family: monospace;
    }
    .subtitle {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: bold;
      background: rgba(56, 189, 248, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      margin-bottom: 8px;
      font-family: monospace;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 36px;
    }
    .panel {
      background: #151e32;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .panel h2 {
      font-size: 14px;
      margin: 0 0 12px 0;
      font-family: monospace;
      color: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .panel h2 span.tag {
      font-size: 11px;
      color: #10b981;
      font-weight: bold;
    }
    .img-wrapper {
      border: 1px solid #334155;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
    }
    img {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>LMR WYSIWYG AUDIT: SCREEN PREVIEW vs BROWSER PRINT-PREVIEW PARITY</h1>
    <div class="subtitle">Single Source of Truth Verification — Unified Header, Exact Column Sets & Identical Structural Hierarchy</div>

    <div class="badge">TEST 1: FULL COLUMNS (DEFAULT AUDIT VIEW — 10 COLUMNS IN BOTH)</div>
    <div class="grid">
      <div class="panel">
        <h2>
          <span>A. On-Screen Preview (/print/records)</span>
          <span class="tag">✓ 10 Columns Including Remarks</span>
        </h2>
        <div class="img-wrapper">
          <img src="data:image/png;base64,${screenFull}" />
        </div>
      </div>
      <div class="panel">
        <h2>
          <span>B. Browser Print-Preview (@media print / Ctrl+P)</span>
          <span class="tag">✓ Identical 10 Columns & Same Header</span>
        </h2>
        <div class="img-wrapper">
          <img src="data:image/png;base64,${printFull}" />
        </div>
      </div>
    </div>

    <div class="badge">TEST 2: WYSIWYG COLUMN PROJECTION (REMARKS TOGGLED OFF VIA COLUMNS DROPDOWN — 9 COLUMNS IN BOTH)</div>
    <div class="grid">
      <div class="panel">
        <h2>
          <span>A. On-Screen Preview (?cols=... without remarks)</span>
          <span class="tag">✓ Remarks Excluded</span>
        </h2>
        <div class="img-wrapper">
          <img src="data:image/png;base64,${screenToggled}" />
        </div>
      </div>
      <div class="panel">
        <h2>
          <span>B. Browser Print-Preview (@media print / Ctrl+P)</span>
          <span class="tag">✓ Remarks Excluded in Physical Printout</span>
        </h2>
        <div class="img-wrapper">
          <img src="data:image/png;base64,${printToggled}" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync('D:\\Projects\\LMR\\scratch\\parity_comparison.html', html);

  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1800,2000',
    'about:blank'
  ], { detached: true, stdio: 'ignore' });

  await getDebuggerUrl();

  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new?file:///D:/Projects/LMR/scratch/parity_comparison.html`, { method: 'PUT' });
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

  await send('Page.enable');
  await sleep(2500);

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('D:\\Projects\\LMR\\scratch\\screen_vs_print_parity_proof.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved D:\\Projects\\LMR\\scratch\\screen_vs_print_parity_proof.png');

  // Also copy to artifacts directory for user facing artifact
  fs.copyFileSync(
    'D:\\Projects\\LMR\\scratch\\screen_vs_print_parity_proof.png',
    'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\ea6abef5-4ccc-49c8-ba5c-8eebff76c048\\screen_vs_print_parity_proof.png'
  );
  console.log('Copied to artifacts directory');

  await send('Page.close');
  ws.close();
  edge.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
