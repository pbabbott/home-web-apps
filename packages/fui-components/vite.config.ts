/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      tsconfigPath: './tsconfig.build.json',
    }),
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
        return false;
      },
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  test: {
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
