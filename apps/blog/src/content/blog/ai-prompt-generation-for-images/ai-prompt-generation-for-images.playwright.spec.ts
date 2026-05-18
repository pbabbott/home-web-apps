import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: ai-prompt-generation-for-images', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/ai-prompt-generation-for-images');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
