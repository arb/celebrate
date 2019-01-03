module.exports = {
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
};
