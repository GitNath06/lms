import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
let dbUrl = '';
for (const line of env.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    dbUrl = line.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Replicate computeStructuredDiff
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'new_password',
  'password_hash',
  'token',
  'secret',
  'smtp_password',
  'api_key',
  'otp',
  'access_token',
  'refresh_token',
];

function isSensitiveKey(key) {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function redactSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    return obj.map((item) => (typeof item === 'object' && item !== null ? redactSensitiveData(item) : item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = redactSensitiveData(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? redactSensitiveData(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function computeStructuredDiff(before, after) {
  if (!before && !after) return null;

  const cleanBefore = redactSensitiveData(before);
  const cleanAfter = redactSensitiveData(after);

  if (cleanBefore && cleanAfter) {
    const allKeys = Array.from(new Set([...Object.keys(cleanBefore), ...Object.keys(cleanAfter)]));

    const changedBefore = {};
    const changedAfter = {};

    for (const key of allKeys) {
      const bRaw = cleanBefore[key];
      const aRaw = cleanAfter[key];

      const bVal = bRaw !== undefined ? bRaw : null;
      const aVal = aRaw !== undefined ? aRaw : null;

      const bNorm =
        typeof bVal === 'number' || typeof bVal === 'boolean'
          ? String(bVal)
          : typeof bVal === 'string'
          ? bVal.trim()
          : bVal;
      const aNorm =
        typeof aVal === 'number' || typeof aVal === 'boolean'
          ? String(aVal)
          : typeof aVal === 'string'
          ? aVal.trim()
          : aVal;

      if (JSON.stringify(bNorm) !== JSON.stringify(aNorm)) {
        changedBefore[key] = bVal;
        changedAfter[key] = aVal;
      }
    }

    if (Object.keys(changedBefore).length === 0) {
      console.warn('[AUDIT ENGINE] No delta detected between before and after objects:', {
        before: cleanBefore,
        after: cleanAfter,
      });
      for (const [k, v] of Object.entries(cleanAfter)) {
        if (k !== 'updated_at' && k !== 'created_at') {
          changedBefore[k] = cleanBefore[k] !== undefined ? cleanBefore[k] : null;
          changedAfter[k] = v;
        }
      }
    }

    return { before: changedBefore, after: changedAfter };
  }

  const single = cleanBefore ? { before: cleanBefore } : cleanAfter ? { after: cleanAfter } : null;
  return single;
}

async function testLabUpdate() {
  console.log('Testing Lab UPDATE in Postgres...');
  // 1. Fetch Chem lab
  const prevRes = await pool.query("SELECT * FROM public.labs WHERE id = 'chem'");
  const beforeLab = prevRes.rows[0];
  console.log('Before Lab capacity:', beforeLab.capacity);

  // New capacity: 55
  const newCapacity = beforeLab.capacity === 50 ? 55 : 50;
  const updateRes = await pool.query(
    "UPDATE public.labs SET capacity = $1 WHERE id = 'chem' RETURNING *",
    [newCapacity]
  );
  const afterLab = updateRes.rows[0];
  console.log('After Lab capacity:', afterLab.capacity);

  const diff = computeStructuredDiff(beforeLab, afterLab);
  console.log('Diff result:', diff);

  // Insert into audit_logs
  const auditRes = await pool.query(
    `
    INSERT INTO public.audit_logs (
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      entity_label,
      changes,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
    `,
    [
      '1cb09b62-8dd2-445f-b5ae-a186df967cf5',
      'System Administrator',
      'super_admin',
      'UPDATE',
      'lab',
      'chem',
      afterLab.name,
      JSON.stringify(diff),
      JSON.stringify({ operation: 'test_lab_update' }),
    ]
  );
  console.log('Inserted Audit Log for UPDATE:', auditRes.rows[0].id, auditRes.rows[0].changes);

  // Revert capacity back
  await pool.query("UPDATE public.labs SET capacity = $1 WHERE id = 'chem'", [beforeLab.capacity]);
  console.log('Reverted lab capacity.');
}

testLabUpdate()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
  });
