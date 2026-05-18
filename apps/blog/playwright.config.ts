import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.playwright.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Store snapshots in __screenshots__ folders next to spec files
  // e.g., tests/blog/__screenshots__/page-s26ultra.png
  // These baseline screenshots should be committed to version control
  snapshotPathTemplate: 'tests/__screenshots__/{testFileDir}/{arg}-{projectName}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: 'http://localhost:4020',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 's26ultra',
      use: { ...devices['Desktop Chrome'], viewport: { width: 384, height: 690 } },
    },
    {
      name: 'macbook_air',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 832 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 824, height: 1149 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4020',
    reuseExistingServer: !process.env.CI,
  },
});
