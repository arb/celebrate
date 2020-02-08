const { peerDependencies } = require('./package.json');

module.exports = {
  extends: 'airbnb-base',
  env: {
    node: true
  },
  rules: {
    'no-underscore-dangle': 'off',

    'import/no-unresolved': [
      'error',
      { ignore: Object.keys(peerDependencies) },
    ]
  },
};
