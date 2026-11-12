
import { test, expect } from '@playwright/test'
import { loginAsAdmin, authenticateAsTerminal } from './helpers/auth'

test.describe('Deep Interactive Clicks, Drawers & Modals Audit Suite', () => {
  test('1. Computer Lab CAD Floor: Workstation Node Click & Sidebar Drawer Tab Switching', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    // Find and click any workstation node (e.g. PC-01, PC-02)
    const pcNode = page.locator('[data-testid="workstation-node"]').first()
    await expect(pcNode).toBeVisible({ timeout: 30000 })
    await pcNode.click()

    // Verify Unified Workstation Sidebar Drawer opens
    const drawer = page.locator('[data-testid="workstation-drawer"]').first()
    await expect(drawer).toBeVisible({ timeout: 10000 })

    // Click Drawer Tab 1: Specs
    const specsTab = drawer.locator('button:has-text("Specs")').first()
    if (await specsTab.count() > 0) {
      await specsTab.click()
      await page.waitForTimeout(300)
    }

    // Click Drawer Tab 2: Seating
    const seatingTab = drawer.locator('button:has-text("Seating")').first()
    if (await seatingTab.count() > 0) {
      await seatingTab.click()
      await page.waitForTimeout(300)
    }

    // Click Drawer Tab 3: Issues
    const issuesTab = drawer.locator('button:has-text("Issues")').first()
    if (await issuesTab.count() > 0) {
      await issuesTab.click()
      await page.waitForTimeout(300)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }

    // Click Drawer Tab 4: Report
    const reportTab = drawer.locator('button:has-text("Report")').first()
    if (await reportTab.count() > 0) {
      await reportTab.click()
      await page.waitForTimeout(300)
    }

    // Close drawer via Escape key or close button
    const closeBtn = drawer.locator('button:has(svg.lucide-x)').first()
    if (await closeBtn.count() > 0) {
      await closeBtn.click()
    } else {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(500)
  })

  test('2. Canvas HUD Controls: Minimap, Zoom, Fit-to-Screen & Jump-to-Roll', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/computer-lab')
    await page.waitForLoadState('domcontentloaded')

    // Test Minimap Toggle Button
    const minimapBtn = page.locator('button[title*="Minimap"], button[aria-label*="Minimap"]').first()
    if (await minimapBtn.count() > 0) {
      await minimapBtn.click()
      await page.waitForTimeout(300)
    }

    // Test Fit-to-Screen HUD Button
    const fitBtn = page.locator('button[title*="Fit"], button[aria-label*="Fit"]').first()
    if (await fitBtn.count() > 0) {
      await fitBtn.click()
      await page.waitForTimeout(300)
    }

    // Test Jump-to-Roll Input (present during active session)
    const jumpInput = page.locator('input[placeholder*="Roll"], input[aria-label*="Jump"]').first()
    if (await jumpInput.isVisible()) {
      await jumpInput.fill('12')
      await page.waitForTimeout(300)
      expect(await jumpInput.inputValue()).toBe('12')
    }
  })

  test('3. Timetable Grid (/schedules): Day Tabs & Session Action Modal', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/schedules')
    await page.waitForLoadState('domcontentloaded')

    // Click through weekly day tabs (Sunday - Friday)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    for (const day of dayNames) {
      const dayBtn = page.getByRole('button', { name: day }).or(page.locator(`button:has-text("${day}")`)).first()
      if (await dayBtn.isVisible()) {
        await dayBtn.click({ force: true })
        await page.waitForTimeout(300)
        await expect(page.locator('body')).not.toContainText('Internal Server Error')
      }
    }

    // Click an active timetable session slot
    const sessionSlot = page.locator('[data-testid="routine-slot"], .cursor-pointer:has-text("Science"), .cursor-pointer:has-text("Computer")').first()
    if (await sessionSlot.count() > 0) {
      await sessionSlot.click()
      await page.waitForTimeout(500)

      // Verify modal opens without crashing
      const modal = page.locator('[role="dialog"]')
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible()
        // Close modal via Escape
        await page.keyboard.press('Escape')
      }
    }
  })

  test('4. Maintenance Workbench (/maintenance): Tab Switching & Certified Service History', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/maintenance')
    await page.waitForLoadState('domcontentloaded')

    // Click Tab 2: Certified Service History Logbook
    const logbookTab = page.locator('button:has-text("Certified Service History"), button:has-text("History"), button:has-text("Logbook")').first()
    if (await logbookTab.count() > 0) {
      await logbookTab.click()
      await page.waitForTimeout(400)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
      await expect(page.locator('body')).toContainText(/Service|Logbook|Maintenance/i)
    }

    // Click Tab 1: Routine Tasks & Schedules
    const routineTab = page.locator('button:has-text("Routine Tasks"), button:has-text("Active Routines"), button:has-text("Schedules")').first()
    if (await routineTab.count() > 0) {
      await routineTab.click()
      await page.waitForTimeout(400)
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    }
  })

  test('5. Student Terminal Portal (/terminal/PC-01): Interactive Issue Chip Selection & Practical Focus', async ({ page }) => {
    await authenticateAsTerminal(page, 'PC-01')
    await page.goto('/terminal/PC-01')
    await page.waitForLoadState('domcontentloaded')

    // Verify Problem Category or Terminal view renders
    await expect(page.locator('body')).toContainText(/Select Problem Category|Workstation|Active Session/i)

    // Click an issue chip (e.g. "Mouse / Keyboard Fault")
    const issueChip = page.locator('button:has-text("Mouse / Keyboard Fault"), button:has-text("Missing Lab Software")').first()
    await expect(issueChip).toBeVisible()
    await issueChip.click()
    await page.waitForTimeout(300)

    // Custom details textarea should be interactive
    const textarea = page.locator('textarea, input[placeholder*="additional details" i]').first()
    if (await textarea.count() > 0) {
      await textarea.fill('E2E Audit Test: Left mouse button sticky')
      expect(await textarea.inputValue()).toContain('E2E Audit Test')
    }
  })
})
