
const basePreset = {
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePathIgnorePatterns: [
    "<rootDir>/test/__fixtures__",
    "<rootDir>/node_modules",
    "<rootDir>/dist",
  ],
  preset: "ts-jest",
  detectOpenHandles: true,
};

const unitTestPreset = {
  ...basePreset,
  // Add or override unit-test-specific configurations
  displayName: "unit-tests",
  testPathIgnorePatterns: ["/tests/integration/"], // Ignore integration tests

};

const integrationTestPreset = {
  ...basePreset,
  setupFilesAfterEnv: ["<rootDir>/tests/jest.integration.setup.ts"], // Add global setup for integration tests
  displayName: "integration-tests",
  testMatch: ["**/tests/integration/**/*.[jt]s?(x)"], // Only include integration tests
};

module.exports = {
  basePreset,
  unitTestPreset,
  integrationTestPreset,
};