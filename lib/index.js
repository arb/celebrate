const Assert = require('assert');
const Joi = require('@hapi/joi');
const EscapeHtml = require('escape-html');
const {
  middlewareSchema,
  celebrateSchema,
  sourceSchema,
  optSchema,
} = require('./schema');
const { segments } = require('./constants');

const internals = {
  CELEBRATED: Symbol('celebrated'),
  DEFAULT_FORMAT_OPTIONS: {
    celebrated: true,
  },
};

internals.format = (error, segment, opts) => ({
  [internals.CELEBRATED]: opts.celebrated,
  joi: error,
  meta: { source: segment },
});

internals.validateSource = (segment) => (spec) => ({
  config,
  req,
}) => new Promise((resolve, reject) => {
  spec.validateAsync(req[segment], config).then(({ value }) => {
    if (value != null) {
      Object.defineProperty(req, segment, {
        value,
      });
    }
    resolve(null);
  }).catch((e) => reject(internals.format(e, segment, internals.DEFAULT_FORMAT_OPTIONS)));
});

internals.validateBody = internals.validateSource(segments.BODY);
internals.maybeValidateBody = (spec) => (opts) => {
  const method = opts.req.method.toLowerCase();

  if (method === 'get' || method === 'head') {
    return Promise.resolve(null);
  }

  return internals.validateBody(spec)(opts);
};

// Map of segments to validation functions.
// The key order is the order validations will run in.
internals.REQ_VALIDATIONS = new Map([
  [segments.HEADERS, internals.validateSource(segments.HEADERS)],
  [segments.PARAMS, internals.validateSource(segments.PARAMS)],
  [segments.QUERY, internals.validateSource(segments.QUERY)],
  [segments.COOKIES, internals.validateSource(segments.COOKIES)],
  [segments.SIGNEDCOOKIES, internals.validateSource(segments.SIGNEDCOOKIES)],
  [segments.BODY, internals.maybeValidateBody],
]);

internals.check = (steps, opts) => {
  const step = steps.shift();

  if (step) {
    return step(opts).then(() => internals.check(steps, opts));
  }
  // If we get here, all the promises have resolved
  // and so we have a final resolve to end the recursion
  return Promise.resolve(null);
};

exports.celebrate = (schema, joiOpts = {}, celebrateOptions = {}) => {
  let result = middlewareSchema.validate(schema);
  Assert.ifError(result.error);
  result = celebrateSchema.validate(celebrateOptions);
  Assert.ifError(result.error);

  const steps = [];
  internals.REQ_VALIDATIONS.forEach((value, segment) => {
    const spec = schema[segment];
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

    return internals.check(steps, {
      config: finalConfig,
      req,
    })
      .then(next)
      .catch(next);
  };

  middleware._schema = schema;

  return middleware;
};

exports.isCelebrate = (err) => {
  if (err != null && typeof err === 'object') {
    return err[internals.CELEBRATED] || false;
  }
  return false;
};

exports.errors = () => (err, req, res, next) => {
  // If this isn't a Celebrate error, send it to the next error handler
  if (!exports.isCelebrate(err)) {
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

exports.format = (error, segment, opts = { celebrated: false }) => {
  Assert.ok(error.isJoi);

  let result = sourceSchema.validate(segment);
  Assert.ifError(result.error);
  result = optSchema.validate(opts);
  Assert.ifError(result.error);

  return internals.format(error, segment, opts);
};

exports.Joi = Joi;
exports.Segments = segments;
