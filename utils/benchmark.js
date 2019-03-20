const Benchmark = require('benchmark');
const { celebrate, Joi } = require('../lib');

const middleware = celebrate({
  body: {
    name: Joi.string().allow('adam').required(),
  },
});

const suite = new Benchmark.Suite();
const noop = () => {};

suite.add('valid', () => {
  middleware({
    body: {
      name: 'adam',
    },
    method: 'post',
  }, {}, noop);
}).add('invalid', () => {
  middleware({
    body: {},
    method: 'post',
  }, {}, noop);
});

suite.on('complete', function suiteComplete() {
  for (let i = 0; i < this.length; i += 1) {
    console.log(this[i].toString());
  }
});

suite.run();
