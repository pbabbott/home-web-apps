/** @jest-config-loader ts-node -P tsconfig.test.json */
import type { Config } from 'jest';
import { unitTestPreset } from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset],
};

export default config;
