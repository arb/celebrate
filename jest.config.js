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
    testEnvironment: 'node',
  }, {
    displayName: 'linter',
    runner: 'jest-runner-eslint',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/lib/**/*.js', '<rootDir>/test/**/*.js', '<rootDir>/jest.config.js'],
  }],
  watchPlugins: ['jest-runner-eslint/watch-fix'],
};
