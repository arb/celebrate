![Celebrate](https://github.com/continuationlabs/celebrate/raw/master/images/logo.png)

<sub>Logo design by chris.ruppert@gmail.com</sub>

[![Current Version](https://img.shields.io/npm/v/celebrate.svg)](https://www.npmjs.org/package/celebrate)
[![Build Status](https://travis-ci.org/continuationlabs/celebrate.svg?branch=master)](https://travis-ci.org/continuationlabs/celebrate)
[![Dependencies](https://img.shields.io/david/continuationlabs/celebrate.svg)](https://github.com/continuationlabs/celebrate)

[![belly-button-style](https://cdn.rawgit.com/continuationlabs/belly-button/master/badge.svg)](https://github.com/continuationlabs/belly-button)

`celebrate` is an Express middleware function that wraps the [joi](https://github.com/hapijs/joi) validation library. This allows you to use this middleware in any single route, or globally, and ensure that all of your inputs are correct before any handler function. The middleware allows you to validate `req.params`, `req.headers`, `req.query` and `req.body` (provided you are using `body-parser`).

## Usage

```js
const express = require('express');
const BodyParser = require('body-parser');
const Joi = require('joi');
const Celebrate = require('celebrate');

const app = express();
app.use(BodyParser.json());
app.use(Logger());

app.post('/signup', Celebrate({
  body: Joi.object().keys({
    name: Joi.string().required(),
    age: Joi.number().integer(),
    role: Joi.string().default('admin')
  }),
  query: {
    token: Joi.string().token.required()
  }
}), (req, res) => {
  // At this point, req.body has been validated and is equal to req.body.name if provided in the POST or set to 'admin' by joi
});

// By default, Express will try to send our errors back as HTML, if you want the JSON, add an error handler here
app.use((err, req, res) => {
  if (err.isJoi) {
    return res.status(400).send(err);
  }
  res.status(500).send('Some other error');
});
``` 

## API

### `celebrate(schema)`

Returns a `function` with the middleware signature (`(req, res, next)`).

- `schema` - a object where `key` can be one of `'params', 'headers', 'query', and 'body'` and the `value` is a [joi](https://github.com/hapijs/joi/blob/master/API.md) validation schema. Only the `key`s specified will be validated against the incomming `req` object. If you omit a key, that part of the `req` object will not be validated. A schema must contain at least one of the valid keys. 

## Order

`celebrate` validates `req` values in the following order:

1. `req.headers`
2. `req.params`
3. `req.query`
4. `req.body`

If any of the configured validation rules fail, the entire request will be considered invalid and the rest of the validation will be short-circuited and the validation error will be passed into `next`. 

## Issues

*Before* opening issues on this repo, make sure your joi schema is correct and workingas you intend. The bulk of this code is just exposing the joi API as Express middleware. All of the heavy lifting still happens inside joi. 
