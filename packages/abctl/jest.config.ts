/** @jest-config-loader ts-node -P tsconfig.test.json */

import type {Config} from 'jest'
import {unitTestPreset, jestReporters} from '@abbottland/jest-presets'

// NOTE: i had to override the default jest config to use ESM
// Its ok that this is not in the presets because this is the only package that uses ESM
const config: Config = {
  projects: [
    {
      ...unitTestPreset,
      extensionsToTreatAsEsm: ['.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            useESM: true,
            tsconfig: {
              module: 'Node16',
              moduleResolution: 'Node16',
              isolatedModules: true,
            },
          },
        ],
      },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
  ],
  reporters: jestReporters,
}

export default config
