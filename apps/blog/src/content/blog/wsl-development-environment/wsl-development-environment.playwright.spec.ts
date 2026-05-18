import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: wsl-development-environment', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/wsl-development-environment');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
