import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: non-prod-milestone-one-proxmox-terraform-ansible', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/non-prod-milestone-one-proxmox-terraform-ansible');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
