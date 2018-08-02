module.exports = {
  verbose: true,
  testURL: 'http://localhost/',
  collectCoverageFrom: ['lib/index.js'],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
