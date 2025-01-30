import library from '@abbottland/eslint-config/library.js';
import tseslint from 'typescript-eslint';
 
/** @type {import("eslint").Linter.Config} */
export default tseslint.config(library);