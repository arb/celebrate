import neostandard from 'neostandard';
import globals from 'globals';

export default [
  ...neostandard({ noJsx: true, node: true, semi: true }),
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
