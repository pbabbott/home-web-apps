/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    unitTestPreset,
    {
      ...integrationTestPreset,
      setupFilesAfterEnv: ['<rootDir>/tests/jest.integration.setup.ts'],
    },
  ],
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results/junit',
        outputName: 'results.xml',
      },
    ],
  ],
};

export default config;
