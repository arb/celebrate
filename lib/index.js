const Joi = require('@hapi/joi');
const {
  celebrate,
  celebrator,
  isCelebrate,
  errors,
  CelebrateError,
} = require('./celebrate');

const {
  segments: Segments,
} = require('./constants');

module.exports = {
  celebrate,
  celebrator,
  isCelebrate,
  errors,
  CelebrateError,
  Joi,
  Segments,
};
