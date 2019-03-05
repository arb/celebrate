const Joi = require('joi');

exports.middlewareSchema = Joi.object().keys({
  headers: Joi.any(),
  params: Joi.any(),
  query: Joi.any(),
  cookies: Joi.any(),
  signedCookies: Joi.any(),
  body: Joi.any(),
}).min(1);
