import reactInternal from '@abbottland/eslint-config/react-internal.js';
import storybook from 'eslint-plugin-storybook'
import tseslint from 'typescript-eslint';

 
/** @type {import("eslint").Linter.Config} */
export default tseslint.config(
  reactInternal,
  storybook.configs['flat/recommended'],
);
