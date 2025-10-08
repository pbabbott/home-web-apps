import type { Config } from 'jest';

const basePreset: Config = {
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
};

const unitTestPreset: Config = {
  ...basePreset,
  // Add or override unit-test-specific configurations
  displayName: 'unit',
  testMatch: ['**/*.unit.test.[jt]s?(x)'],
};

const integrationTestPreset: Config = {
  ...basePreset,
  displayName: 'integration',
  testMatch: ['**/*.integration.test.[jt]s?(x)'],
};

export { basePreset, unitTestPreset, integrationTestPreset };
