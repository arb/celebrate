'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');

const get = require('lodash/get');
const set = require('lodash/set');
const pick = require('lodash/pick');

const validations = require('./schema');
const defaults = {
  escapeHtml: true
};

const SEGMENT = ['locals', 'celebrate'];

const validateSource = (source) => {
  return (config, next) => {
    const req = config.req;
    const res = config.res;
    const options = config.options;
    const rules = config.rules;
    const spec = rules.get(source);
    const path = SEGMENT.concat(source);

    // copy it over so you can go to the same place for everything
    set(res, path, req[source]);

    if (!spec) {
      return next(null);
    }
    Joi.validate(req[source], spec, options, (err, value) => {
      if (value !== undefined) {
        // Apply any Joi transforms back to
        set(res, path, value);
      }
      if (err) {
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

  options = Object.assign(defaults, options);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    rules.set(key, Joi.compile(schema[key]));
  }

  const middleware = (req, res, next) => {
    set(res, SEGMENT, {});
    const config = {
      req,
      res,
      options,
      rules
    };
    Series(null, [
      validateHeaders,
      validateParams,
      validateQuery,
      function (config, callback) {
        const req = config.req;
        const method = req.method.toLowerCase();
        if (method === 'get' || method === 'head') {
          return callback(null);
        }
        validateBody(config, callback);
      }
    ], config, next);
  };

  middleware._schema = schema;

  return middleware;
};

const errors = () => {
  return (err, req, res, next) => {
    if (err.isJoi) {
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

const values = (res, req) => {
  req = req || {};
  return get(res, SEGMENT, pick(req, ['headers', 'params', 'query', 'body']));
};

module.exports = {
  celebrate,
  errors,
  Joi,
  values
};
