[![celebrate](https://github.com/arb/celebrate/raw/master/images/logo.svg?sanitize=1)](https://www.npmjs.org/package/celebrate)

[![Current Version](https://flat.badgen.net/npm/v/celebrate?icon=npm)](https://www.npmjs.org/package/celebrate)
[![Build Status](https://flat.badgen.net/github/checks/arb/celebrate?label=build&icon=github)](https://www.google.com)
[![airbnb-style](https://flat.badgen.net/badge/eslint/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)
[![Code Coverage](https://flat.badgen.net/codecov/c/github/arb/celebrate?icon=codecov)](https://codecov.io/gh/arb/celebrate)
[![Total Downloads](https://flat.badgen.net/npm/dt/celebrate?&color=cyan)](https://www.npmjs.org/package/celebrate)


celebrate is an express middleware function that wraps the [joi](https://github.com/hapijs/joi/tree/master) validation library. This allows you to use this middleware in any single route, or globally, and ensure that all of your inputs are correct before any handler function. The middleware allows you to validate `req.params`, `req.headers`, and `req.query`.

The middleware will also validate:

* `req.body` — provided you are using [`body-parser`](https://github.com/expressjs/body-parser)
* `req.cookies` — provided you are using [`cookie-parser`](https://github.com/expressjs/cookie-parser)
* `req.signedCookies` — provided you are using [`cookie-parser`](https://github.com/expressjs/cookie-parser)

celebrate lists joi as a formal dependency. This means that celebrate will always use a predictable, known version of joi during the validation and compilation steps. There are two reasons for this:

1. To ensure that celebrate can always use the latest version of joi as soon as it's published
2. So that celebrate can export the version of joi it uses to the consumer to maximize compatibility

<!-- toc -->

- [express Compatibility](#express-compatibility)
- [Example Usage](#example-usage)
- [API](#api)
  - [`celebrate(schema, [joiOptions], [opts])`](#celebrateschema-joioptions-opts)
  - [`celebrator([opts], [joiOptions], schema)`](#celebratoropts-joioptions-schema)
  - [`errors([opts])`](#errorsopts)
  - [`Joi`](#joi)
  - [`Segments`](#segments)
  - [`Modes`](#modes)
  - [`new CelebrateError([message], [opts])`](#new-celebrateerrormessage-opts)
  - [`isCelebrateError(err)`](#iscelebrateerrorerr)
- [Additional Details](#additional-details)
  - [Validation Order](#validation-order)
  - [Mutation Warning](#mutation-warning)
  - [Additional Info](#additional-info)
- [Issues](#issues)

<!-- tocstop -->

## express Compatibility

celebrate is tested and has full compatibility with express 4 and 5. It likely works correctly with express 3, but including it in the test matrix was more trouble than it's worth. This is primarily because express 3 exposes route parameters as an array rather than an object.

## Example Usage

Example of using celebrate on a single POST route to validate `req.body`.
```js
const express = require('express');
const BodyParser = require('body-parser');
const { celebrate, Joi, errors, Segments } = require('celebrate');

const app = express();
app.use(BodyParser.json());

app.post('/signup', celebrate({
  [Segments.BODY]: Joi.object().keys({
    name: Joi.string().required(),
    age: Joi.number().integer(),
    role: Joi.string().default('admin')
  }),
  [Segments.QUERY]: {
    token: Joi.string().token().required()
  }
}), (req, res) => {
  // At this point, req.body has been validated and 
  // req.body.role is equal to req.body.role if provided in the POST or set to 'admin' by joi
});
app.use(errors());
``` 

Example of using celebrate to validate all incoming requests to ensure the `token` header is present and matches the supplied regular expression.
```js
const express = require('express');
const { celebrate, Joi, errors, Segments } = require('celebrate');
const app = express();

// validate all incoming request headers for the token header
// if missing or not the correct format, respond with an error
app.use(celebrate({
  [Segments.HEADERS]: Joi.object({
    token: Joi.string().required().regex(/abc\d{3}/)
  }).unknown()
}));
app.get('/', (req, res) => { res.send('hello world'); });
app.get('/foo', (req, res) => { res.send('a foo request'); });
app.use(errors());
```

## API

celebrate does not have a default export. The following methods encompass the public API.

### `celebrate(schema, [joiOptions], [opts])`

Returns a `function` with the middleware signature (`(req, res, next)`).

- `requestRules` - an `object` where `key` can be one of the values from [`Segments`](#segments) and the `value` is a [joi](https://github.com/hapijs/joi/blob/master/API.md) validation schema. Only the keys specified will be validated against the incoming request object. If you omit a key, that part of the `req` object will not be validated. A schema must contain at least one valid key. 
- `[joiOpts]` - optional `object` containing joi [options](https://github.com/hapijs/joi/blob/master/API.md#anyvalidatevalue-options) that are passed directly into the `validate` function. Defaults to `{ warnings: true }`.
- `[opts]` - an optional `object` with the following keys. Defaults to `{}`.
  - `reqContext` - `bool` value that instructs joi to use the incoming `req` object as the `context` value during joi validation. If set, this will trump the value of `joiOptions.context`. This is useful if you want to validate part of the request object against another part of the request object. See the tests for more details.
  - `mode` - optional [`Modes`](#modes) for controlling the validation mode celebrate uses. Defaults to `partial`.

### `celebrator([opts], [joiOptions], schema)`

This is a curried version of [`celebrate`](#celebrateschema-joioptions-opts). It is curried with `lodash.curryRight` so it can be called in all the various fashions that [API supports](https://lodash.com/docs/4.17.15#curryRight). Returns a `function` with the middleware signature (`(req, res, next)`).

- `[opts]` - an optional `object` with the following keys. Defaults to `{}`.
  - `reqContext` - `bool` value that instructs joi to use the incoming `req` object as the `context` value during joi validation. If set, this will trump the value of `joiOptions.context`. This is useful if you want to validate part of the request object against another part of the request object. See the tests for more details.
  - `mode` - optional [`Modes`](#modes) for controlling the validation mode celebrate uses. Defaults to `partial`.
- `[joiOpts]` - optional `object` containing joi [options](https://github.com/hapijs/joi/blob/master/API.md#anyvalidatevalue-options) that are passed directly into the `validate` function. Defaults to `{ warnings: true }`.
- `requestRules` - an `object` where `key` can be one of the values from [`Segments`](#segments) and the `value` is a [joi](https://github.com/hapijs/joi/blob/master/API.md) validation schema. Only the keys specified will be validated against the incoming request object. If you omit a key, that part of the `req` object will not be validated. A schema must contain at least one valid key. 

<details>
  <summary>Sample usage</summary>

  This is an example use of curried celebrate in a real server.

  ```js
    const express = require('express');
    const { celebrator, Joi, errors, Segments } = require('celebrate');
    const app = express();

    // now every instance of `celebrate` will use these same options so you only
    // need to do it once.
    const celebrate = celebrator({ reqContext: true }, { convert: true });

    // validate all incoming request headers for the token header
    // if missing or not the correct format, respond with an error
    app.use(celebrate({
      [Segments.HEADERS]: Joi.object({
        token: Joi.string().required().regex(/abc\d{3}/)
      }).unknown()
    }));
    app.get('/', celebrate({
      [Segments.HEADERS]: Joi.object({
        name: Joi.string().required()
      })
    }), (req, res) => { res.send('hello world'); });
    app.use(errors());
  ```
  
  Here are some examples of other ways to call `celebrator`

  ```js
    const opts = { reqContext: true };
    const joiOpts = { convert: true };
    const schema = {
      [Segments.HEADERS]: Joi.object({
        name: Joi.string().required()
      })
    };

    let c = celebrator(opts)(joiOpts)(schema);
    c = celebrator(opts, joiOpts)(schema);
    c = celebrator(opts)(joiOpts, schema);
    c = celebrator(opts, joiOpts, schema);

    // c would function the same in all of these cases.
  ```
</details>

### `errors([opts])`

Returns a `function` with the error handler signature (`(err, req, res, next)`). This should be placed with any other error handling middleware to catch celebrate errors. If the incoming `err` object is an error originating from celebrate, `errors()` will respond a pre-build error object. Otherwise, it will call `next(err)` and will pass the error along and will need to be processed by another error handler.

- `[opts]` - an optional `object` with the following keys
  - `statusCode` - `number` that will be used for the response status code in the event of an error. Must be greater than 399 and less than 600. It must also be a number available to the node [HTTP module](https://nodejs.org/api/http.html#http_http_status_codes). Defaults to 400.
  - `message` - `string` that will be used for the `message` value sent out by the error handler. Defaults to `'Validation failed'`

If the error response format does not suite your needs, you are encouraged to write your own and check [`isCelebrateError(err)`](#iscelebrateerrorerr) to format celebrate errors to your liking. 

Errors origintating from the `celebrate()` middleware are [`CelebrateError`](#celebrateerrorerror-segment-opts) objects.

### `Joi`

celebrate exports the version of joi it is using internally. For maximum compatibility, you should use this version when creating schemas used with celebrate.

### `Segments`

An enum containing all the segments of `req` objects that celebrate *can* validate against.

```js
{
  BODY: 'body',
  COOKIES: 'cookies',
  HEADERS: 'headers',
  PARAMS: 'params',
  QUERY: 'query',
  SIGNEDCOOKIES: 'signedCookies',
}
```

### `Modes`

An enum containing all the available validation modes that celebrate can support.

- `PARTIAL` - ends validation on the first failure. Does *not* apply joi transformations if any part of the request is invalid.
- `FULL` - validates the entire request object and collects all the validation failures in the result. Does *not* apply joi transformations if any part of the request is invalid.
  - Note: In order for this to work, you will need to pass `abortEarly: false` to [#joiOptions](#celebrateschema-joioptions-opts).  Or to get the default behavior along with this, `{ abortEarly: false, warnings: true }`


### `new CelebrateError([message], [opts])`

Creates a new `CelebrateError` object. Extends the built in `Error` object.

- `message` - optional `string` message. Defaults to `'Validation failed'`.
- `[opts]` - optional `object` with the following keys
  - `celebrated` - `bool` that, when `true`, adds `Symbol('celebrated'): true` to the result object. This indicates this error as originating from `celebrate`. You'd likely want to set this to `true` if you want the celebrate error handler to handle errors originating from the `format` function that you call in user-land code. Defaults to `false`.

`CelebrateError` has the following public properties:
- `details` - a `Map` of all validation failures. The `key` is a [`Segments`](#segments) and the value is a joi validation error. Adding to `details` is done via `details.set`. The `value` must be a joi validation error or an exception will be thrown.


<details>
  <summary>Sample usage</summary>

  ```js
    const result = Joi.validate(req.params.id, Joi.string().valid('foo'), { abortEarly: false });
    const err = new CelebrateError(undefined, { celebrated: true });
    err.details.set(Segments.PARAMS, result.error);
  ```
</details>

### `isCelebrateError(err)`

Returns `true` if the provided `err` object originated from the `celebrate` middleware, and `false` otherwise. Useful if you want to write your own error handler for celebrate errors.

- `err` - an error object

## Additional Details

### Validation Order

celebrate validates request values in the following order:

1. `req.headers`
2. `req.params`
3. `req.query`
4. `req.cookies` (_assuming `cookie-parser` is being used_)
5. `req.signedCookies` (_assuming `cookie-parser` is being used_)
6. `req.body` (_assuming `body-parser` is being used_)

### Mutation Warning

If you use any of joi's updating validation APIs (`default`, `rename`, etc.) `celebrate` will override the source value with the changes applied by joi (assuming the request is valid).

For example, if you validate `req.query` and have a `default` value in your joi schema, if the incoming `req.query` is missing a value for default, during validation `celebrate` will overwrite the original `req.query` with the result of `joi.validate`. This is done so that once `req` has been validated, you can be sure all the inputs are valid and ready to consume in your handler functions and you don't need to re-write all your handlers to look for the query values in `res.locals.*`.

### Additional Info

According the the HTTP spec, `GET` requests should _not_ include a body in the request payload. For that reason, `celebrate` does not validate the body on `GET` requests. 

## Issues

*Before* opening issues on this repo, make sure your joi schema is correct and working as you intended. The bulk of this code is just exposing the joi API as express middleware. All of the heavy lifting still happens inside joi. You can go [here](https://npm.runkit.com/joi) to verify your joi schema easily.
