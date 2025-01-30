import server from '@abbottland/eslint-config/server.js';
import tseslint from 'typescript-eslint';
 
/** @type {import("eslint").Linter.Config} */
export default tseslint.config(server);