const { STATUS_CODES } = require('node:http');
const Joi = require('joi');
const {
  segments,
  modes,
} = require('./constants');

const validStatusCodes = [];
for (const status of Object.keys(STATUS_CODES)) {
  const code = Number(status);
  if (code >= 400 && code <= 600) {
    validStatusCodes.push(code);
  }
}

exports.REQUESTSCHEMA = Joi.object({
  [segments.HEADERS]: Joi.any(),
  [segments.PARAMS]: Joi.any(),
  [segments.QUERY]: Joi.any(),
  [segments.COOKIES]: Joi.any(),
  [segments.SIGNEDCOOKIES]: Joi.any(),
  [segments.BODY]: Joi.any(),
}).required().min(1);

exports.CELEBRATEOPTSSCHEMA = Joi.object({
  reqContext: Joi.boolean(),
  mode: Joi.string().valid(modes.PARTIAL, modes.FULL),
});

exports.SEGMENTSCHEMA = Joi.string().valid(
  segments.HEADERS,
  segments.PARAMS,
  segments.QUERY,
  segments.COOKIES,
  segments.SIGNEDCOOKIES,
  segments.BODY
);

exports.CELEBRATEERROROPTSSCHEMA = Joi.object({
  celebrated: Joi.boolean().default(false),
});

exports.ERRORSOPTSSCHEMA = Joi.object({
  statusCode: Joi.number().integer().valid(...validStatusCodes),
  message: Joi.string(),
});
