/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
  e2eTestPreset,
  jestReporters,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    unitTestPreset,
    {
      ...integrationTestPreset,
      setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.ts'],
    },
    e2eTestPreset,
  ],
  reporters: jestReporters,
};

export default config;
