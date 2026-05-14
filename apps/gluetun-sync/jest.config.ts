/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
  smokeTestPreset,
  jestReporters,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    unitTestPreset,
    {
      ...integrationTestPreset,
      setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.ts'],
    },
    smokeTestPreset,
  ],
  reporters: jestReporters,
};

export default config;
