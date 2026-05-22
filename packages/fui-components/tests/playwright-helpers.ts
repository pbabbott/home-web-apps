import type { Page } from '@playwright/test';

/**
 * Navigate to a Storybook story and wait for it to be ready
 */
export async function gotoStory(page: Page, storyId: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

/**
 * Standard viewport size for visual regression tests
 */
export const STANDARD_VIEWPORT = { width: 1280, height: 720 };

/**
 * Standard screenshot options for visual regression tests
 */
export const SCREENSHOT_OPTIONS = {
  fullPage: true,
  animations: 'disabled' as const,
};
