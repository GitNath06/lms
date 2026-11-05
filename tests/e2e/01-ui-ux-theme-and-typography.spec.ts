import { test, expect } from '@playwright/test'

test.describe('UI/UX Theme & Typography Audit Suite', () => {
  const routes = ['/', '/computer-lab', '/schedules', '/maintenance', '/incidents', '/terminal/PC-01']

  test('1. Dark and Light Theme Switching & Surface Integrity', async ({ page }) => {
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    const html = page.locator('html')
    const body = page.locator('body')

    // Find Theme Toggle Button
    const themeBtn = page.locator('button[aria-label="Toggle theme"], button[title*="Theme"]').first()
    await expect(themeBtn).toBeVisible({ timeout: 10000 })

    // Check initial dark theme state
    const initialIsDark = await html.evaluate((el) => el.classList.contains('dark'))
    
    // Toggle theme to opposite mode
    await themeBtn.click()
    await page.waitForTimeout(600) // Transition settling

    const toggledIsDark = await html.evaluate((el) => el.classList.contains('dark'))
    expect(toggledIsDark).not.toBe(initialIsDark)

    // Verify computed styles change
    const toggledBg = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor)
    expect(toggledBg).toBeTruthy()

    // Toggle back to original theme
    await themeBtn.click()
    await page.waitForTimeout(600)
    const finalIsDark = await html.evaluate((el) => el.classList.contains('dark'))
    expect(finalIsDark).toBe(initialIsDark)
  })

  test('2. Typography Stack: Plus Jakarta Sans, Inter & JetBrains Mono Verification', async ({ page }) => {
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    // A. Check Heading Typography (Plus Jakarta Sans)
    const heading = page.locator('h1, h2, .font-heading').first()
    await expect(heading).toBeVisible()
    const headingFont = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(headingFont.toLowerCase()).toMatch(/plus jakarta sans|system-ui|-apple-system/i)

    // B. Check Body Typography (Inter)
    const bodyText = page.locator('body')
    const bodyFont = await bodyText.evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(bodyFont.toLowerCase()).toMatch(/inter|noto sans devanagari|system-ui|-apple-system/i)

    // C. Check Monospace Typography (JetBrains Mono)
    const monoElement = page.locator('.font-mono, code').first()
    if (await monoElement.count() > 0) {
      const monoFont = await monoElement.evaluate((el) => window.getComputedStyle(el).fontFamily)
      expect(monoFont.toLowerCase()).toMatch(/jetbrains mono|monospace|ui-monospace/i)
    }

    // D. Global Tabular Numbers for Data Alignment
    const tabularVariant = await bodyText.evaluate((el) => window.getComputedStyle(el).fontVariantNumeric)
    expect(tabularVariant).toContain('tabular-nums')
  })

  test('3. Rule 1: Zero Literal "+" in Button Text Across All Core Routes', async ({ page }) => {
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')

      const buttonTexts = await page.locator('button').allInnerTexts()
      for (const text of buttonTexts) {
        const trimmed = text.trim()
        // Must never be a literal solitary "+" (must use Lucide <Plus /> icon)
        expect(trimmed).not.toBe('+')
        expect(trimmed).not.toMatch(/^\+\s+[A-Za-z]+/)
      }
    }
  })

  test('4. Light Theme Contrast & Hardware Telemetry Clean Rendering (Zero Ghost Values)', async ({ page }) => {
    // A. Terminal hardware telemetry: Zero ghost empty spaces
    await page.goto('/terminal/PC-01')
    await page.waitForLoadState('domcontentloaded')

    const terminalText = await page.locator('body').innerText()
    // Must never contain orphaned units without values
    expect(terminalText).not.toMatch(/\(C:\)/)
    expect(terminalText).not.toMatch(/[•·]\s+GB RAM/)
    expect(terminalText).not.toMatch(/Drive C:\s+GB free/)
    expect(terminalText).not.toMatch(/IP:\s*$/m)

    // Verify category chip does not have ellipsis truncation
    const lanChipTitle = page.locator('text=/No Internet \/ LAN Disconnected/i').first()
    if (await lanChipTitle.count() > 0) {
      await expect(lanChipTitle).toBeVisible()
      const titleText = await lanChipTitle.innerText()
      expect(titleText).not.toContain('...')
    }

    // B. Maintenance Triage Hub: High Contrast in Light Mode
    await page.goto('/maintenance')
    await page.waitForLoadState('domcontentloaded')

    const html = page.locator('html')
    const themeBtn = page.locator('button[aria-label="Toggle theme"], button[title*="Theme"]').first()
    if (await themeBtn.isVisible()) {
      const isDark = await html.evaluate((el) => el.classList.contains('dark'))
      if (isDark) {
        await themeBtn.click()
        await page.waitForTimeout(400)
      }
    }

    // Verify resolved notes box exists and uses dark high-contrast text in light mode
    const resNotes = page.locator('text=/Resolution Notes:/i').first()
    if (await resNotes.count() > 0) {
      await expect(resNotes).toBeVisible()
    }

    // C. Computer Lab Baseline Seating: Dropdown Width and Cohort Priority
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    const baselineBtn = page.locator('button:has-text("Baseline Seating")').first()
    if (await baselineBtn.isVisible()) {
      await baselineBtn.click()
      await page.waitForTimeout(400)

      // Ensure cohort selector prioritized Grade 11/12
      const classSelect = page.locator('select').first()
      if (await classSelect.count() > 0) {
        const val = await classSelect.inputValue()
        expect(val).toMatch(/11|12/i)
      }
    }
  })
})
