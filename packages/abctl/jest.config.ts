/** @jest-config-loader ts-node -P tsconfig.test.json */

import type {Config} from 'jest'
import {unitTestPreset} from '@abbottland/jest-presets'

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
}

export default config
