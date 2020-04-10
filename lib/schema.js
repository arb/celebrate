const HTTP = require('http');
const Joi = require('@hapi/joi');
const { segments } = require('./constants');

const validStatusCodes = Object.keys(HTTP.STATUS_CODES).reduce((memo, status) => {
  const statusCode = Number(status);
  if (statusCode > 399 && statusCode < 599) {
    memo.push(statusCode);
  }
  return memo;
}, []);

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
});

exports.SEGMENTSCHEMA = Joi.string().valid(
  segments.HEADERS,
  segments.PARAMS,
  segments.QUERY,
  segments.COOKIES,
  segments.SIGNEDCOOKIES,
  segments.BODY,
);

exports.CELEBRATEERROROPTSSCHEMA = Joi.object({
  celebrated: Joi.boolean().default(false),
});

exports.ERRORSOPTSSCHEMA = Joi.object({
  statusCode: Joi.number().integer().valid(...validStatusCodes),
});
