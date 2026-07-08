/** @jest-config-loader ts-node -P tsconfig.test.json */

import type { Config } from 'jest';
import { smokeTestPreset, jestReporters } from '@abbottland/jest-presets';

const config: Config = {
  projects: [
    {
      ...smokeTestPreset,
      modulePathIgnorePatterns: [
        ...(smokeTestPreset.modulePathIgnorePatterns ?? []),
        '<rootDir>/.next',
      ],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
      },
    },
  ],
  reporters: jestReporters,
};

export default config;
