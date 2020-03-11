const Joi = require('@hapi/joi');
const { segments } = require('./constants');

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
