// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { defineConfig, globalIgnores } from 'eslint/config';
import storybook from 'eslint-plugin-storybook';
import reactInternal from '@abbottland/eslint-config/react-internal.js';

/** @type {import("eslint").Linter.Config} */
export default defineConfig([
  ...reactInternal,
  ...storybook.configs['flat/recommended'],
  globalIgnores(['dist', 'storybook-static']),
]);
