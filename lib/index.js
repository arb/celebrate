'use strict';

const Assert = require('assert');
const Insync = require('insync');
const Joi = require('joi');

const validations = require('./schema');

module.exports = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);

  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    schema[key] = Joi.compile(schema[key]);
  }

  return (req, res, next) => {
    const validateSource = (source, callback) => {
      const spec = schema[source];

      if (!spec) {
        return callback();
      }

      Joi.validate(req[source], spec, options, (err, value) => {
        if (value !== undefined) {
          // Apply any Joi transforms back to the request
          req[source] = value;
        }

        return callback(err);
      });
    };

    Insync.series([
      Insync.apply(validateSource, 'headers'),
      Insync.apply(validateSource, 'params'),
      Insync.apply(validateSource, 'query'),
      (next) => {
        const method = req.method.toLowerCase();
        if (method === 'get' || method === 'head') {
          return next();
        }
        validateSource('body', next);
      }
    ], next);
  };
};
