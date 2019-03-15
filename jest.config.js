const watchPathIgnorePatterns = ['<rootDir>/node_modules/'];
const testEnvironment = 'node';

module.exports = {
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
  projects: [{
    displayName: 'test',
    testEnvironment,
    // Hack because of broken jest https://github.com/facebook/jest/issues/8088
    watchPathIgnorePatterns,
  }, {
    displayName: 'linter',
    runner: 'jest-runner-eslint',
    testEnvironment,
    testMatch: ['<rootDir>/lib/**/*.js', '<rootDir>/test/**/*.js', '<rootDir>/jest.config.js'],
    // Hack because of broken jest https://github.com/facebook/jest/issues/8088
    watchPathIgnorePatterns,
  }],
  watchPlugins: ['jest-runner-eslint/watch-fix'],
};
