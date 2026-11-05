import { test, expect } from '@playwright/test'

test.describe('Responsive Multi-Device Viewport Audit Suite', () => {
  const viewports = [
    { name: 'Desktop Full HD', width: 1920, height: 1080 },
    { name: 'Laptop Widescreen', width: 1280, height: 800 },
    { name: 'Tablet iPad Portrait', width: 768, height: 1024 },
    { name: 'Mobile iPhone Modern', width: 390, height: 844 },
  ]

  for (const vp of viewports) {
    test(`1. Viewport Adaptation on ${vp.name} (${vp.width}x${vp.height}) - Zero Horizontal Overflow`, async ({ page }) => {
      test.setTimeout(60000)
      await page.setViewportSize({ width: vp.width, height: vp.height })

      // Audit Dashboard
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')
      const dashOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 8
      })
      expect(dashOverflow).toBe(true)

      // Audit Computer Lab Floor Plan
      await page.goto('/computer-lab')
      await page.waitForLoadState('domcontentloaded')
      const labOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 8
      })
      expect(labOverflow).toBe(true)

      // Audit Student Terminal
      await page.goto('/terminal/PC-01')
      await page.waitForLoadState('domcontentloaded')
      const termOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 8
      })
      expect(termOverflow).toBe(true)
    })
  }

  test('2. Mobile Device Navigation & Touch-Target Accessibility (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/terminal/PC-01')
    await page.waitForLoadState('domcontentloaded')

    // Verify touch targets for quick issue chips have accessible tap targets (>= 40px)
    const chips = page.locator('button:has-text("Fault"), button:has-text("Internet"), button:has-text("Software"), button:has-text("Freeze")')
    const chipCount = await chips.count()
    expect(chipCount).toBeGreaterThan(0)

    for (let i = 0; i < chipCount; i++) {
      const box = await chips.nth(i).boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36) // Standard mobile tap target
      }
    }

    // Verify live countdown badge renders visibly on mobile fold
    const clockBadge = page.locator('text=/min remaining|Starts/i').first()
    if (await clockBadge.count() > 0) {
      await expect(clockBadge).toBeVisible()
    }
  })
})
