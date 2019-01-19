module.exports = {
  projects: [{
    displayName: 'test',
    collectCoverage: true,
    collectCoverageFrom: ['lib/index.js'],
    coverageDirectory: './coverage',
    coverageThreshold: {
      global: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    testEnvironment: 'node',
    verbose: true,
  }, {
    runner: 'jest-runner-eslint',
    displayName: 'linter',
  }],
  watchPlugins: ['jest-runner-eslint/watch-fix'],
};
