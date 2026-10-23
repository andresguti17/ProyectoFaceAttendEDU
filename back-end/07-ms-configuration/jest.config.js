/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  // Coverage (npm test -- --coverage) counts every source file, not only the ones tests import.
  collectCoverageFrom: ["src/**/*.ts", "!src/**/__tests__/**", "!src/**/*.test.ts"],
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  // Measured line coverage, rounded down; raise it as tests grow (goal: 70%, tdd-guide).
  coverageThreshold: { global: { lines: 20 } },
};
