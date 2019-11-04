const Assert = require('assert');
const Joi = require('@hapi/joi');
const EscapeHtml = require('escape-html');
const get = require('lodash.get');
const {
  middlewareSchema, celebrateSchema, sourceSchema, optSchema,
} = require('./schema');

const CELEBRATED = Symbol('celebrated');
const DEFAULT_FORMAT_OPTIONS = {
  celebrated: true,
};

const _format = (error, source, opts) => ({
  [CELEBRATED]: opts.celebrated,
  joi: error,
  meta: { source },
});

const format = (err, source, opts = { celebrated: false }) => {
  Assert.ok(get(err, 'error.isJoi', false));

  let result = sourceSchema.validate(source);
  Assert.ifError(result.error);
  result = optSchema.validate(opts);
  Assert.ifError(result.error);

  const {
    error,
  } = err;

  return _format(error, source, opts);
};

const validateSource = (source) => ({
  celebrateOpts,
  joiOpts,
  req,
  rules,
}) => new Promise((resolve, reject) => {
  const spec = rules.get(source);

  if (!spec) {
    resolve(null);
    return undefined;
  }
  const localOptions = celebrateOpts.reqContext ? {
    ...joiOpts,
    context: req,
    warnings: true,
  } : {
    ...joiOpts,
    warnings: true,
  };
  spec.validateAsync(req[source], localOptions).then(({ value }) => {
    if (value != null) {
      Object.defineProperty(req, source, {
        value,
      });
    }
    resolve(null);
  }).catch((e) => reject(_format(e, source, DEFAULT_FORMAT_OPTIONS)));
  return undefined;
});

const validateHeaders = validateSource('headers');
const validateParams = validateSource('params');
const validateQuery = validateSource('query');
const validateCookies = validateSource('cookies');
const validateSignedCookies = validateSource('signedCookies');
const validateBody = validateSource('body');
const maybeValidateBody = (config) => {
  const method = config.req.method.toLowerCase();

  if (method === 'get' || method === 'head') {
    return Promise.resolve(null);
  }

  return validateBody(config);
};

// const REQ_VALIDATIONS = {
//   headers: validateHeaders,
//   params: validateParams,
//   query: validateQuery,
//   cookies: validateCookies,
//   signedCookies: validateSignedCookies,
//   body: maybeValidateBody,
// }

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

const recurseOverValidations = (steps, config) => {
  const nextValidation = steps.shift();

  if (nextValidation) {
    return nextValidation(config).then(() => recurseOverValidations(steps, config));
  }
  return Promise.resolve(null);
};

const celebrate = (schema, joiOpts = {}, celebrateOptions = {}) => {
  let result = middlewareSchema.validate(schema);
  Assert.ifError(result.error);
  result = celebrateSchema.validate(celebrateOptions);
  Assert.ifError(result.error);
  const rules = new Map();
  Object.entries(schema).forEach(([key, value]) => rules.set(key, Joi.compile(value)));
  // const steps = Object.entries(schema).map(([key, value]) => {
  //   return {
  //     spec: Joi.compile(value),
  //     step: REQ_VALIDATIONS[key]
  //   }
  // });

  const middleware = (req, res, next) => {
    const config = {
      req,
      joiOpts,
      rules,
      celebrateOpts: celebrateOptions,
    };

    return recurseOverValidations([...REQ_VALIDATIONS], config)
      .then(next)
      .catch(next);

    // Return this promise just to make testing easier. This is NOT part of the
    // public API
    // return Promise.resolve()
    //   .then(() => validateHeaders(config))
    //   .then(() => validateParams(config))
    //   .then(() => validateQuery(config))
    //   .then(() => validateCookies(config))
    //   .then(() => validateSignedCookies(config))
    //   .then(() => maybeValidateBody(config))
    //   .then(next)
    //   .catch(next);
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
  errors,
  Joi,
  isCelebrate,
  format,
};
