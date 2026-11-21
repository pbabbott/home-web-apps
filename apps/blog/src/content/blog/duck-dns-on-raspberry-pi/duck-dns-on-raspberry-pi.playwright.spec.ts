import { test, expect } from '@playwright/test';
import { gotoPage, SCREENSHOT_OPTIONS } from '@tests/playwright-helpers';

test.describe('Blog post: duck-dns-on-raspberry-pi', () => {
  test('renders', async ({ page }) => {
    await gotoPage(page, '/blog/duck-dns-on-raspberry-pi');
    await expect(page).toHaveScreenshot('page.png', SCREENSHOT_OPTIONS);
  });

  // Regression: the AI highlight paints a gradient on the block and relies on
  // `[&_*]:text-transparent` to reveal it through descendant text. That rule
  // lost to Typography's `text-neutral-50` when the library and app compiled
  // Tailwind separately.
  test('AI highlight makes descendant text transparent', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.addInitScript(() =>
      window.localStorage.setItem('reader:highlight-ai', 'true'),
    );
    await gotoPage(page, '/blog/duck-dns-on-raspberry-pi');
    const body = page.locator('[data-ai-content-body]').first();
    for (const sel of ['h4', 'p']) {
      await expect(body.locator(sel).first()).toHaveCSS(
        'color',
        'rgba(0, 0, 0, 0)',
      );
    }
  });
});
