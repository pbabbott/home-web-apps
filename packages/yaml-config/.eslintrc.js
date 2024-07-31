/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@abbottland/eslint-config/library.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  ignorePatterns: ["**/__tests__/"],
};
