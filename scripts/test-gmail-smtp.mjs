import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.trim().replace(/\s+/g, '');

console.log('Testing Gmail SMTP Connection with user:', user);

if (!user || !pass) {
  console.error('❌ Missing GMAIL_USER or GMAIL_APP_PASSWORD');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user,
    pass,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Gmail SMTP Verification Failed:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Gmail SMTP Server is ready to deliver real institutional OTP emails!');
    process.exit(0);
  }
});
