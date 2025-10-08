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
  detectOpenHandles: true,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: `./test-results/${testType}`,
        outputName: `${testType}-results.xml`,
        suiteName: `${testType} tests`,
        classNameTemplate: `{classname} (${testType})`,
      },
    ],
  ],
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

export { unitTestPreset, integrationTestPreset, e2eTestPreset };
