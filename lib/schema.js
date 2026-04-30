import { STATUS_CODES } from 'node:http';
import Joi from 'joi';
import { segments, modes } from './constants.js';

const validStatusCodes = [];
for (const status of Object.keys(STATUS_CODES)) {
  const code = Number(status);
  if (code >= 400 && code <= 600) {
    validStatusCodes.push(code);
  }
}

export const REQUESTSCHEMA = Joi.object({
  [segments.HEADERS]: Joi.any(),
  [segments.PARAMS]: Joi.any(),
  [segments.QUERY]: Joi.any(),
  [segments.COOKIES]: Joi.any(),
  [segments.SIGNEDCOOKIES]: Joi.any(),
  [segments.BODY]: Joi.any(),
}).required().min(1);

export const CELEBRATEOPTSSCHEMA = Joi.object({
  reqContext: Joi.boolean(),
  mode: Joi.string().valid(modes.PARTIAL, modes.FULL),
});

export const SEGMENTSCHEMA = Joi.string().valid(
  segments.HEADERS,
  segments.PARAMS,
  segments.QUERY,
  segments.COOKIES,
  segments.SIGNEDCOOKIES,
  segments.BODY
);

export const CELEBRATEERROROPTSSCHEMA = Joi.object({
  celebrated: Joi.boolean().default(false),
});

export const ERRORSOPTSSCHEMA = Joi.object({
  statusCode: Joi.number().integer().valid(...validStatusCodes),
  message: Joi.string(),
});
