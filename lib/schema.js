const Joi = require('@hapi/joi');

exports.middlewareSchema = Joi.object().keys({
  headers: Joi.any(),
  params: Joi.any(),
  query: Joi.any(),
  cookies: Joi.any(),
  signedCookies: Joi.any(),
  body: Joi.any(),
}).min(1);

exports.celebrateSchema = Joi.object().keys({
  reqContext: Joi.boolean(),
});
