const Assert = require('node:assert');

const internals = {
  CELEBRATED: Symbol('celebrated'),
};

internals.Details = class extends Map {
  set (key, value) {
    Assert.ok(value?.isJoi === true, 'value must be a joi validation error');
    super.set(key, value);
  }
};

exports.CelebrateError = class extends Error {
  constructor (message = 'Validation failed', opts = {}) {
    super(message);
    this.details = new internals.Details();
    this[internals.CELEBRATED] = Boolean(opts.celebrated);
  }
};

exports.isCelebrateError = (err) => err?.[internals.CELEBRATED] === true;
