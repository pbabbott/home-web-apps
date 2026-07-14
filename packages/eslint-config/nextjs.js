import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import turboPlugin from 'eslint-plugin-turbo';

/**
 * A shared ESLint configuration for Next.js apps.
 *
 * @type {import("eslint").Linter.Config} */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'warn',
      quotes: ['error', 'single'],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
