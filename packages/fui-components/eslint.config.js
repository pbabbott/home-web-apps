import reactInternal from '@abbottland/eslint-config/react-internal.js';
import storybook from 'eslint-plugin-storybook'
 
/** @type {import("eslint").Linter.Config} */
export default [
  ...reactInternal,
  ...storybook.configs['flat/recommended'],
]
