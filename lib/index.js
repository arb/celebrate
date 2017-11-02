'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');

const validations = require('./schema');

const Celebrate = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);
  const rules = new Map();

  const defaults = {
    escapeHtml: true
  };
  options = Object.assign(defaults, options);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    rules.set(key, Joi.compile(schema[key]));
  }

  const validateSource = (source) => {
    return (req, callback) => {
      const spec = rules.get(source);

      if (!spec) {
        return callback(null);
      }

      Joi.validate(req[source], spec, options, (err, value) => {
        if (value !== undefined) {
          // Apply any Joi transforms back to the request
          req[source] = value;
        }
        if (err) {
          err._meta = { source };
          return callback(err);
        }
        return callback(null);
      });
    };
  };

  const validateBody = validateSource('body');
  const middleware = (req, res, next) => {
    Series(null, [
      validateSource('headers'),
      validateSource('params'),
      validateSource('query'),
      function (req, callback) {
        const method = req.method.toLowerCase();
        if (method === 'get' || method === 'head') {
          return callback(null);
        }
        validateBody(req, callback);
      }
    ], req, next);
  };

  middleware._schema = schema;

  return middleware;
};

Celebrate.errors = () => {
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

Celebrate.Joi = Joi;

module.exports = Celebrate;
