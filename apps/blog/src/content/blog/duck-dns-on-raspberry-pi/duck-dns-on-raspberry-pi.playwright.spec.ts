import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: duck-dns-on-raspberry-pi', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/duck-dns-on-raspberry-pi');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
