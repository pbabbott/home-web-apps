/**
 * Captures a screenshot of the procedural Pironman4 model from each
 * standard angle — mirrors capture-nas.mts.
 *
 * Requires `pnpm --filter @abbottland/home-hud dev` already running on
 * localhost:4022.
 *
 * Usage: pnpm --filter @abbottland/home-hud capture:pironman4
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const DEV_SERVER_URL = 'http://localhost:4022';
const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'pironman4-renders');

const STANDARD_ANGLES = [
  'front',
  'rear',
  'left',
  'right',
  'top',
  'bottom',
  'threeQuarter',
] as const;

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
  });

  for (const angle of STANDARD_ANGLES) {
    const url = `${DEV_SERVER_URL}/infra/viz?model=pironman4&angle=${angle}`;
    console.log(`Capturing ${angle} -> ${url}`);

    await page.goto(url, { waitUntil: 'networkidle' });

    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(500);

    const outputPath = path.join(OUTPUT_DIR, `${angle}.png`);
    await canvas.screenshot({ path: outputPath });
    console.log(`  -> ${outputPath}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
