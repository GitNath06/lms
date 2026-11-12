import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getPgPool } from '../lib/db.ts'

test('1. PWA Manifest & Brand Assets Verification', async (t) => {
  await t.test('manifest.ts exists and specifies standalone mode with obsidian theme', async () => {
    const manifestPath = path.resolve('app/manifest.ts')
    assert.ok(fs.existsSync(manifestPath), 'app/manifest.ts must exist')
    const content = fs.readFileSync(manifestPath, 'utf8')
    assert.match(content, /display:\s*['"]standalone['"]/, 'Must specify display: standalone')
    assert.match(content, /theme_color:\s*['"]#09090b['"]/, 'Must specify theme_color: #09090b')
    assert.match(content, /background_color:\s*['"]#09090b['"]/, 'Must specify background_color: #09090b')
    assert.match(content, /short_name:\s*['"]LabSync['"]/, 'Must specify short_name: LabSync')
  })

  await t.test('PWA icon assets exist on disk in public/icons/', () => {
    const iconNames = [
      'icon-192x192.png',
      'icon-512x512.png',
      'maskable-icon-512x512.png',
      'apple-touch-icon.png',
    ]

    for (const name of iconNames) {
      const p = path.resolve('public/icons', name)
      assert.ok(fs.existsSync(p), `Icon file ${name} must exist`)
      const stat = fs.statSync(p)
      assert.ok(stat.size > 500, `Icon file ${name} must not be empty (was ${stat.size} bytes)`)
    }
  })

  await t.test('offline fallback page public/offline.html exists', () => {
    const p = path.resolve('public/offline.html')
    assert.ok(fs.existsSync(p), 'public/offline.html must exist')
    const html = fs.readFileSync(p, 'utf8')
    assert.match(html, /Offline Mode Active/, 'Must include Offline Mode badge')
  })

  await t.test('proxy.ts allows unauthenticated public access to PWA assets and excludes them from matcher', () => {
    const p = path.resolve('proxy.ts')
    assert.ok(fs.existsSync(p), 'proxy.ts must exist')
    const proxyContent = fs.readFileSync(p, 'utf8')
    assert.match(proxyContent, /pathname === '\/manifest\.webmanifest'/, 'Must pass-through /manifest.webmanifest')
    assert.match(proxyContent, /pathname === '\/sw\.js'/, 'Must pass-through /sw.js')
    assert.match(proxyContent, /pathname === '\/offline\.html'/, 'Must pass-through /offline.html')
    assert.match(proxyContent, /pathname\.startsWith\('\/icons\/'\)/, 'Must pass-through /icons/')
    assert.match(proxyContent, /export const config\s*=\s*\{\s*matcher:/, 'Must export config matcher')
    assert.match(proxyContent, /sw\.js\|offline\.html\|icons/, 'Matcher must exclude PWA assets')
  })
})

test('2. Next.js 16 RSC-Aware Service Worker Verification', async (t) => {
  await t.test('public/sw.js exists and enforces strict non-GET bypass for Server Actions', () => {
    const swPath = path.resolve('public/sw.js')
    assert.ok(fs.existsSync(swPath), 'public/sw.js must exist')
    const sw = fs.readFileSync(swPath, 'utf8')

    // Invariant: Server Actions use POST and must NEVER be intercepted
    assert.match(sw, /req\.method\s*!==\s*['"]GET['"](?:\s*\)\s*\{\s*return|\s*\)\s*return)/, 'Must strictly bypass non-GET requests')
  })

  await t.test('public/sw.js detects and routes Next.js 16 RSC query parameters', () => {
    const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8')
    assert.match(sw, /_rsc/, 'Must reference _rsc query parameter')
    assert.match(sw, /isRscRequest/, 'Must contain isRscRequest detection')
    assert.match(sw, /__rsc_cache=1/, 'Must isolate RSC cache key')
  })

  await t.test('public/sw.js purges legacy v1 caches on activate event', () => {
    const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8')
    assert.match(sw, /validCaches\.has\(key\)/, 'Must check valid caches')
    assert.match(sw, /caches\.delete\(key\)/, 'Must delete obsolete caches on activate')
  })

  await t.test('public/sw.js strictly isolates CACHE_HTML from CACHE_RSC to prevent raw-text dumps', () => {
    const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8')
    assert.match(sw, /CACHE_HTML\s*=\s*['"]labsync-html-v2['"]/, 'Must define CACHE_HTML cache bucket')
    assert.match(sw, /CACHE_RSC\s*=\s*['"]labsync-rsc-v2['"]/, 'Must define CACHE_RSC cache bucket')
    assert.match(sw, /isHtmlNavigation/, 'Must guard HTML navigation from RSC collision')
    assert.match(sw, /contentType\.includes\(['"]text\/html['"]\)/, 'Must verify text/html Content-Type before storing in HTML cache')
  })

  await t.test('public/sw.js guarantees document navigation falls back to HTML or offline.html and never text/x-component', () => {
    const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8')
    assert.match(sw, /'Content-Type':\s*['"]text\/html['"]/, 'HTML document offline fallback must specify text/html Content-Type')
    assert.match(sw, /offlineFallback/, 'Must fallback to offline.html')
  })
})

test('3. Database Idempotency Guard & Server Action Verification', async (t) => {
  await t.test('practical_logs table has idempotency_key column in live PostgreSQL schema', async () => {
    const pool = getPgPool()
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practical_logs' AND column_name = 'idempotency_key';
    `)

    assert.equal(rows.length, 1, 'Column idempotency_key must exist on table practical_logs')
    assert.equal(rows[0].column_name, 'idempotency_key')
  })

  await t.test('app/actions/logs.ts processes idempotency_key', () => {
    const logsAction = fs.readFileSync(path.resolve('app/actions/logs.ts'), 'utf8')
    assert.match(logsAction, /idempotencyKey/, 'Must extract idempotencyKey')
    assert.match(logsAction, /idempotency_key\s*=\s*\$1/, 'Must query database for idempotency key replay')
  })
})

test('4. Enterprise IndexedDB Datastore & Sync Manager Architecture', async (t) => {
  await t.test('lib/offline/offline-store.ts exports all required UID-scoped storage methods', () => {
    const store = fs.readFileSync(path.resolve('lib/offline/offline-store.ts'), 'utf8')
    assert.match(store, /export async function saveQuerySnapshot/, 'Must export saveQuerySnapshot')
    assert.match(store, /export async function getQuerySnapshot/, 'Must export getQuerySnapshot')
    assert.match(store, /export async function getAllUserSnapshots/, 'Must export getAllUserSnapshots')
    assert.match(store, /export async function queueMutation/, 'Must export queueMutation')
    assert.match(store, /export async function getPendingMutations/, 'Must export getPendingMutations')
    assert.match(store, /export async function removeMutation/, 'Must export removeMutation')
    assert.match(store, /export async function purgeAllOfflineData/, 'Must export purgeAllOfflineData for sign-out wipe')
  })

  await t.test('client-query-cache.ts write-through persists to saveQuerySnapshot and hydrates via hydrateCacheFromIndexedDB', () => {
    const cache = fs.readFileSync(path.resolve('lib/cache/client-query-cache.ts'), 'utf8')
    assert.match(cache, /saveQuerySnapshot/, 'setCachedQuery must write-through to IndexedDB')
    assert.match(cache, /hydrateCacheFromIndexedDB/, 'Must export hydrateCacheFromIndexedDB')
  })

  await t.test('lib/offline/sync-manager.ts exports resilient outbox dispatch and auto-badges', () => {
    const sync = fs.readFileSync(path.resolve('lib/offline/sync-manager.ts'), 'utf8')
    assert.match(sync, /export async function executeResilientMutation/, 'Must export executeResilientMutation')
    assert.match(sync, /export async function flushMutationOutbox/, 'Must export flushMutationOutbox')
    assert.match(sync, /export function subscribeToSyncStatus/, 'Must export subscribeToSyncStatus')
    assert.match(sync, /setAppBadge/, 'Must support setAppBadge API')
  })
})

test('5. Mobile Ergonomics & Tactical UI Standards', async (t) => {
  await t.test('hooks/use-wake-lock.ts exports useWakeLock hook', () => {
    const hook = fs.readFileSync(path.resolve('hooks/use-wake-lock.ts'), 'utf8')
    assert.match(hook, /export function useWakeLock/, 'Must export useWakeLock')
    assert.match(hook, /wakeLock\.request/, 'Must call navigator.wakeLock.request')
  })

  await t.test('Mobile bottom nav has zero literal "+" in labels (Rule 1)', () => {
    const nav = fs.readFileSync(path.resolve('components/layout/mobile-bottom-nav.tsx'), 'utf8')
    assert.doesNotMatch(nav, />\s*\+\s*[A-Za-z]/, 'Must not contain literal "+" in labels')
  })

  await t.test('PWA install prompt has zero literal "+" in labels (Rule 1)', () => {
    const prompt = fs.readFileSync(path.resolve('components/pwa/pwa-install-prompt.tsx'), 'utf8')
    assert.doesNotMatch(prompt, />\s*\+\s*[A-Za-z]/, 'Must not contain literal "+" in labels')
  })

  await t.test('app/(dashboard)/layout.tsx mounts MobileBottomNav and PwaInstallPrompt with safe mobile dock padding', () => {
    const layout = fs.readFileSync(path.resolve('app/(dashboard)/layout.tsx'), 'utf8')
    assert.match(layout, /<MobileBottomNav \/>/, 'Must mount MobileBottomNav')
    assert.match(layout, /<PwaInstallPrompt \/>/, 'Must mount PwaInstallPrompt')
    assert.match(layout, /pb-(?:24|28)\s+md:pb-8/, 'Must have pb-24 or pb-28 md:pb-8 on main page container')
  })

  await t.test('MobileBottomNav has z-30 to remain below modal overlays', () => {
    const nav = fs.readFileSync(path.resolve('components/layout/mobile-bottom-nav.tsx'), 'utf8')
    assert.match(nav, /z-30/, 'MobileBottomNav must have z-30 to remain below modal overlays')
  })

  await t.test('log-form.tsx sticky submit bar has sticky positioning', () => {
    const form = fs.readFileSync(path.resolve('app/(dashboard)/records/new/log-form.tsx'), 'utf8')
    assert.match(form, /sticky\s+(?:bottom-0|bottom-\[calc\(4rem\+env\(safe-area-inset-bottom,0px\)\)\]\s+md:bottom-0)/, 'Submit bar must have sticky positioning above dock')
  })
})
