import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog listing page', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
