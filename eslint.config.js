const neostandard = require('neostandard');
const globals = require('globals');

module.exports = [
  ...neostandard({ noJsx: true, node: true, commonjs: true, semi: true }),
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
