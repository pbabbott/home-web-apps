import { readFileSync } from 'fs';
import { join } from 'path';
import type { Page } from '@playwright/test';

function readProxyBase(): string {
  try {
    const content = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8');
    return content.match(/^NEXT_PUBLIC_BASE_PATH=(.+)$/m)?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

// Read once at module load; empty string means localhost mode
const PROXY_BASE = readProxyBase();

export async function gotoPage(page: Page, path: string): Promise<void> {
  if (PROXY_BASE) {
    // When the dev server started with NEXT_PUBLIC_BASE_PATH set, imageLoader
    // returns absolute proxy URLs (e.g. https://coder.local/.../proxy/4020/img.svg).
    // Intercept those and redirect to localhost so snapshots work consistently.
    const escapedBase = PROXY_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page.route(new RegExp(`^${escapedBase}`), async (route) => {
      const localPath = route.request().url().slice(PROXY_BASE.length);
      await route.continue({ url: `http://localhost:4020${localPath}` });
    });
  }
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

export async function scrollToId(page: Page, id: string): Promise<void> {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
}

export const SCREENSHOT_OPTIONS = {
  animations: 'disabled' as const,
  maxDiffPixelRatio: 0.03,
};
