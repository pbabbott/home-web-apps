/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
// @microsoft/api-extractor is pinned (root package.json `pnpm.overrides`,
// and here as a devDependency) to a version whose bundled TypeScript
// matches this repo's `typescript` version (~5.9.3). Mismatched versions
// don't error — the dts rollup below silently degrades to an empty
// re-export stub instead of real type declarations. Bump both together.
import { ExtractorLogLevel } from '@microsoft/api-extractor';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    !isStorybook &&
      dts({
        insertTypesEntry: true,
        rollupTypes: true,
        tsconfigPath: './tsconfig.build.json',
        rollupConfig: {
          messages: {
            // This package doesn't use API Extractor's release-tag (@public
            // /@beta/@internal) curation workflow, so every export trips
            // ae-missing-release-tag / ae-forgotten-export. Everything else
            // stays at 'warning' so a genuine rollup failure is loud instead
            // of silently emitting an empty .d.ts (see afterRollup below).
            extractorMessageReporting: {
              default: { logLevel: ExtractorLogLevel.Warning },
              'ae-missing-release-tag': { logLevel: ExtractorLogLevel.None },
              'ae-forgotten-export': { logLevel: ExtractorLogLevel.None },
            },
            compilerMessageReporting: {
              default: { logLevel: ExtractorLogLevel.Warning },
            },
          },
        },
        afterRollup: (result) => {
          if (!result.succeeded) {
            throw new Error(
              `API Extractor failed to roll up type declarations (${result.errorCount} error(s), ${result.warningCount} warning(s)). Run the build with verbose logging to see the underlying messages.`,
            );
          }
        },
      }),
    !isStorybook &&
      viteStaticCopy({
        targets: [
          {
            src: 'src/assets/fonts/*',
            dest: 'fonts',
          },
        ],
      }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FUIComponents',
      fileName: (format) => `fui-components.${format}.js`,
    },
    rollupOptions: {
      external: (id) => {
        // Externalize all React and React-DOM imports, including subpaths like react/jsx-runtime
        if (/^react(\/.*)?$/.test(id) || /^react-dom(\/.*)?$/.test(id)) {
          return true;
        }
        // Externalize @xyflow/react imports (peer dependency for BaseNode component)
        if (/^@xyflow\/react(\/.*)?$/.test(id)) {
          return true;
        }
        // Externalize story files and their fixtures (not part of the library API)
        if (id.includes('.stories.')) {
          return true;
        }
        return false;
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@xyflow/react': 'ReactFlow',
        },
      },
    },
  },
  test: {
    // Global test reporters - generates reports for all test projects
    reporters: [
      'default', // Console output
      'junit', // JUnit XML report for CI/CD
    ],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    // Optional: Enable coverage reporting
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-results/coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/types.ts',
      ],
    },
    projects: [
      // Project 1: Storybook tests - tests stories directly in the DOM for basic rendering without errors via the addon
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
            viewport: {
              width: 1280,
              height: 720,
            },
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
        },
      },
    ],
  },
});
