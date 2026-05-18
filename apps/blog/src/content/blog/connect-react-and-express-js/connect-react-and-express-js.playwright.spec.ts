import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: connect-react-and-express-js', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/connect-react-and-express-js');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });
});
