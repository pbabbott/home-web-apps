import type { Config } from 'jest';

const createBasePreset = (testType: string): Config => ({
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePathIgnorePatterns: [
    '<rootDir>/test/__fixtures__',
    '<rootDir>/node_modules',
    '<rootDir>/dist',
  ],
  preset: 'ts-jest',
});

const unitTestPreset: Config = {
  ...createBasePreset('unit'),
  // Add or override unit-test-specific configurations
  displayName: 'unit',
  testMatch: ['**/*.unit.test.[jt]s?(x)'],
};

const integrationTestPreset: Config = {
  ...createBasePreset('integration'),
  displayName: 'integration',
  testMatch: ['**/*.integration.test.[jt]s?(x)'],
};

const e2eTestPreset: Config = {
  ...createBasePreset('e2e'),
  displayName: 'e2e',
  testMatch: ['**/*.e2e.test.[jt]s?(x)'],
};

// Only run reporters in CI
const jestReporters: Config['reporters'] = process.env.CI
  ? [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: './test-results',
          outputName: 'test-results.xml',
          suiteName: 'Tests',
          classNameTemplate: '{classname} ({displayName})',
        },
      ],
    ]
  : undefined;

export { unitTestPreset, integrationTestPreset, e2eTestPreset, jestReporters };
