const Series = require('fastseries')({ results: true });
const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');
const validations = require('./schema');

const CELEBRATED = Symbol('isCelebrate');
const DEFAULTS = {
  escapeHtml: true,
};

const validateSource = source =>
  (config, next) => {
    const {
      req,
      options,
      rules,
    } = config;
    const spec = rules.get(source);

    if (!spec) {
      return next(null);
    }
    const result = Joi.validate(req[source], spec, options);
    const {
      value,
      error: err,
    } = result;

    if (value !== undefined) {
      const descriptor = Object.getOwnPropertyDescriptor(req, source);
      /* istanbul ignore next */
      if (descriptor && descriptor.writable) {
        req[source] = value;
      } else {
        Object.defineProperty(req, source, {
          get() { return value; },
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
  maybeValidateBody,
];

const isCelebrate = (err) => {
  if (err != null && typeof err === 'object') {
    return err[CELEBRATED] || false;
  }
  return false;
};

const celebrate = (schema, options) => {
  const result = Joi.validate(schema || {}, validations.schema);
  Assert.ifError(result.error);
  const rules = new Map();
  const joiOpts = Object.assign({}, DEFAULTS, options);

  Object.keys(schema).forEach((key) => {
    rules.set(key, Joi.compile(schema[key]));
  });
  const middleware = (req, res, next) => {
    Series(null, REQ_VALIDATIONS, {
      req,
      options: joiOpts,
      rules,
    }, next);
  };

  middleware._schema = schema;

  return middleware;
};

const errors = () => (err, req, res, next) => {
  if (isCelebrate(err)) {
    const error = {
      statusCode: 400,
      error: 'Bad Request',
      message: err.message,
      validation: {
        source: err._meta.source,
        keys: [],
      },
    };

    if (err.details) {
      for (let i = 0; i < err.details.length; i += 1) {
        const path = err.details[i].path.join('.');
        error.validation.keys.push(EscapeHtml(path));
      }
    }
    return res.status(400).send(error);
  }

  // If this isn't a Celebrate error, send it to the next error handler
  return next(err);
};

module.exports = {
  celebrate,
  Joi,
  errors,
  isCelebrate,
};
