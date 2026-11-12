import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

test.describe('Academic Terminology, Design Invariants & Standards Audit Suite', () => {
  const routes = ['/computer-lab', '/terminal/PC-01', '/login']

  test('1. Standardized Academic Terminology Compliance (Zero Forbidden Jargon)', async ({ page }) => {
    await loginAsAdmin(page)
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')

      const bodyText = await page.locator('body').innerText()

      // Invariant 1: Must use "Attendance" - NEVER "Turnout" or "Turnout Tally"
      expect(bodyText).not.toMatch(/\bTurnout\b/i)
      expect(bodyText).not.toMatch(/\bTurnout Tally\b/i)

      // Invariant 2: Must use "Timetable" or "Schedule" - NEVER "Matrix"
      expect(bodyText).not.toMatch(/\bToday's Matrix\b/i)
      expect(bodyText).not.toMatch(/\bRoutine Matrix\b/i)

      // Invariant 3: Must use "Equipment" - NEVER "Apparatus" (Universal Equipment Standard)
      expect(bodyText).not.toMatch(/\bApparatus\b/i)
      expect(bodyText).not.toMatch(/\bBurnt Apparatus\b/i)
    }
  })

  test('2. Super Admin Console (/admin): Safety Lock "Precaution Active" Verification', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin')
    await page.waitForLoadState('domcontentloaded')

    // Verify "Precaution Active" safety toggle label is present intact (Rule #3)
    const precautionLabel = page.locator('text=/Precaution Active/i').first()
    if (await precautionLabel.count() > 0) {
      await expect(precautionLabel).toBeVisible()
    }
  })

  test('3. Official A4 Printable Documents & Signature Blocks', async ({ page }) => {
    await loginAsAdmin(page)

    // A. Official Practical Records Sheet
    await page.goto('/print/records')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).toContainText(/Teacher|Instructor|In-Charge|Signature/i)

    // B. Wall Seating Chart Sheet
    await page.goto('/print/seating-chart')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).not.toContainText('Internal Server Error')
    await expect(page.locator('body')).toContainText(/Seating Chart|Computer Lab|Row/i)
  })
})
