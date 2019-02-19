[![celebrate](https://github.com/arb/celebrate/raw/master/images/logo.svg?sanitize=1)](https://www.npmjs.org/package/celebrate)

[![Current Version](https://flat.badgen.net/npm/v/celebrate)](https://www.npmjs.org/package/celebrate)
[![Build Status](https://flat.badgen.net/travis/arb/celebrate)](https://travis-ci.org/arb/celebrate)
[![airbnb-style](https://flat.badgen.net/badge/eslint/airbnb/ff5a5f)](https://github.com/airbnb/javascript)
[![Code Coverage](https://flat.badgen.net/codecov/c/github/arb/celebrate)](https://codecov.io/gh/arb/celebrate)

<table>
  <tbody>
    <tr>
      <td>Sponsored by</td>
      <td>
        <a href="https://github.com/webflow/">
          <img 
            height="100"
            src="https://github.com/arb/celebrate/raw/master/images/webflow-logo-blue.svg?sanitize=1" 
            alt="Webflow"
          />
        </a>
      </td>
    </tr>
  </tbody>
</table>

`celebrate` is an express middleware function that wraps the [joi](https://github.com/hapijs/joi/tree/master) validation library. This allows you to use this middleware in any single route, or globally, and ensure that all of your inputs are correct before any handler function. The middleware allows you to validate `req.params`, `req.headers`, `req.query` and the middleware below when provided with their respective modules.

The middleware will also validate:

* `req.body` — provided you are using `body-parser`
* `req.cookies` — provided you are using `cookie-parser`
* `req.signedCookies` — provided you are using `cookie-parser`

`celebrate` lists joi as a formal dependency. This means that celebrate will always use a predictable, known version of joi during the validation and compilation steps. There are two reasons for this:

1. To ensure that `celebrate` can always use the latest version of joi as soon as it's published
2. So that `celebrate` can export the version of joi it uses to the consumer to maximize compatibility

Wondering why *another* joi middleware library for express? Full blog post [here](https://medium.com/@adambretz/time-to-celebrate-27ccfc656d7f).

⚠️**Mutation Warning**⚠️
If you use any of joi's updating validation APIs (`defualt`, `rename`, etc.) `celebrate` will override the source value with the changes applied by joi. 

For example, if you validate `req.query` and have a `default` value in your joi schema, if the incoming `req.query` is missing a value for default, during validation `celebrate` will overrite the original `req.query` with the result of `joi.validate`. This is done so that once `req` has been validated, you can be sure all the inputs are valid and ready to consume in your handler functions and you don't need to re-write all your handlers to look for the query values in `res.locals.*`. 

## express Compatibility

celebrate is tested and has full compatibility with express 4 and 5. It should work correctly with express 3, but including it in the test matrix was more trouble than it's worth. This is primarily because express 3 stores exposes route parameters as an array rather than an object.

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
  // req.body.role is equal to req.body.role if provided in the POST or set to 'admin' by joi
});
app.use(errors());
``` 

Example of using `celebrate` to validate all incoming requests to ensure the `token` header is present and matches the supplied regular expression.
```js
const express = require('express');
const { celebrate, Joi, errors } = require('celebrate');
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

Example of using `celebrate` with `cookie-parser`.
```js
const express = require('express');
const CookieParser = require('cookie-parser');
const { celebrate, Joi, errors } = require('celebrate');

const app = express();
app.use(CookieParser('top secret'));

// validate request if access token is provided
app.post('/protected', celebrate({
  signedCookies: Joi.object({
    accessToken: Joi.string().required()
  }).unknown()
}), (req, res) => {
  // At this point, req.signedCookies has been validated
});
```

## API

### `celebrate(schema, [options])`

Returns a `function` with the middleware signature (`(req, res, next)`).

- `schema` - a object where `key` can be one of `'params'`, `'headers'`, `'query'`, and `'body'` and the `value` is a [joi](https://github.com/hapijs/joi/blob/master/API.md) validation schema. Only the keys specified will be validated against the incoming request object. If you omit a key, that part of the `req` object will not be validated. A schema must contain at least one of the valid keys. 
- `[options]` - `joi` [options](https://github.com/hapijs/joi/blob/master/API.md#validatevalue-schema-options-callback) that are passed directly into the `validate` function. Defaults to `{ escapeHtml: true }`.

### `errors()`

Returns a `function` with the error handler signature (`(err, req, res, next)`). This should be placed with any other error handling middleware to catch joi validation errors. If the incoming `err` object is an error originating from celebrate, `errors()` will respond with a 400 status code and the joi validation message. Otherwise, it will call `next(err)` and will pass the error along and will need to be processed by another error handler.

If the error format does not suite your needs, you are encouraged to write your own error handler and check `isCelebrate(err)` to format celebrate errors to your liking. The full [joi error object](https://github.com/hapijs/joi/blob/master/API.md#errors) will be available in your own error handler.

### `Joi`

`celebrate` exports the version of joi it is using internally. For maximum compatibility, you should use this version when creating schemas used with celebrate.

### `isCelebrate(err)`

Returns `true` if the provided `err` object originated from the `celebrate` middleware, and `false` otherwise. Useful if you want to write your own error handler for `celebrate` errors.

- `err` - an error object

## Order

`celebrate` validates `req` values in the following order:

1. `req.headers`
2. `req.params`
3. `req.query`
4. `req.cookies`
5. `req.signedCookies`
6. `req.body`

If any of the configured validation rules fail, the entire request will be considered invalid and the rest of the validation will be short-circuited and the validation error will be passed into `next`. 

## Issues

*Before* opening issues on this repo, make sure your joi schema is correct and working as you intended. The bulk of this code is just exposing the joi API as express middleware. All of the heavy lifting still happens inside joi. You can go [here](https://npm.runkit.com/joi) to verify your joi schema easily.
