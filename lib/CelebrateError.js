import Assert from 'node:assert';

const internals = {
  CELEBRATED: Symbol('celebrated'),
};

internals.Details = class extends Map {
  set (key, value) {
    Assert.ok(value?.isJoi === true, 'value must be a joi validation error');
    super.set(key, value);
  }
};

export class CelebrateError extends Error {
  constructor (message = 'Validation failed', opts = {}) {
    super(message);
    this.details = new internals.Details();
    this[internals.CELEBRATED] = Boolean(opts.celebrated);
  }
}

export const isCelebrateError = (err) => err?.[internals.CELEBRATED] === true;
