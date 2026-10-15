import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

function loadDbUrl() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return null
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('DATABASE_URL=')) {
      return trimmed.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return null
}

const dbUrl = loadDbUrl()
if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function dumpSchema() {
  const client = await pool.connect()
  try {
    const out = []

    out.push('-- ==============================================================================')
    out.push('-- LabSync LIMS / LMR — Institutional Laboratory Management System')
    out.push('-- Complete Live PostgreSQL Schema Dump (public schema)')
    out.push(`-- Generated: ${new Date().toISOString()}`)
    out.push('-- ==============================================================================\n')

    // 1. EXTENSIONS
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 1. EXTENSIONS')
    out.push('-- ------------------------------------------------------------------------------')
    const extRes = await client.query(`
      SELECT extname FROM pg_extension
      WHERE extname NOT IN ('plpgsql');
    `)
    for (const r of extRes.rows) {
      out.push(`CREATE EXTENSION IF NOT EXISTS "${r.extname}";`)
    }
    out.push('')

    // 2. ENUMS
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 2. CUSTOM ENUM TYPES')
    out.push('-- ------------------------------------------------------------------------------')
    const enumRes = await client.query(`
      SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname;
    `)
    for (const r of enumRes.rows) {
      const rawVals = Array.isArray(r.enum_values)
        ? r.enum_values
        : String(r.enum_values || '').replace(/^\{|\}$/g, '').split(',')
      const vals = rawVals.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')
      out.push(`DO $$ BEGIN`)
      out.push(`  CREATE TYPE public.${r.typname} AS ENUM (${vals});`)
      out.push(`EXCEPTION WHEN duplicate_object THEN NULL;`)
      out.push(`END $$;\n`)
    }

    // 3. TABLES & COLUMNS
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 3. TABLES & COLUMNS')
    out.push('-- ------------------------------------------------------------------------------')
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `)

    for (const t of tablesRes.rows) {
      const tableName = t.table_name
      out.push(`-- Table: public.${tableName}`)
      out.push(`CREATE TABLE IF NOT EXISTS public.${tableName} (`)

      const colRes = await client.query(`
        SELECT 
          column_name,
          data_type,
          udt_name,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName])

      const colDefs = []
      for (const col of colRes.rows) {
        let typeStr = col.data_type
        if (typeStr === 'USER-DEFINED') {
          typeStr = `public.${col.udt_name}`
        } else if (typeStr === 'ARRAY') {
          typeStr = `${col.udt_name.replace(/^_/, '')}[]`
        } else if (col.character_maximum_length) {
          typeStr = `${typeStr}(${col.character_maximum_length})`
        }

        let def = `  ${col.column_name} ${typeStr}`
        if (col.column_default !== null) {
          def += ` DEFAULT ${col.column_default}`
        }
        if (col.is_nullable === 'NO') {
          def += ` NOT NULL`
        }
        colDefs.push(def)
      }

      out.push(colDefs.join(',\n'))
      out.push(`);\n`)
    }

    // 4. CONSTRAINTS (PK, FK, UNIQUE, CHECK)
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 4. CONSTRAINTS & INTEGRITY RULES')
    out.push('-- ------------------------------------------------------------------------------')
    const constRes = await client.query(`
      SELECT
        conrelid::regclass::text as table_name,
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(c.oid, true) as definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      ORDER BY 
        CASE contype
          WHEN 'p' THEN 1
          WHEN 'u' THEN 2
          WHEN 'c' THEN 3
          WHEN 'f' THEN 4
          ELSE 5
        END,
        conrelid::regclass::text,
        conname;
    `)

    for (const c of constRes.rows) {
      out.push(`-- ${c.constraint_name} ON ${c.table_name}`)
      out.push(`DO $$ BEGIN`)
      out.push(`  ALTER TABLE ${c.table_name} ADD CONSTRAINT ${c.constraint_name} ${c.definition};`)
      out.push(`EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;`)
      out.push(`END $$;\n`)
    }

    // 5. INDEXES
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 5. INDEXES')
    out.push('-- ------------------------------------------------------------------------------')
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace)
      ORDER BY tablename, indexname;
    `)
    for (const idx of idxRes.rows) {
      out.push(`${idx.indexdef};`)
    }
    out.push('')

    // 6. FUNCTIONS & STORED PROCEDURES
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 6. STORED PROCEDURES & DATABASE FUNCTIONS')
    out.push('-- ------------------------------------------------------------------------------')
    const funcRes = await client.query(`
      SELECT 
        p.proname,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      ORDER BY p.proname;
    `)
    for (const f of funcRes.rows) {
      out.push(`-- Function: public.${f.proname}`)
      out.push(`${f.definition};\n`)
    }

    // 7. TRIGGERS
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 7. TRIGGERS')
    out.push('-- ------------------------------------------------------------------------------')
    const trigRes = await client.query(`
      SELECT 
        event_object_table,
        trigger_name,
        action_statement,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `)
    for (const tr of trigRes.rows) {
      out.push(`-- Trigger: ${tr.trigger_name} on public.${tr.event_object_table}`)
      out.push(`DROP TRIGGER IF EXISTS ${tr.trigger_name} ON public.${tr.event_object_table};`)
      out.push(`CREATE TRIGGER ${tr.trigger_name} ${tr.action_timing} ${tr.event_manipulation} ON public.${tr.event_object_table} FOR EACH ROW ${tr.action_statement};\n`)
    }

    // 8. ROW LEVEL SECURITY (RLS) POLICIES
    out.push('-- ------------------------------------------------------------------------------')
    out.push('-- 8. ROW LEVEL SECURITY & POLICIES')
    out.push('-- ------------------------------------------------------------------------------')
    for (const t of tablesRes.rows) {
      out.push(`ALTER TABLE public.${t.table_name} ENABLE ROW LEVEL SECURITY;`)
    }
    out.push('')

    const polRes = await client.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `)
    for (const pol of polRes.rows) {
      const roles = Array.isArray(pol.roles) ? pol.roles.join(', ') : 'public'
      let polSql = `CREATE POLICY "${pol.policyname}" ON public.${pol.tablename}`
      polSql += ` AS ${pol.permissive}`
      polSql += ` FOR ${pol.cmd}`
      polSql += ` TO ${roles}`
      if (pol.qual) {
        polSql += ` USING (${pol.qual})`
      }
      if (pol.with_check) {
        polSql += ` WITH CHECK (${pol.with_check})`
      }
      polSql += ';'

      out.push(`-- Policy: "${pol.policyname}" on ${pol.tablename}`)
      out.push(`DO $$ BEGIN`)
      out.push(`  ${polSql}`)
      out.push(`EXCEPTION WHEN duplicate_object THEN NULL;`)
      out.push(`END $$;\n`)
    }

    const finalSql = out.join('\n')

    // Write to root schema.sql
    fs.writeFileSync(path.resolve(process.cwd(), 'schema.sql'), finalSql, 'utf8')
    // Also update supabase/schema.sql for institutional repo consistency
    fs.writeFileSync(path.resolve(process.cwd(), 'supabase', 'schema.sql'), finalSql, 'utf8')

    console.log(`Successfully generated schema.sql (${Buffer.byteLength(finalSql)} bytes)`)
  } finally {
    client.release()
    await pool.end()
  }
}

dumpSchema().catch(err => {
  console.error('Failed to dump schema:', err)
  process.exit(1)
})
