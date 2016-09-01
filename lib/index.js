'use strict';

const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');

const validations = require('./schema');

const Celebrate = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    schema[key] = Joi.compile(schema[key]);
  }

  const validateSource = (source) => {
    return (req, callback) => {
      const spec = schema[source];

      if (!spec) {
        return callback(null);
      }

      Joi.validate(req[source], spec, options, (err, value) => {
        if (value !== undefined) {
          // Apply any Joi transforms back to the request
          req[source] = value;
        }
        return callback(err);
      });
    };
  };

  const validateBody = validateSource('body');

  return (req, res, next) => {
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
};

Celebrate.errors = () => {
  return (err, req, res, next) => {
    if (err.isJoi) {
      return res.status(400).send(err);
    }
    // If this isn't a Joi error, send it to the next error handler
    return next(err);
  };
};

module.exports = Celebrate;
