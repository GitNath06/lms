import { test, expect } from '@playwright/test'

test.describe('LabSync LIMS: Core End-to-End Regressions', () => {
  test('1. Computer Lab CAD Floor Plan & Live Cockpit renders living nodes', async ({ page }) => {
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    // Verify page title and header
    await expect(page).toHaveTitle(/LabSync LIMS|Floor Plan|Cockpit/i)

    // Verify main CAD canvas viewport is visible
    const canvasViewport = page.locator('main, [data-testid="canvas-viewport"]').first()
    await expect(canvasViewport).toBeVisible()

    // Verify living workstation nodes are mounted on the floor
    const pcNodes = page.locator('text=/PC-\\d+/i')
    const count = await pcNodes.count()
    expect(count).toBeGreaterThan(0)

    // Verify canvas HUD controls (Zoom/Reset) exist without illegal literal '+' labels
    const buttons = page.locator('button')
    const allButtonTexts = await buttons.allInnerTexts()
    for (const txt of allButtonTexts) {
      expect(txt.trim()).not.toMatch(/^\+$/)
    }
  })

  test('2. Navigation Hub: Core Operational Views load successfully', async ({ page }) => {
    // A. Weekly Routine Timetable
    await page.goto('/schedules')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('Application error')

    // B. Maintenance Workbench
    await page.goto('/maintenance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).toContainText(/Maintenance|Service|Routine/i)

    // C. Equipment Incident & Breakage Register
    await page.goto('/incidents')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).toContainText(/Incident|Breakage|Equipment/i)

    // D. Printable Official A4 Records Sheet
    await page.goto('/print/records')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
  })

  test('3. Student Terminal Gateway: Clean rendering and zero-crash fallback', async ({ page }) => {
    // Navigate to PC-01 terminal kiosk
    await page.goto('/terminal/PC-01')
    await page.waitForLoadState('domcontentloaded')

    // Must not crash or return 500
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).not.toContainText('500')

    // Must display station identity
    await expect(page.locator('body')).toContainText(/PC-01|Terminal|Station/i)
  })
})
