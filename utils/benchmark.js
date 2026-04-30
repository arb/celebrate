import { Bench } from 'tinybench';
import { celebrate, Joi, Modes } from '../lib/index.js';

const noop = () => {};

const f = celebrate({
  body: {
    name: Joi.string().allow('adam').required(),
  },
});

const g = celebrate({
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
});

const bench = new Bench({ time: 1000 });

bench
  .add('valid', () => f({
    body: { name: 'adam' },
    method: 'post',
  }, {}, noop))
  .add('invalid partial', () => f({
    body: {},
    method: 'post',
  }, {}, noop))
  .add('invalid full', () => g({
    method: 'post',
    body: {},
    query: {},
    params: {},
  }, {}, noop));

await bench.run();
console.table(bench.table());

// first run
// valid x 707,830 ops/sec ±7.21% (69 runs sampled)
// invalid partial x 581,854 ops/sec ±8.39% (36 runs sampled)
// invalid full x 15,922 ops/sec ±8.31% (67 runs sampled)
