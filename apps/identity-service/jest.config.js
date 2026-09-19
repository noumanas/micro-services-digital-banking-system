/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@digital-banking/shared$": "<rootDir>/../../../packages/shared/src",
    "^@digital-banking/config$": "<rootDir>/../../../packages/config/src",
    "^@digital-banking/events$": "<rootDir>/../../../packages/events/src",
    "^@digital-banking/auth$": "<rootDir>/../../../packages/auth/src",
    "^@digital-banking/observability$": "<rootDir>/../../../packages/observability/src",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
