/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import { unitTestPreset, jestReporters } from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    {
      ...unitTestPreset,
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
      },
    },
  ],
  reporters: jestReporters,
};

export default config;
