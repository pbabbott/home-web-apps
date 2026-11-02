/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
  jestReporters,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    unitTestPreset,
    {
      ...integrationTestPreset,
      setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.ts'],
      // The self-hosted CI runners are several times slower than a workstation.
      testTimeout: 30_000,
    },
  ],
  reporters: jestReporters,
};

export default config;
