import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: a-new-beginning-establishing-a-non-prod-cluster-at-home', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/a-new-beginning-establishing-a-non-prod-cluster-at-home');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
