'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const EscapeHtml = require('escape-html');

const celebrateSymbol = Symbol('celebrated');
const defaultJoiOptions = {
  escapeHtml: true
};
// Source https://gist.github.com/jhorsman/62eeea161a13b80e39f5249281e17c39
const semverRegexp = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?$/;

const validateSource = source =>
  (config, next) => {
    const req = config.req;
    const options = config.options;
    const rules = config.rules;
    const Joi = config.Joi;
    const spec = rules.get(source);

    if (!spec) {
      return next(null);
    }
    const result = Joi.validate(req[source], spec, options);
    const value = result.value;
    const err = result.error;

    if (value !== undefined) {
      const descriptor = Object.getOwnPropertyDescriptor(req, source);
      /* istanbul ignore next */
      if (descriptor && descriptor.writable) {
        req[source] = value;
      } else {
        Object.defineProperty(req, source, {
          get() { return value; }
        });
      }
    }
    if (err) {
      err[celebrateSymbol] = true;
      err._meta = { source };
      return next(err);
    }
    return next(null);
  };

const validateHeaders = validateSource('headers');
const validateParams = validateSource('params');
const validateQuery = validateSource('query');
const validateBody = validateSource('body');
const maybeValidateBody = (config, callback) => {
  const method = config.req.method.toLowerCase();

  if (method === 'get' || method === 'head') {
    return callback(null);
  }

  return validateBody(config, callback);
};

const REQ_VALIDATIONS = [
  validateHeaders,
  validateParams,
  validateQuery,
  maybeValidateBody
];

const isCelebrate = (err) => {
  if (err != null && typeof err === 'object') { // eslint-disable-line eqeqeq
    return err[celebrateSymbol] || false;
  }
  return false;
};

const celebrate = (Joi) => {
  // Create this once at init time so we don't need to keep recreating it on every call
  const validations = Joi.object().keys({
    headers: Joi.any(),
    params: Joi.any(),
    query: Joi.any(),
    body: Joi.any()
  }).min(1);

  return (schema, options) => {
    const result = Joi.validate(schema || {}, validations);
    Assert.ifError(result.error);
    const rules = new Map();
    const joiOpts = Object.assign({}, defaultJoiOptions, options);

    const keys = Object.keys(schema);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      rules.set(key, Joi.compile(schema[key]));
    }
    const middleware = (req, res, next) => {
      Series(null, REQ_VALIDATIONS, {
        req,
        options: joiOpts,
        rules,
        Joi
      }, next);
    };

    middleware._schema = schema;

    return middleware;
  };
};

const errors = () => (err, req, res, next) => {
  if (isCelebrate(err)) {
    const error = {
      statusCode: 400,
      error: 'Bad Request',
      message: err.message,
      validation: {
        source: err._meta.source,
        keys: []
      }
    };

    if (err.details) {
      for (let i = 0; i < err.details.length; i += 1) {
        /* istanbul ignore next */
        const path = Array.isArray(err.details[i].path) ? err.details[i].path.join('.') : err.details[i].path;
        error.validation.keys.push(EscapeHtml(path));
      }
    }
    return res.status(400).send(error);
  }

  // If this isn't a Joi error, send it to the next error handler
  return next(err);
};

module.exports = function Celebrate(Joi) {
  const result = semverRegexp.exec(Joi.version);
  Assert.ok(result, 'Joi.version is not a valid semver');
  const version = parseInt(result[1], 10);
  Assert(version >= 10, 'Joi version must be greater than 9');
  return {
    celebrate: celebrate(Joi),
    Joi,
    errors,
    isCelebrate
  };
};
