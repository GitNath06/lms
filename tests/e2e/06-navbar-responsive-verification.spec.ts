import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

const VIEWPORTS = [
  { width: 768, height: 858, label: '768x858 (iPad Mini / Small Tablet)' },
  { width: 842, height: 858, label: '842x858 (Intermediate Tablet)' },
  { width: 950, height: 858, label: '950x858 (Large Tablet)' },
  { width: 1100, height: 858, label: '1100x858 (Small Laptop)' },
  { width: 1686, height: 858, label: '1686x858 (Wide Desktop)' },
]

test.describe('Navbar Responsive Budget & Status Dot Verification', () => {
  test.describe.configure({ timeout: 90000 })

  for (const vp of VIEWPORTS) {
    test(`Zero overlap & clean spacing at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await loginAsAdmin(page)
      await page.goto('/')
      await page.waitForLoadState('domcontentloaded')

      const header = page.locator('header')
      await expect(header).toBeVisible()

      // Header width must not exceed viewport width
      const headerBox = await header.boundingBox()
      expect(headerBox).not.toBeNull()
      expect(headerBox!.width).toBeLessThanOrEqual(vp.width)

      // Get left group and right group bounding boxes
      const leftGroup = header.locator('> div').first()
      const rightGroup = header.locator('> div').last()

      await expect(leftGroup).toBeVisible()
      await expect(rightGroup).toBeVisible()

      const leftBox = await leftGroup.boundingBox()
      const rightBox = await rightGroup.boundingBox()

      expect(leftBox).not.toBeNull()
      expect(rightBox).not.toBeNull()

      // Strict Non-Overlap Assertion: left right edge must be strictly less than right left edge
      const horizontalGap = rightBox!.x - (leftBox!.x + leftBox!.width)
      expect(horizontalGap).toBeGreaterThan(10) // At least 10px breathing room!

      // Verify no document horizontal scrollbar
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth
      })
      expect(hasHorizontalOverflow).toBe(false)

      // Verify Avatar does NOT have a status dot placed directly over it
      const avatarContainer = page.locator('button[aria-label="User Profile Menu"] .relative.shrink-0')
      await expect(avatarContainer).toBeVisible()

      // Check that there is NO absolute dot inside the avatar container
      const dotInsideAvatar = avatarContainer.locator('.absolute')
      expect(await dotInsideAvatar.count()).toBe(0)

      // Test Responsive Role Text Visibility
      const roleTextColumn = page.locator('button[aria-label="User Profile Menu"] > div.flex-col')
      if (vp.width >= 1280) {
        await expect(roleTextColumn).toBeVisible()
        // Status dot is inline next to role text
        const inlineDot = roleTextColumn.locator('span.rounded-full')
        await expect(inlineDot).toBeVisible()
      } else {
        await expect(roleTextColumn).toBeHidden()
      }

      // Test that clicking profile opens dropdown popover with role badge and inline status dot
      const profileButton = page.locator('button[aria-label="User Profile Menu"]')
      await profileButton.click()

      const popoverRoleBadge = page.locator('.pt-0\\.5 span.font-mono.font-bold')
      await expect(popoverRoleBadge).toBeVisible()

      // Popover role badge contains inline status dot
      const popoverStatusDot = popoverRoleBadge.locator('span.rounded-full')
      await expect(popoverStatusDot).toBeVisible()

      // Close popover
      await page.keyboard.press('Escape')
    })
  }
})

