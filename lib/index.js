const Assert = require('assert');
const HTTP = require('http');
const Joi = require('@hapi/joi');
const _ = require('lodash');
const EscapeHtml = require('escape-html');
const {
  CELEBRATEERROROPTSSCHEMA,
  CELEBRATEOPTSSCHEMA,
  REQUESTSCHEMA,
  SEGMENTSCHEMA,
  ERRORSOPTSSCHEMA,
} = require('./schema');
const { segments } = require('./constants');

const internals = {
  CELEBRATED: Symbol('celebrated'),
  DEFAULT_ERROR_ARGS: {
    celebrated: true,
  },
  DEFAULT_ERRORS_OPTS: {
    statusCode: 400,
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
      // This resolve is to emulate how Joi validates when there isn't an error. I'm doing this to
      // standardize the resolve value.
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

// Lifted this idea from https://bit.ly/2vf3Xe0
internals.check = (steps, requestRules, opts) => steps.reduce((chain, {
  validate: stepValidate,
  segment: stepSegment,
}) => chain.then(() => {
  // If there isn't a schema set up for this segment, early return
  const currentSegmentSchema = requestRules.get(stepSegment);
  if (!currentSegmentSchema) {
    return Promise.resolve(null);
  }

  return stepValidate(currentSegmentSchema, opts)
    .then(({ value }) => {
      if (value != null) {
        Object.defineProperty(opts.req, stepSegment, {
          value,
        });
      }
      return null;
    })
    .catch((e) => {
      throw new internals.CelebrateError(
        e,
        stepSegment,
        internals.DEFAULT_ERROR_ARGS,
      );
    });
}), Promise.resolve(null));

exports.celebrate = (_requestRules, joiOpts = {}, opts = {}) => {
  Joi.assert(_requestRules, REQUESTSCHEMA);
  Joi.assert(opts, CELEBRATEOPTSSCHEMA);

  // Compile all schemas in advance and only do it once
  const requestRules = Object.entries(_requestRules)
    .reduce((memo, [key, value]) => memo.set(key, Joi.compile(value)), new Map());

  const middleware = (req, res, next) => {
    const config = opts.reqContext ? {
      ...joiOpts,
      context: req,
      warnings: true,
    } : {
      ...joiOpts,
      warnings: true,
    };

    // This promise is not part of the public API; it's only here to make the tests cleaner
    return internals.check(internals.REQ_VALIDATIONS, requestRules, {
      config,
      req,
    }).then(next).catch(next);
  };

  middleware._schema = _requestRules;

  return middleware;
};

exports.isCelebrate = (err) => _.get(err, internals.CELEBRATED, false);

exports.errors = (opts = {}) => {
  const finalOpts = { ...internals.DEFAULT_ERRORS_OPTS, ...opts };
  Joi.assert(finalOpts, ERRORSOPTSSCHEMA);

  return (err, req, res, next) => {
  // If this isn't a Celebrate error, send it to the next error handler
    if (!exports.isCelebrate(err)) {
      return next(err);
    }

    const {
      joi,
      meta,
    } = err;

    const {
      statusCode,
    } = finalOpts;

    const details = Array.isArray(joi.details) ? joi.details : [];
    const result = {
      statusCode,
      error: HTTP.STATUS_CODES[statusCode],
      message: joi.message,
      validation: {
        source: meta.source,
        keys: details.map((detail) => EscapeHtml(detail.path.join('.'))),
      },
    };

    return res.status(statusCode).send(result);
  };
};

exports.CelebrateError = (error, segment, opts = { celebrated: false }) => {
  Assert.ok(error && error.isJoi, '"error" must be a Joi error');
  Joi.assert(segment, SEGMENTSCHEMA);
  Joi.assert(opts, CELEBRATEERROROPTSSCHEMA);
  return new internals.CelebrateError(error, segment, opts);
};

exports.Joi = Joi;
exports.Segments = segments;
exports.celebrator = _.curryRight(exports.celebrate, 3);
