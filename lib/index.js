const Assert = require('assert');
const Joi = require('joi');
const EscapeHtml = require('escape-html');
const { middlewareSchema } = require('./schema');

const CELEBRATED = Symbol('CELEBRATED');
const DEFAULT_JOI_OPTIONS = {
  escapeHtml: true,
};

const validateSource = source => (config) => {
  const {
    req,
    joiOpts,
    rules,
    celebrateOpts,
  } = config;
  const spec = rules.get(source);

  if (!spec) { return null; }
  const result = Joi.validate(req[source], spec, celebrateOpts.reqContext ? {
    ...joiOpts,
    context: req,
  } : joiOpts);
  const {
    value,
    error: err,
  } = result;

  if (value !== undefined) {
    Object.defineProperty(req, source, {
      value,
    });
  }
  if (err) {
    // While technically not documented,
    // this entire object is sent back so it's part of the public API
    err[CELEBRATED] = true;
    err._meta = { source };
    return err;
  }
  return null;
};

const validateHeaders = validateSource('headers');
const validateParams = validateSource('params');
const validateQuery = validateSource('query');
const validateCookies = validateSource('cookies');
const validateSignedCookies = validateSource('signedCookies');
const validateBody = validateSource('body');
const maybeValidateBody = (config, callback) => {
  const method = config.req.method.toLowerCase();

  if (method === 'get' || method === 'head') {
    return null;
  }

  return validateBody(config, callback);
};

const REQ_VALIDATIONS = [
  validateHeaders,
  validateParams,
  validateQuery,
  validateCookies,
  validateSignedCookies,
  maybeValidateBody,
];

const isCelebrate = (err) => {
  if (err != null && typeof err === 'object') {
    return err[CELEBRATED] || false;
  }
  return false;
};

const celebrate = (schema, joiOpts, celebrateOpts = {}) => {
  const result = Joi.validate(schema || {}, middlewareSchema);
  Assert.ifError(result.error);
  const rules = new Map();
  const _joiOpts = Object.assign({}, DEFAULT_JOI_OPTIONS, joiOpts);

  Object.entries(schema).forEach(([key, value]) => rules.set(key, Joi.compile(value)));

  const middleware = (req, res, next) => {
    let stepNumber = 0;
    let err = null;
    const config = {
      req,
      joiOpts: _joiOpts,
      rules,
      celebrateOpts,
    };
    do {
      const step = REQ_VALIDATIONS[stepNumber];
      err = step(config);
      stepNumber += 1;
    } while (stepNumber <= REQ_VALIDATIONS.length - 1 && err === null);
    next(err);
  };

  middleware._schema = schema;

  return middleware;
};

const errors = () => (err, req, res, next) => {
  // If this isn't a Celebrate error, send it to the next error handler
  if (!isCelebrate(err)) {
    return next(err);
  }

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
};

module.exports = {
  celebrate,
  Joi,
  errors,
  isCelebrate,
};
