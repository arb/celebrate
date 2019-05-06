const Joi = require('@hapi/joi');

exports.middlewareSchema = Joi.object({
  headers: Joi.any(),
  params: Joi.any(),
  query: Joi.any(),
  cookies: Joi.any(),
  signedCookies: Joi.any(),
  body: Joi.any(),
}).required().min(1);

exports.celebrateSchema = Joi.object({
  reqContext: Joi.boolean(),
});
