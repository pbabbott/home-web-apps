import { test, expect } from '@playwright/test';
import {
  gotoPage,
  SCREENSHOT_OPTIONS,
  RESPONSIVE_BREAKPOINTS,
  RESPONSIVE_VIEWPORT_HEIGHT,
} from '@tests/playwright-helpers';

test.describe('System architecture page — breakpoints', () => {
  for (const { name, width } of RESPONSIVE_BREAKPOINTS) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width, height: RESPONSIVE_VIEWPORT_HEIGHT });
      await gotoPage(page, '/system-architecture');
      await expect(page).toHaveScreenshot(
        `page-${name}.png`,
        SCREENSHOT_OPTIONS,
      );
    });
  }
});
