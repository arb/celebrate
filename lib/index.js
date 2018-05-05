'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');
const validations = require('./schema');

const CELEBRATED = Symbol('isCelebrate');
const DEFAULTS = {
  escapeHtml: true
};

const validateSource = source =>
  (config, next) => {
    const req = config.req;
    const options = config.options;
    const rules = config.rules;
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
      err[CELEBRATED] = true;
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
    return err[CELEBRATED] || false;
  }
  return false;
};

const celebrate = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);
  const rules = new Map();
  const joiOpts = Object.assign({}, DEFAULTS, options);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    rules.set(key, Joi.compile(schema[key]));
  }
  const celebrateMiddleware = (req, res, next) => {
    Series(null, REQ_VALIDATIONS, {
      req,
      options: joiOpts,
      rules
    }, next);
  };

  celebrateMiddleware._schema = schema;

  return celebrateMiddleware;
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

module.exports = {
  celebrate,
  Joi,
  errors,
  isCelebrate
};
