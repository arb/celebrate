const Benchmark = require('benchmark');
const { celebrate, Joi, Modes } = require('../lib');

const schema1 = {
  body: {
    name: Joi.string().allow('adam').required(),
  },
};

const suite = new Benchmark.Suite();
const noop = () => { };

suite.add('valid', () => {
  celebrate(schema1)({
    body: {
      name: 'adam',
    },
    method: 'post',
  }, {}, noop);
}).add('invalid partial', () => {
  celebrate(schema1)({
    body: {},
    method: 'post',
  }, {}, noop);
}).add('invalid full', () => {
  celebrate({
    body: {
      name: Joi.string().allow('adam').required(),
    },
    query: {
      age: Joi.number().integer().required(),
    },
    params: {
      page: Joi.number().required(),
    },
  }, undefined, {
    mode: Modes.FULL,
  })({
    method: 'post',
    body: {},
    query: {},
    params: {},
  }, {}, noop);
});

suite.on('complete', function suiteComplete() {
  for (let i = 0; i < this.length; i += 1) {
    console.log(this[i].toString());
  }
});

suite.run({ async: true });
