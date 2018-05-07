const Joi = require('joi');

module.exports.schema = Joi.object().keys({
  headers: Joi.any(),
  params: Joi.any(),
  query: Joi.any(),
  body: Joi.any(),
}).min(1);
