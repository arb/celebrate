/* eslint-disable max-classes-per-file */
const Assert = require('assert');
const _ = require('lodash');

const internals = {
  CELEBRATED: Symbol('celebrated'),
};

internals.Details = class extends Map {
  set(key, value) {
    Assert.ok(_.get(value, 'isJoi', false), 'value must be a joi validation error');
    super.set(key, value);
  }
};

exports.CelebrateError = class extends Error {
  constructor(message = 'celebrate request validation failed', opts = {}) {
    super(message);
    this.details = new internals.Details();
    this[internals.CELEBRATED] = Boolean(opts.celebrated);
  }
};

exports.isCelebrateError = (err) => _.get(err, internals.CELEBRATED, false);
