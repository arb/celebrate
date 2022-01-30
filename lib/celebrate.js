const HTTP = require('http');
const Joi = require('joi');
const _ = require('lodash');
const EscapeHtml = require('escape-html');
const {
  CELEBRATEOPTSSCHEMA,
  REQUESTSCHEMA,
  ERRORSOPTSSCHEMA,
} = require('./schema');
const { segments, modes } = require('./constants');
const {
  CelebrateError,
  isCelebrateError,
} = require('./CelebrateError');

const internals = {
  DEFAULT_ERROR_ARGS: {
    celebrated: true,
  },
  DEFAULT_ERRORS_OPTS: {
    statusCode: 400,
  },
  DEFAULT_CELEBRATE_OPTS: {
    mode: modes.PARTIAL,
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
    const error = new CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);
    error.details.set(validate.segment, e);
    throw error;
  })), Promise.resolve(null));

internals.fullValidate = (steps, req) => {
  const requestUpdates = [];
  const error = new CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);
  return Promise.all(steps.map((validate) => validate(req)
    .then(({ value }) => {
      if (value != null) {
        requestUpdates.push([validate.segment, value]);
      }
      return null;
    })
    .catch((e) => {
      error.details.set(validate.segment, e);
      return null;
    }))).then(() => {
    if (error.details.size) {
      return Promise.reject(error);
    }

    // If the request is valid, apply the updates
    requestUpdates.forEach((result) => {
      Object.defineProperty(req, result[0], {
        value: result[1],
      });
    });

    return null;
  });
};

internals.validateFns = {
  [modes.FULL]: internals.fullValidate,
  [modes.PARTIAL]: internals.partialValidate,
};

exports.celebrate = (_requestRules, joiOpts = {}, opts = {}) => {
  Joi.assert(_requestRules, REQUESTSCHEMA);
  Joi.assert(opts, CELEBRATEOPTSSCHEMA);

  // create this as a function because then it'll get sealed
  const finalOpts = {
    ...internals.DEFAULT_CELEBRATE_OPTS,
    ...opts,
  };

  // Compile all schemas in advance and only do it once
  const requestRules = new Map();
  Object.entries(_requestRules)
    .reduce((memo, [key, value]) => memo.set(key, Joi.compile(value)), requestRules);

  const middleware = (req, res, next) => {
    const joiConfig = finalOpts.reqContext ? {
      ...joiOpts,
      context: req,
      warnings: true,
    } : {
      ...joiOpts,
      warnings: true,
    };

    const steps = [];
    internals.REQ_VALIDATIONS.forEach((value) => {
      // If there isn't a schema set up for this segment, early return
      const currentSegmentSpec = requestRules.get(value.segment);
      if (currentSegmentSpec) {
        steps.push(value.validate(currentSegmentSpec, joiConfig));
      }
    });

    const validateRequest = internals.validateFns[finalOpts.mode];

    // This promise is not part of the public API; it's only here to make the tests cleaner
    return validateRequest(steps, req).then(next).catch(next);
  };

  middleware._schema = _requestRules;

  return middleware;
};

exports.errors = (opts = {}) => {
  const finalOpts = { ...internals.DEFAULT_ERRORS_OPTS, ...opts };
  Joi.assert(finalOpts, ERRORSOPTSSCHEMA);

  return (err, req, res, next) => {
  // If this isn't a Celebrate error, send it to the next error handler
    if (!isCelebrateError(err)) {
      return next(err);
    }

    const {
      statusCode,
      message,
    } = finalOpts;

    const validation = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const [segment, joiError] of err.details.entries()) {
      validation[segment] = {
        source: segment,
        keys: joiError.details.map((detail) => EscapeHtml(detail.path.join('.'))),
        message: joiError.message,
      };
    }

    const result = {
      statusCode,
      error: HTTP.STATUS_CODES[statusCode],
      message: message || err.message,
      validation,
    };

    return res.status(statusCode).send(result);
  };
};

exports.Joi = Joi;
exports.Segments = segments;
exports.celebrator = _.curry(_.flip(exports.celebrate), 3);
