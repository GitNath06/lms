import { Page, expect } from '@playwright/test'

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
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })
}
