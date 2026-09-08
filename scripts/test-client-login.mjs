import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadEnv('.env.local');
loadEnv('.env');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const testUsers = [
  { email: 'admin@rrl.edu.np', pass: 'Admin@12345' },
  { email: 'incharge@rrl.edu.np', pass: 'Incharge@12345' },
  { email: 'hod@rrl.edu.np', pass: 'Hod@12345' },
  { email: 'p.adhikari@rrl.edu.np', pass: 'Teacher@12345' },
  { email: 'a.karki@rrl.edu.np', pass: 'Teacher@12345' },
  { email: 'teacher@rrl.edu.np', pass: 'Teacher@12345' },
];

async function check() {
  for (const user of testUsers) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.pass,
    });
    if (error) {
      console.error(`❌ FAILED ${user.email}:`, error.message);
    } else {
      console.log(`✅ SUCCESS ${user.email} (UID: ${data.user?.id})`);
    }
  }
}

check();
