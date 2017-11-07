'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');

const validations = require('./schema');
const isCelebrate = Symbol('isCelebrate');
const DEFAULTS = {
  escapeHtml: true
};

const validateSource = (source) => {
  return (config, next) => {
    const req = config.req;
    const options = config.options;
    const rules = config.rules;
    const spec = rules.get(source);

    if (!spec) {
      return next(null);
    }
    Joi.validate(req[source], spec, options, (err, value) => {
      if (value !== undefined) {
        const descriptor = Object.getOwnPropertyDescriptor(req, source);
        /* istanbul ignore next */
        if (descriptor && descriptor.writable) {
          req[source] = value;
        } else {
          Object.defineProperty(req, source, {
            get () { return value; }
          });
        }
      }
      if (err) {
        err[isCelebrate] = true;
        err._meta = { source };
        return next(err);
      }
      return next(null);
    });
  };
};

const validateHeaders = validateSource('headers');
const validateParams = validateSource('params');
const validateQuery = validateSource('query');
const validateBody = validateSource('body');

const celebrate = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);
  const rules = new Map();
  options = Object.assign({}, DEFAULTS, options);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    rules.set(key, Joi.compile(schema[key]));
  }
  const middleware = (req, res, next) => {
    Series(null, [
      validateHeaders,
      validateParams,
      validateQuery,
      (config, callback) => {
        const method = config.req.method.toLowerCase();
        if (method === 'get' || method === 'head') {
          return callback(null);
        }
        validateBody(config, callback);
      }
    ], {
      req,
      options,
      rules
    }, next);
  };

  middleware._schema = schema;

  return middleware;
};

const errors = () => {
  return (err, req, res, next) => {
    if (err[isCelebrate]) {
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
        for (var i = 0; i < err.details.length; i++) {
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
};


module.exports = {
  celebrate,
  Joi,
  errors
};
