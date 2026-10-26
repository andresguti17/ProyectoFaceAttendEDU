/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  // fastify 5 injects through light-my-request, whose `cookie` dependency ships ESM only.
  transform: { "^.+\\.[tj]s$":["ts-jest", { tsconfig: "tsconfig.jest.json" }] },
  transformIgnorePatterns: ["/node_modules/(?!cookie/)"],
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  // Coverage (npm test -- --coverage) counts every source file, not only the ones tests import.
  collectCoverageFrom: ["src/**/*.ts", "!src/**/__tests__/**", "!src/**/*.test.ts"],
  coverageReporters: ["text-summary", "json-summary", "lcov"],
  // Measured line coverage, rounded down; raise it as tests grow (goal: 70%, tdd-guide).
  coverageThreshold: { global: { lines: 76 } },
};
