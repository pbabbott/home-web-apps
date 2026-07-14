import { defineConfig, globalIgnores } from 'eslint/config';
import reactInternal from '@abbottland/eslint-config/react-internal.js';

/** @type {import("eslint").Linter.Config} */
export default defineConfig([...reactInternal, globalIgnores(['dist'])]);
