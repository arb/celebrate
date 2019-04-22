const Assert = require('assert');
const Joi = require('@hapi/joi');
const EscapeHtml = require('escape-html');
const { middlewareSchema, celebrateSchema } = require('./schema');

const CELEBRATED = Symbol('CELEBRATED');
const DEFAULT_JOI_OPTIONS = {
  escapeHtml: true,
};

const validateSource = source => ({
  celebrateOpts,
  joiOpts,
  req,
  rules,
}) => {
  const spec = rules.get(source);

  if (!spec) { return null; }
  const result = Joi.validate(req[source], spec, celebrateOpts.reqContext ? {
    ...joiOpts,
    context: req,
  } : joiOpts);
  const {
    value,
    error,
  } = result;

  if (value !== undefined) {
    Object.defineProperty(req, source, {
      value,
    });
  }
  if (error) {
    return {
      [CELEBRATED]: true,
      joi: error,
      meta: { source },
    };
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

const celebrate = (schema, joiOptions = {}, celebrateOptions = {}) => {
  let result = Joi.validate(schema, middlewareSchema);
  Assert.ifError(result.error);
  result = Joi.validate(celebrateOptions, celebrateSchema);
  Assert.ifError(result.error);
  const rules = new Map();
  const joiOpts = Object.assign({}, DEFAULT_JOI_OPTIONS, joiOptions);

  Object.entries(schema).forEach(([key, value]) => rules.set(key, Joi.compile(value)));

  const middleware = (req, res, next) => {
    let stepNumber = 0;
    let err = null;
    const config = {
      req,
      joiOpts,
      rules,
      celebrateOpts: celebrateOptions,
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

  const {
    joi,
    meta,
  } = err;

  const result = {
    statusCode: 400,
    error: 'Bad Request',
    message: joi.message,
    validation: {
      source: meta.source,
      keys: [],
    },
  };

  if (joi.details) {
    for (let i = 0; i < joi.details.length; i += 1) {
      const path = joi.details[i].path.join('.');
      result.validation.keys.push(EscapeHtml(path));
    }
  }
  return res.status(400).send(result);
};

module.exports = {
  celebrate,
  Joi,
  errors,
  isCelebrate,
};
