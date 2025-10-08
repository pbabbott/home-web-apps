/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset, integrationTestPreset],
};

export default config;
