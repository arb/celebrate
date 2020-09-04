const {
  celebrate,
  celebrator,
  errors,
  Joi,
} = require('./celebrate');

const {
  segments: Segments,
  modes: Modes,
} = require('./constants');

const {
  CelebrateError,
  isCelebrateError,
} = require('./CelebrateError');

module.exports = {
  celebrate,
  celebrator,
  errors,
  CelebrateError,
  isCelebrateError,
  Joi,
  Segments,
  Modes,
};
