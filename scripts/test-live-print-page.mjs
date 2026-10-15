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
  if (error) {
    console.error('Supabase login failed:', error);
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

  const routes = [
    { name: 'records', path: '/print/records' },
    { name: 'incidents', path: '/print/incidents' },
    { name: 'maintenance', path: '/maintenance' } // note: print view is on /maintenance print action or /print/maintenance
  ];

  for (const route of routes) {
    console.log(`\nFetching ${route.path}...`);
    const res = await fetch(`http://localhost:3001${route.path}`, {
      headers: { 'Cookie': cookieHeader },
      redirect: 'manual'
    });
    console.log(`Status: ${res.status}`);
    const html = await res.text();
    
    // Check whether the HTML contains @page or style tags
    const hasPageRule = html.includes('@page');
    console.log(`Contains '@page' in raw HTML: ${hasPageRule}`);
    
    // Save HTML
    const htmlFile = `D:\\Projects\\LMR\\scratch\\live_${route.name}.html`;
    const pdfFile = `D:\\Projects\\LMR\\scratch\\live_${route.name}.pdf`;
    
    // In order for headless chrome to load external assets, inject <base href="http://localhost:3001/">
    const htmlWithBase = html.replace('<head>', '<head><base href="http://localhost:3001/">');
    fs.writeFileSync(htmlFile, htmlWithBase);

    try {
      execFileSync(chrome, ['--headless', '--disable-gpu', `--print-to-pdf=${pdfFile}`, htmlFile]);
      const pdf = fs.readFileSync(pdfFile, 'utf8');
      const mediaBoxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
      console.log(`Total Pages: ${mediaBoxes.length}`);
      mediaBoxes.forEach((m, idx) => {
        const w = parseFloat(m[3]) - parseFloat(m[1]);
        const h = parseFloat(m[4]) - parseFloat(m[2]);
        const isLandscape = w > h;
        console.log(`  Page ${idx + 1}: w=${w.toFixed(1)}pt (${(w * 25.4 / 72).toFixed(1)}mm), h=${h.toFixed(1)}pt (${(h * 25.4 / 72).toFixed(1)}mm) -> ${isLandscape ? 'LANDSCAPE' : 'PORTRAIT'}`);
      });
    } catch (err) {
      console.error(`Chrome print failed for ${route.name}:`, err.message);
    }
  }
}

run();
