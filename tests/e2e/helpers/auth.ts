import { Page, expect } from '@playwright/test'
import { createTerminalSessionToken } from '../../../lib/security/terminal-token'

/**
 * Log in as Super Admin (admin@rrl.edu.np) using the 1-click evaluation demo button
 * or standard credentials.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')

  // If already authenticated and redirected away from login
  if (!page.url().includes('/login')) {
    return
  }

  // Fill credentials directly (works regardless of NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS)
  const emailInput = page.locator('input[name="email"]')
  await emailInput.fill('admin@rrl.edu.np')

  const passwordInput = page.locator('input[name="password"]')
  await passwordInput.fill('Admin@12345')

  // Click primary Sign In button
  const submitBtn = page.locator('button:has-text("Sign In to Laboratory Portal")').first()
  await submitBtn.click()

  // Wait for redirect to dashboard or away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 })
}

/**
 * Authenticates the browser context with an active hardware session cookie
 * matching the requested terminal code and aligned with physical silicon GUID.
 */
export async function authenticateAsTerminal(page: Page, stationCode = 'PC-01') {
  let stationId = '3435ea78-25ce-41d9-bd45-0c4387b22424'
  let machineGuid = 'ce723115-5c2c-40bb-8545-a7616d2d6f5b-20-4E-F6-BC-E8-37'

  try {
    const { getPgPool } = await import('../../../lib/db')
    const pool = getPgPool()
    const res = await pool.query(
      'SELECT id, machine_guid FROM public.workstations WHERE LOWER(label) = LOWER($1) LIMIT 1',
      [stationCode]
    )
    if (res.rows.length > 0) {
      stationId = res.rows[0].id
      machineGuid = res.rows[0].machine_guid || machineGuid
    }
  } catch {
    // Graceful fallback to verified PC-01 credentials
  }

  const token = createTerminalSessionToken({
    id: stationId,
    label: stationCode,
    machine_guid: machineGuid,
  })

  await page.context().addCookies([
    {
      name: 'labsync_terminal_session',
      value: token,
      url: 'http://localhost:3000',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ])
}
