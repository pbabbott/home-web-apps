import { test, expect } from '@playwright/test';
import { gotoPage, scrollToId, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Home page', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });

  test('welcome-section', async ({ page }) => {
    await gotoPage(page, '/');
    await scrollToId(page, 'welcome-section');
    await expect(page).toHaveScreenshot('welcome-section.png', SCREENSHOT_OPTIONS);
  });

  test('about-me', async ({ page }) => {
    await gotoPage(page, '/');
    await scrollToId(page, 'about-me');
    await expect(page).toHaveScreenshot('about-me.png', SCREENSHOT_OPTIONS);
  });
});
