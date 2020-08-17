const HTTP = require('http');
const Joi = require('@hapi/joi');
const _ = require('lodash');
const EscapeHtml = require('escape-html');
const {
  CELEBRATEOPTSSCHEMA,
  REQUESTSCHEMA,
  ERRORSOPTSSCHEMA,
} = require('./schema');
const { segments, validateModes } = require('./constants');

const internals = {
  CELEBRATED: Symbol('celebrated'),
  DEFAULT_ERROR_ARGS: {
    celebrated: true,
  },
  DEFAULT_ERRORS_OPTS: {
    statusCode: 400,
  },
  DEFAULT_CELEBRATE_OPTS: {
    validateMode: validateModes.FAST,
  },
};

internals.validateSegment = (segment) => (spec, joiConfig) => {
  const finalValidate = (req) => spec.validateAsync(req[segment], joiConfig);
  finalValidate.segment = segment;
  return finalValidate;
};

internals.maybeValidateBody = (segment) => {
  const validateOne = internals.validateSegment(segment);
  return (spec, joiConfig) => {
    const validateBody = validateOne(spec, joiConfig);
    const finalValidate = (req) => {
      const method = req.method.toLowerCase();

      if (method === 'get' || method === 'head') {
        // This resolve is to emulate how Joi validates when there isn't an error. I'm doing this to
        // standardize the resolve value.
        return Promise.resolve({
          value: null,
        });
      }

      return validateBody(req);
    };
    finalValidate.segment = segment;
    return finalValidate;
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
// eslint-disable-next-line max-len
internals.partialValidate = (steps, req) => steps.reduce((chain, validate) => chain.then(() => validate(req)
  .then(({ value }) => {
    if (value != null) {
      Object.defineProperty(req, validate.segment, {
        value,
      });
    }
    return null;
  })
  .catch((e) => {
    const error = new exports.CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);
    error.add(validate.segment, e);
    throw error;
  })), Promise.resolve(null));

internals.fullValidate = (steps, req) => {
  const requestUpdates = [];
  const error = new exports.CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);
  return Promise.all(steps.map((validate) => validate(req)
    .then(({ value }) => {
      if (value != null) {
        requestUpdates.push([validate.segment, value]);
      }
      return null;
    })
    .catch((e) => {
      error.add(validate.segment, e);
      return null;
    }))).then(() => {
    if (error.details.size) {
      return Promise.reject(error);
    }

    // If the request is valid, apply the updates
    requestUpdates.forEach(([segment, value]) => {
      Object.defineProperty(req, segment, {
        value,
      });
    });

    return null;
  });
};

internals.validateFns = {
  [validateModes.FULL]: internals.fullValidate,
  [validateModes.FAST]: internals.partialValidate,
};

exports.CelebrateError = class extends Error {
  constructor(message = 'celebrate validation failed', opts) {
    super(message);
    this.details = new Map();
    this[internals.CELEBRATED] = opts.celebrated;
  }

  add(segment, joiError) {
    this.details.set(segment, joiError);
  }
};

exports.celebrate = (_requestRules, joiOpts = {}, opts = {}) => {
  Joi.assert(_requestRules, REQUESTSCHEMA);
  Joi.assert(opts, CELEBRATEOPTSSCHEMA);

  const finalOpts = {
    ...internals.DEFAULT_CELEBRATE_OPTS,
    ...opts,
  };

  // Compile all schemas in advance and only do it once
  const requestRules = Object.entries(_requestRules)
    .reduce((memo, [key, value]) => memo.set(key, Joi.compile(value)), new Map());

  const middleware = (req, res, next) => {
    const joiConfig = finalOpts.reqContext ? {
      ...joiOpts,
      context: req,
      warnings: true,
    } : {
      ...joiOpts,
      warnings: true,
    };

    const steps = internals.REQ_VALIDATIONS.reduce((memo, { segment, validate }) => {
      // If there isn't a schema set up for this segment, early return
      const currentSegmentSpec = requestRules.get(segment);
      if (currentSegmentSpec) {
        memo.push(validate(currentSegmentSpec, joiConfig));
      }
      return memo;
    }, []);

    const v = internals.validateFns[finalOpts.validateMode];

    // This promise is not part of the public API; it's only here to make the tests cleaner
    return v(steps, req).then(next).catch(next);
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
      statusCode,
    } = finalOpts;

    const validation = {};
    err.details.forEach((joiError, segment) => {
      const instance = Array.isArray(joiError.details) ? joiError.details : [];

      instance[segment] = {
        source: segment,
        keys: instance.map((detail) => EscapeHtml(detail.path.join('.'))),
        message: joiError.message,
      };
    });

    const result = {
      statusCode,
      error: HTTP.STATUS_CODES[statusCode],
      message: err.message,
      validation,
    };

    return res.status(statusCode).send(result);
  };
};

exports.Joi = Joi;
exports.Segments = segments;
exports.celebrator = _.curryRight(exports.celebrate, 3);
