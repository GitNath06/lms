import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test.describe('Mobile 375x812 UX & Non-Overlapping Layout Verification', () => {
  test.describe.configure({ timeout: 90000 })
  test.use({ viewport: { width: 375, height: 812 } })

  test('1. Top Navbar has zero horizontal overflow and no overlapping elements at 375px', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Verify header does not overflow 375px viewport
    const header = page.locator('header')
    await expect(header).toBeVisible()
    const headerBox = await header.boundingBox()
    expect(headerBox).not.toBeNull()
    expect(headerBox!.width).toBeLessThanOrEqual(375)

    // Verify zero document-level horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(hasHorizontalOverflow).toBe(false)

    // Check that Dev Simulator controllers are NOT rendered in production
    if (process.env.NODE_ENV === 'production') {
      const timeTravelPill = page.getByText(/Simulating/i)
      const terminalSimulatorPill = page.getByText(/Station Rig/i)
      expect(await timeTravelPill.count()).toBe(0)
      expect(await terminalSimulatorPill.count()).toBe(0)
    }
  })

  test('2. /records/new Sticky Bottom Submit Bar renders cleanly without overlapping at 375px', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/records/new')
    await page.waitForLoadState('domcontentloaded')

    // Wait for form to mount
    const form = page.locator('form').filter({ hasText: 'Session Environment' })
    await expect(form).toBeVisible({ timeout: 30000 })

    // Check sticky bottom submit bar
    const submitBtn = form.locator('button[type="submit"]')
    await expect(submitBtn).toBeVisible()

    const submitBox = await submitBtn.boundingBox()
    expect(submitBox).not.toBeNull()
    expect(submitBox!.height).toBeGreaterThanOrEqual(44) // Accessible 44px tap target
    expect(submitBox!.width).toBeGreaterThanOrEqual(100)

    const cancelBtn = form.locator('button:has-text("Cancel")')
    await expect(cancelBtn).toBeVisible()
    const cancelBox = await cancelBtn.boundingBox()
    expect(cancelBox).not.toBeNull()
    expect(cancelBox!.height).toBeGreaterThanOrEqual(44)

    // Verify submit button and cancel button do not overlap horizontally
    expect(cancelBox!.x + cancelBox!.width).toBeLessThanOrEqual(submitBox!.x + 2)

    // Verify zero horizontal overflow on page
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('3. /computer-lab Mobile Bench List renders cleanly with zero horizontal overflow at 375px', async ({ page }) => {
    test.setTimeout(120000)
    await loginAsAdmin(page)
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    // Mode switcher should show Aisle Deck / Bench List active on mobile
    const aisleDeckToggle = page.locator('button:has-text("Aisle Deck"), button:has-text("Bench List")').first()
    await expect(aisleDeckToggle).toBeVisible({ timeout: 60000 })

    // Verify bench items are rendered in a clean column
    const benchItems = page.locator('[data-testid="mobile-bench-item"], .rounded-2xl.border')
    expect(await benchItems.count()).toBeGreaterThan(0)

    // Verify zero horizontal overflow on page
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('4. MobileBottomNav dock is visible on /records/new', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/records/new')
    await page.waitForLoadState('domcontentloaded')

    // Mobile nav dock should be rendered on creation view
    const mobileDock = page.locator('nav[aria-label="Mobile Navigation Dock"]')
    await expect(mobileDock).toBeVisible()
  })

  test('5. MobileBottomNav dock is visible on home/records and positioned below modal overlays', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/records')
    await page.waitForLoadState('domcontentloaded')

    // Mobile nav dock should be visible on /records
    const mobileDock = page.locator('nav[aria-label="Mobile Navigation Dock"]')
    await expect(mobileDock).toBeVisible()

    // Mobile dock must have z-index 30
    const dockZIndex = await mobileDock.evaluate((el) => {
      return window.getComputedStyle(el).zIndex
    })
    expect(Number(dockZIndex)).toBeLessThanOrEqual(30)
  })
})
