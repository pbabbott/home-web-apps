import type { Page } from '@playwright/test';

export async function gotoPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

export const SCREENSHOT_OPTIONS = {
  animations: 'disabled' as const,
};
