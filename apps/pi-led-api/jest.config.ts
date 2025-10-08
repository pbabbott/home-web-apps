/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import {
  unitTestPreset,
  integrationTestPreset,
} from '@abbottland/jest-presets';

const config: Config = {
  projects: [unitTestPreset, integrationTestPreset],
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
