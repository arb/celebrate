![Celebrate](https://github.com/continuationlabs/celebrate/raw/master/images/logo.png)

<sub>Logo design by chris.ruppert@gmail.com</sub>

[![Current Version](https://img.shields.io/npm/v/celebrate.svg)](https://www.npmjs.org/package/celebrate)
[![Build Status](https://travis-ci.org/continuationlabs/celebrate.svg?branch=master)](https://travis-ci.org/continuationlabs/celebrate)

[![belly-button-style](https://cdn.rawgit.com/continuationlabs/belly-button/master/badge.svg)](https://github.com/continuationlabs/belly-button)

`celebrate` is an Express middleware function that wraps the [joi](https://github.com/hapijs/joi) validation library. This allows you to use this middleware in any single route, or globally, and ensure that all of your inputs are correct before any handler function. The middleware allows you to validate `req.params`, `req.headers`, `req.query` and `req.body` (provided you are using `body-parser`).

`celebrate` lists joi as a formal dependency. This means that celebrate will always use a predictable, known version of joi during the validation and compilation steps. There are two reasons for this:

1. To ensure that `celebrate` can always use the latest version of joi as soon as it's published
2. So that `celebrate` can export the version of joi it uses to the consumer to maximize compatibility

Wondering why *another* joi middleware library for Express? Full blog post [here](https://blog.continuation.io/time-to-celebrate/).

## Usage

Example of using `celebrate` on a single POST route to validate `req.body`.
```js
const express = require('express');
const BodyParser = require('body-parser');
const { celebrate, Joi, errors } = require('celebrate');

const app = express();
app.use(BodyParser.json());

app.post('/signup', celebrate({
  body: Joi.object().keys({
    name: Joi.string().required(),
    age: Joi.number().integer(),
    role: Joi.string().default('admin')
  }),
  query: {
    token: Joi.string().token().required()
  }
}), (req, res) => {
  // At this point, req.body has been validated and 
  // res.locals.celebrate.body.role is equal the role provided in the POST or set to 'admin' by joi
});
app.use(errors());
``` 

Example of using `celebrate` to validate all incoming requests to ensure the `token` header is present and matches the supplied regular expression.
```js
const express = require('express');
const { celebrate, Joi, errors} = require('celebrate');
const app = express();

// validate all incoming request headers for the token header
// if missing or not the correct format, respond with an error
app.use(celebrate({
 headers: Joi.object({
   token: Joi.string().required().regex(/abc\d{3}/)
 }).unknown()
}));
app.get('/', (req, res) => { res.send('hello world'); });
app.get('/foo', (req, res) => { res.send('a foo request'); });
app.use(errors());
```

## API

### `celebrate(schema, [options])`

Returns a `function` with the middleware signature (`(req, res, next)`).

- `schema` - a object where `key` can be one of `'params', 'headers', 'query', and 'body'` and the `value` is a [joi](https://github.com/hapijs/joi/blob/master/API.md) validation schema. Only the `key`s specified will be validated against the incoming `req` object. If you omit a key, that part of the `req` object will not be validated. A schema must contain at least one of the valid keys. 
- `[options]` - `joi` [options](https://github.com/hapijs/joi/blob/master/API.md#validatevalue-schema-options-callback) that are passed directly into the `validate` function. Defaults to `{ escapeHtml: true }`. This is differs from the Joi defaults since version 12.

Because of the changes coming in Express 5, `celebrate` no longer overwrites values on `req`. Instead, it sets the validated values inside `res.locals.celebate`. There is a utility function (`values`) for retrieving these values and you should avoid accessing them directly as the path could change in the future. When requests pass through the `celebrate` middleware, all of the request values (`'params', 'headers', 'query', and 'body'`) are copied over into `res.locals.celebrate` even if they are not valided. This is done so Celebrate users don't have to look in two different places for request input values, any route that uses `celebrate` will always have them availible via `values(res)`.

### `errors()`

Returns a `function` with the error handler signature (`(err, req, res, next)`). This should be placed with any other error handling middleware to catch Joi validation errors. If the incoming `err` object is a Joi error, `errors()` will respond with a 400 status code and the Joi validation message. Otherwise, it will call `next(err)` and will pass the error along and need to be processed by another error handler.

If the error format does not suite your needs, you an encouraged to write your own error handler and check `err.isJoi` to format joi errors to your liking. The full joi error object will be available in your own error handler.

### `Joi`

`celebrate` exports the version of joi it is using internally. For maximum compatibility, you should use this version when passing in any validation schemas.

### `values(res, [fallback])`

A utility function for extracting validated values from the incoming request. You pass in a `res` object that has gone through the `celebrate` middleware as well as an express `req` object as a fallback. This function returns an object with `'params', 'headers', 'query', and ['body']`
attached to it. 

`res` - an Express response object that has gone through `celebrate` middleware
`[fallback]` - an object to use as a fallback in instances where `res` does not have the request input values set. 99% of the time, this should be the `req` object in an express route handler.

## Order

`celebrate` validates `req` values in the following order:

1. `req.headers`
2. `req.params`
3. `req.query`
4. `req.body`

If any of the configured validation rules fail, the entire request will be considered invalid and the rest of the validation will be short-circuited and the validation error will be passed into `next`. 

## Issues

*Before* opening issues on this repo, make sure your joi schema is correct and working as you intended. The bulk of this code is just exposing the joi API as Express middleware. All of the heavy lifting still happens inside joi. You can go [here](https://npm.runkit.com/joi) to verify your joi schema easily.
