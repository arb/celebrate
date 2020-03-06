const Assert = require('assert');
const Joi = require('@hapi/joi');
const EscapeHtml = require('escape-html');
const {
  celebrateErrorOptsSchema,
  celebrateOptsSchema,
  requestSchema,
  segmentSchema,
} = require('./schema');
const { segments } = require('./constants');

const internals = {
  CELEBRATED: Symbol('celebrated'),
  DEFAULT_ERROR_ARGS: {
    celebrated: true,
  },
};

internals.CelebrateError = class extends Error {
  constructor(joiError, segment, opts) {
    super(joiError.message);
    this.joi = joiError;
    this.meta = { source: segment };
    this[internals.CELEBRATED] = opts.celebrated;
  }
};

internals.validateSegment = (segment) => (spec, {
  config,
  req,
}) => spec.validateAsync(req[segment], config);

internals.maybeValidateBody = (segment) => {
  const validateBody = internals.validateSegment(segment);
  return (spec, opts) => {
    const method = opts.req.method.toLowerCase();

    if (method === 'get' || method === 'head') {
      return Promise.resolve({
        value: null,
      });
    }

    return validateBody(spec, opts);
  };
};

internals.REQ_VALIDATIONS = [
  {
    segment: segments.HEADERS,
    validate: internals.validateSegment(segments.HEADERS),
  },
  {
    segment: segments.PARAMS,
    validate: internals.validateSegment(segments.PARAMS),
  },
  {
    segment: segments.QUERY,
    validate: internals.validateSegment(segments.QUERY),
  },
  {
    segment: segments.COOKIES,
    validate: internals.validateSegment(segments.COOKIES),
  },
  {
    segment: segments.SIGNEDCOOKIES,
    validate: internals.validateSegment(segments.SIGNEDCOOKIES),
  },
  {
    segment: segments.BODY,
    validate: internals.maybeValidateBody(segments.BODY),
  },
];

internals.check = (steps, requestRules, opts) => steps.reduce((chain, {
  validate,
  segment,
}) => chain.then(() => {
  const segmentRule = requestRules[segment];
  if (segmentRule) {
    return validate(Joi.compile(segmentRule), opts)
      .then(({ value }) => {
        if (value != null) {
          Object.defineProperty(opts.req, segment, {
            value,
          });
        }
        return null;
      })
      .catch((e) => {
        throw new internals.CelebrateError(
          e,
          segment,
          internals.DEFAULT_ERROR_ARGS,
        );
      });
  }
  return Promise.resolve(null);
}), Promise.resolve(null));

exports.celebrate = (requestRules, joiOpts = {}, opts = {}) => {
  Joi.assert(requestRules, requestSchema);
  Joi.assert(opts, celebrateOptsSchema);

  const middleware = (req, res, next) => {
    const finalConfig = opts.reqContext ? {
      ...joiOpts,
      context: req,
      warnings: true,
    } : {
      ...joiOpts,
      warnings: true,
    };

    return internals.check(internals.REQ_VALIDATIONS, requestRules, {
      config: finalConfig,
      req,
    }).then(next).catch(next);
  };

  middleware._schema = requestRules;

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

exports.CelebrateError = (error, segment, opts = { celebrated: false }) => {
  Assert.ok(error && error.isJoi, '"error" must be a Joi error');
  Joi.assert(segment, segmentSchema);
  Joi.assert(opts, celebrateErrorOptsSchema);
  return new internals.CelebrateError(error, segment, opts);
};

exports.Joi = Joi;
exports.Segments = segments;
