import { test, expect } from '@playwright/test';
import { gotoPage, scrollToId, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog listing page', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });

  test('more-posts', async ({ page }) => {
    await gotoPage(page, '/blog');
    await scrollToId(page, 'more-posts');
    await expect(page).toHaveScreenshot('more-posts.png', SCREENSHOT_OPTIONS);
  });
});
