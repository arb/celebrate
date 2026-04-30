module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/lib/index.js'],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  // Workaround for jest --watch EMFILE on macOS without watchman.
  // See https://github.com/jestjs/jest/issues/8088
  watchPathIgnorePatterns: ['<rootDir>/node_modules/'],
};
