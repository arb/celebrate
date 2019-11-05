const Assert = require('assert');
const Joi = require('@hapi/joi');
const EscapeHtml = require('escape-html');
const get = require('lodash.get');
const {
  middlewareSchema, celebrateSchema, sourceSchema, optSchema,
} = require('./schema');
const { segments } = require('./constants');

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

const validateSource = (source) => (spec) => ({
  config,
  req,
}) => new Promise((resolve, reject) => {
  spec.validateAsync(req[source], config).then(({ value }) => {
    if (value != null) {
      Object.defineProperty(req, source, {
        value,
      });
    }
    resolve(null);
  }).catch((e) => reject(_format(e, source, DEFAULT_FORMAT_OPTIONS)));
});

const validateBody = validateSource(segments.BODY);
const maybeValidateBody = (spec) => (opts) => {
  const method = opts.req.method.toLowerCase();

  if (method === 'get' || method === 'head') {
    return Promise.resolve(null);
  }

  return validateBody(spec)(opts);
};

// Map of segments to validation functions.
// The key order is the order validations will run in.
const REQ_VALIDATIONS = new Map([
  [segments.HEADERS, validateSource(segments.HEADERS)],
  [segments.PARAMS, validateSource(segments.PARAMS)],
  [segments.QUERY, validateSource(segments.QUERY)],
  [segments.COOKIES, validateSource(segments.COOKIES)],
  [segments.SIGNEDCOOKIES, validateSource(segments.SIGNEDCOOKIES)],
  [segments.BODY, maybeValidateBody],
]);

const isCelebrate = (err) => {
  if (err != null && typeof err === 'object') {
    return err[CELEBRATED] || false;
  }
  return false;
};

const check = (steps, opts) => {
  const step = steps.shift();

  if (step) {
    return step(opts).then(() => check(steps, opts));
  }
  // If we get here, all the promises have resolved
  // and so we have a final resolve to end the recursion
  return Promise.resolve(null);
};

const celebrate = (schema, joiOpts = {}, celebrateOptions = {}) => {
  let result = middlewareSchema.validate(schema);
  Assert.ifError(result.error);
  result = celebrateSchema.validate(celebrateOptions);
  Assert.ifError(result.error);

  const steps = [];
  REQ_VALIDATIONS.forEach((value, key) => {
    const spec = schema[key];
    if (spec) {
      steps.push(value(Joi.compile(spec)));
    }
  });

  const middleware = (req, res, next) => {
    const finalConfig = celebrateOptions.reqContext ? {
      ...joiOpts,
      context: req,
      warnings: true,
    } : {
      ...joiOpts,
      warnings: true,
    };

    return check(steps, {
      config: finalConfig,
      req,
    })
      .then(next)
      .catch(next);
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
