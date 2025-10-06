import baseConfigs from './base.js';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */

export default tseslint.config(...baseConfigs);
