import { STATUS_CODES } from 'node:http';
import Joi from 'joi';
import EscapeHtml from 'escape-html';
import curry from 'lodash.curry';
import flip from 'lodash.flip';
import {
  CELEBRATEOPTSSCHEMA,
  REQUESTSCHEMA,
  ERRORSOPTSSCHEMA,
} from './schema.js';
import { segments, modes } from './constants.js';
import {
  CelebrateError,
  isCelebrateError,
} from './CelebrateError.js';

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
        // Mirrors Joi's resolved shape so callers can destructure `value` uniformly.
        return Promise.resolve({ value: null });
      }

      return validateBody(req);
    };
    finalValidate.segment = segment;
    return finalValidate;
  };
};

internals.REQ_VALIDATIONS = [
  { segment: segments.HEADERS, validate: internals.validateSegment(segments.HEADERS) },
  { segment: segments.PARAMS, validate: internals.validateSegment(segments.PARAMS) },
  { segment: segments.QUERY, validate: internals.validateSegment(segments.QUERY) },
  { segment: segments.COOKIES, validate: internals.validateSegment(segments.COOKIES) },
  { segment: segments.SIGNEDCOOKIES, validate: internals.validateSegment(segments.SIGNEDCOOKIES) },
  { segment: segments.BODY, validate: internals.maybeValidateBody(segments.BODY) },
];

internals.partialValidate = async (steps, req) => {
  for (const validate of steps) {
    try {
      const { value } = await validate(req);
      if (value != null) {
        Object.defineProperty(req, validate.segment, { value });
      }
    } catch (e) {
      const error = new CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);
      error.details.set(validate.segment, e);
      throw error;
    }
  }
  return null;
};

internals.fullValidate = async (steps, req) => {
  const requestUpdates = [];
  const error = new CelebrateError(undefined, internals.DEFAULT_ERROR_ARGS);

  await Promise.all(steps.map(async (validate) => {
    try {
      const { value } = await validate(req);
      if (value != null) {
        requestUpdates.push([validate.segment, value]);
      }
    } catch (e) {
      error.details.set(validate.segment, e);
    }
  }));

  if (error.details.size) {
    throw error;
  }

  for (const [segment, value] of requestUpdates) {
    Object.defineProperty(req, segment, { value });
  }

  return null;
};

internals.validateFns = {
  [modes.FULL]: internals.fullValidate,
  [modes.PARTIAL]: internals.partialValidate,
};

export const celebrate = (_requestRules, joiOpts = {}, opts = {}) => {
  Joi.assert(_requestRules, REQUESTSCHEMA);
  Joi.assert(opts, CELEBRATEOPTSSCHEMA);

  const finalOpts = {
    ...internals.DEFAULT_CELEBRATE_OPTS,
    ...opts,
  };

  // Compile every segment schema up front so each request avoids the cost.
  const requestRules = new Map();
  for (const [key, value] of Object.entries(_requestRules)) {
    requestRules.set(key, Joi.compile(value));
  }

  const middleware = (req, res, next) => {
    const joiConfig = finalOpts.reqContext
      ? { ...joiOpts, context: req, warnings: true }
      : { ...joiOpts, warnings: true };

    const steps = [];
    for (const value of internals.REQ_VALIDATIONS) {
      const currentSegmentSpec = requestRules.get(value.segment);
      if (currentSegmentSpec) {
        steps.push(value.validate(currentSegmentSpec, joiConfig));
      }
    }

    const validateRequest = internals.validateFns[finalOpts.mode];

    // Returned promise is for tests only; not part of the public API.
    return validateRequest(steps, req).then(next).catch(next);
  };

  middleware._schema = _requestRules;

  return middleware;
};

export const errors = (opts = {}) => {
  const finalOpts = { ...internals.DEFAULT_ERRORS_OPTS, ...opts };
  Joi.assert(finalOpts, ERRORSOPTSSCHEMA);

  return (err, req, res, next) => {
    if (!isCelebrateError(err)) {
      return next(err);
    }

    const { statusCode, message } = finalOpts;

    const validation = {};
    for (const [segment, joiError] of err.details) {
      validation[segment] = {
        source: segment,
        keys: joiError.details.map((detail) => EscapeHtml(detail.path.join('.'))),
        message: joiError.message,
      };
    }

    const result = {
      statusCode,
      error: STATUS_CODES[statusCode],
      message: message || err.message,
      validation,
    };

    return res.status(statusCode).send(result);
  };
};

export { Joi };
export const Segments = segments;
export const celebrator = curry(flip(celebrate), 3);
