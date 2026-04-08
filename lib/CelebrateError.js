/* eslint-disable max-classes-per-file */
const Assert = require('assert');

const internals = {
  CELEBRATED: Symbol('celebrated'),
};

internals.Details = class extends Map {
  set(key, value) {
    Assert.ok(value && value.isJoi, 'value must be a joi validation error');
    super.set(key, value);
  }
};

exports.CelebrateError = class extends Error {
  constructor(message = 'Validation failed', opts = {}) {
    super(message);
    this.details = new internals.Details();
    this[internals.CELEBRATED] = Boolean(opts.celebrated);
  }
};

exports.isCelebrateError = (err) => Boolean(err && err[internals.CELEBRATED]);
