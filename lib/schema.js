const Joi = require('@hapi/joi');
const { segments } = require('./constants');

exports.middlewareSchema = Joi.object({
  [segments.HEADERS]: Joi.any(),
  [segments.PARAMS]: Joi.any(),
  [segments.QUERY]: Joi.any(),
  [segments.COOKIES]: Joi.any(),
  [segments.SIGNEDCOOKIES]: Joi.any(),
  [segments.BODY]: Joi.any(),
}).required().min(1);

exports.celebrateSchema = Joi.object({
  reqContext: Joi.boolean(),
});

exports.sourceSchema = Joi.string().valid(
  segments.HEADERS,
  segments.PARAMS,
  segments.QUERY,
  segments.COOKIES,
  segments.SIGNEDCOOKIES,
  segments.BODY,
);

exports.optSchema = Joi.object({
  celebrated: Joi.boolean().default(false),
});
