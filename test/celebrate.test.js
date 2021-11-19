/* eslint-env jest */
const expect = require('expect');
const {
  name,
  random,
  date,
  internet,
  datatype,
} = require('faker');
const {
  celebrate,
  Joi,
  errors,
  isCelebrateError,
  CelebrateError,
  Segments,
  celebrator,
  Modes,
} = require('../lib');

describe('celebrate()', () => {
  describe.each`
    schema
    ${false}
    ${undefined}
    ${{}}
    ${{ [Segments.QUERY]: { name: Joi.string(), age: Joi.number() }, foo: Joi.string() }}
    `('celebrate($schema)', ({ schema }) => {
    it('throws an error', () => {
      expect(() => {
        celebrate(schema);
      }).toThrow(Joi.ValidationError);
    });
  });

  describe.each`
    segment | schema | req | message
    ${Segments.HEADERS} | ${{ [Segments.HEADERS]: { accept: Joi.string().regex(/xml/) } }} | ${{ [Segments.HEADERS]: { accept: 'application/json' } }} | ${'"accept" with value "application/json" fails to match the required pattern: /xml/'}
    ${Segments.PARAMS} | ${{ [Segments.PARAMS]: { id: Joi.string().token() } }} | ${{ [Segments.PARAMS]: { id: '@@@' } }} | ${'"id" must only contain alpha-numeric and underscore characters'}
    ${Segments.QUERY} | ${{ [Segments.QUERY]: Joi.object().keys({ start: Joi.date() }) }} | ${{ [Segments.QUERY]: { end: datatype.number() } }} | ${'"end" is not allowed'}
    ${Segments.BODY} | ${{ [Segments.BODY]: { first: Joi.string().required(), last: Joi.string(), role: Joi.number().integer() } }} | ${{ [Segments.BODY]: { first: name.firstName(), last: datatype.number() }, method: 'POST' }} | ${'"last" must be a string'}
    ${Segments.COOKIES} | ${{ [Segments.COOKIES]: { state: Joi.string().required() } }} | ${{ [Segments.COOKIES]: { state: datatype.number() } }} | ${'"state" must be a string'}
    ${Segments.SIGNEDCOOKIES} | ${{ [Segments.SIGNEDCOOKIES]: { uid: Joi.string().required() } }} | ${{ [Segments.SIGNEDCOOKIES]: { uid: datatype.number() } }} | ${'"uid" must be a string'}
    `('celebate middleware', ({
    schema, req, message, segment,
  }) => {
    describe.each`
  fn | kind
  ${celebrate} | ${'celebrate'}
  ${celebrator(undefined, undefined)} | ${'celebrator'}
  `('', ({ fn, kind }) => {
      it(`validates ${segment} correctly with ${kind}`, () => {
        expect.assertions(2);
        const middleware = fn(schema);

        return middleware(req, null, (err) => {
          expect(isCelebrateError(err)).toBe(true);
          expect(err.details.get(segment).message).toBe(message);
        });
      });
    });
  });

  it('errors on the first validation problem (params, query, body) by default', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().required(),
      },
      [Segments.QUERY]: Joi.object().keys({
        start: Joi.date(),
      }),
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    });

    return middleware({
      [Segments.PARAMS]: {
        id: random.alphaNumeric(10),
      },
      [Segments.QUERY]: {
        end: datatype.boolean(),
      },
      [Segments.BODY]: {
        first: name.firstName(),
        last: name.lastName(),
      },
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details.get(Segments.QUERY).message).toBe('"end" is not allowed');
    });
  });

  it('validates the entire request (params, query, body) with full validatate mode', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().required(),
      },
      [Segments.QUERY]: Joi.object().keys({
        start: Joi.date(),
      }),
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer().required(),
      },
    }, undefined, {
      mode: 'full',
    });

    return middleware({
      [Segments.PARAMS]: {
        id: datatype.number(),
      },
      [Segments.QUERY]: {
        end: datatype.boolean(),
      },
      [Segments.BODY]: {
        first: name.firstName(),
        last: name.lastName(),
        role: datatype.boolean(),
      },
      method: 'POST',
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details).toMatchSnapshot();
    });
  });

  it('applys any joi transorms back to the object', () => {
    expect.assertions(4);
    const first = name.firstName();
    const last = name.lastName();
    const role = name.jobTitle();
    const browser = internet.domainWord();
    const req = {
      [Segments.BODY]: {
        first,
        last,
      },
      [Segments.QUERY]: undefined,
      [Segments.COOKIES]: { browser: undefined, agent: 'Node' },
      method: 'POST',
    };
    const middleware = celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.string().default(role),
      },
      [Segments.QUERY]: Joi.number(),
      [Segments.COOKIES]: Joi.object().keys({
        browser: Joi.string().default(browser),
        agent: Joi.string().uppercase().required(),
      }),
    });

    return middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.body).toEqual({
        first,
        last,
        role,
      });
      expect(req.query).toBeUndefined();
      expect(req.cookies).toEqual({
        browser,
        agent: 'NODE',
      });
    });
  });

  it('does not apply joi transform during a failed validation with full validatate mode', () => {
    expect.assertions(3);
    const first = name.firstName();
    const last = name.lastName();
    const role = name.jobTitle();
    const browser = internet.domainWord();
    const req = {
      [Segments.BODY]: {
        first,
        last,
      },
      [Segments.COOKIES]: { browser: undefined },
      method: 'POST',
    };
    const middleware = celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string().uppercase(),
        role: Joi.string().default(role),
      },
      [Segments.COOKIES]: Joi.object().keys({
        browser: Joi.string().default(browser),
        agent: Joi.string().uppercase().required(),
      }),
    }, {
      mode: 'full',
    });

    return middleware(req, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      // missing role
      expect(req.body).toEqual({
        first,
        last,
      });
      // browser is still default
      expect(req.cookies).toEqual({
        browser: undefined,
      });
    });
  });

  it('does not validate req.body if the method is "GET" or "HEAD"', () => {
    expect.assertions(1);
    const middleware = celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    });

    return middleware({
      [Segments.BODY]: {
        first: name.firstName(),
        last: name.lastName(),
      },
      method: 'GET',
    }, null, (err) => {
      expect(err).toBe(null);
    });
  });

  it('works with Joi.extend()', () => {
    expect.assertions(2);
    const f = Joi.extend((joi) => ({
      type: 'john',
      base: joi.string(),
      messages: {
        'john.base': '{#label} must equal "john"',
      },
      validate(value, helpers) {
        if (value !== 'john') {
          return { value, errors: helpers.error('john.base') };
        }
        return { value, errors: null };
      },
    }));

    const middleware = celebrate({
      [Segments.BODY]: {
        first: f.john(),
        role: f.number().integer(),
      },
    });

    return middleware({
      [Segments.BODY]: {
        first: name.firstName(),
        role: datatype.number(),
      },
      method: 'POST',
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details.get(Segments.BODY).message).toBe('"first" must equal "john"');
    });
  });

  it('uses the supplied the Joi options', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.QUERY]: Joi.object().keys({
        page: Joi.number(),
      }),
    }, { stripUnknown: true });
    const req = {
      [Segments.QUERY]: {
        start: date.recent(),
        page: 1,
      },
      method: 'GET',
    };

    return middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.query).toEqual({ page: 1 });
    });
  });

  it('honors the escapeHtml Joi option', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/xml/),
      },
    }, { escapeHtml: false });

    return middleware({
      [Segments.HEADERS]: {
        accept: 'application/json',
      },
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details.get(Segments.HEADERS).message).toBe('"accept" with value "application/json" fails to match the required pattern: /xml/');
    });
  });

  it('supports static reference', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.BODY]: {
        id: Joi.number().valid(Joi.ref('$id')),
      },
    }, {
      context: {
        id: 100,
      },
    });

    return middleware({
      method: 'POST',
      [Segments.BODY]: {
        id: datatype.number({ min: 1, max: 99 }),
      },
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details.get(Segments.BODY).message).toBe('"id" must be [ref:global:id]');
    });
  });

  it('supports a request reference', () => {
    expect.assertions(2);
    const middleware = celebrate({
      [Segments.PARAMS]: {
        userId: Joi.number().integer().required(),
      },
      [Segments.BODY]: {
        id: Joi.number().valid(Joi.ref('$params.userId')),
      },
    }, null, {
      reqContext: true,
    });

    return middleware({
      method: 'POST',
      [Segments.PARAMS]: {
        userId: 10,
      },
      [Segments.BODY]: {
        id: datatype.number({ min: 1, max: 9 }),
      },
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
      expect(err.details.get(Segments.BODY).message).toBe('"id" must be [ref:global:params.userId]');
    });
  });
});

describe('errors()', () => {
  it('responds with a joi error from celebrate middleware', () => {
    expect.assertions(3);
    const middleware = celebrate({
      [Segments.QUERY]: {
        role: Joi.number().integer().min(4),
      },
    });
    const handler = errors();
    const next = jest.fn();
    const res = {
      status(statusCode) {
        expect(statusCode).toBe(400);
        return {
          send(err) {
            expect(err).toMatchSnapshot();
            expect(next).not.toHaveBeenCalled();
          },
        };
      },
    };

    return middleware({
      [Segments.QUERY]: {
        role: datatype.number({ min: 0, max: 3 }),
      },
      method: 'GET',
    }, null, (err) => {
      handler(err, undefined, res, next);
    });
  });

  it('passes the error through next if not a joi error from celebrate middleware', () => {
    const handler = errors();
    const res = {
      status() {
        throw Error('status called');
      },
    };

    const schema = Joi.object({
      role: Joi.number().integer().min(4),
    });

    const { error } = schema.validate({
      role: random.word(),
    });

    handler(error, undefined, res, (e) => {
      expect(e).toEqual(error);
    });
  });

  it('includes more information when abourtEarly is false', () => {
    expect.assertions(3);
    const middleware = celebrate({
      [Segments.QUERY]: {
        role: Joi.number().required().integer().min(4),
        name: Joi.string().required(),
      },
    }, {
      abortEarly: false,
    });
    const handler = errors();
    const next = jest.fn();
    const res = {
      status(statusCode) {
        expect(statusCode).toBe(400);
        return {
          send(err) {
            expect(err).toMatchSnapshot();
            expect(next).not.toHaveBeenCalled();
          },
        };
      },
    };

    return middleware({
      [Segments.QUERY]: {
        role: datatype.number({ min: 0, max: 3 }),
      },
      method: 'GET',
    }, null, (err) => {
      handler(err, undefined, res, next);
    });
  });

  it('honors the configuration options', () => {
    expect.assertions(5);
    const middleware = celebrate({
      [Segments.QUERY]: {
        role: Joi.number().integer().min(4),
      },
    });
    const statusCode = 409;
    const message = 'your request is bad and you should feel bad';
    const handler = errors({ statusCode, message });
    const next = jest.fn();
    const res = {
      status(code) {
        expect(code).toBe(statusCode);
        return {
          send(err) {
            expect(err).toHaveProperty('statusCode', statusCode);
            expect(err).toHaveProperty('message', message);
            expect(err).toMatchSnapshot();
            expect(next).not.toHaveBeenCalled();
          },
        };
      },
    };

    return middleware({
      [Segments.QUERY]: {
        role: datatype.number({ min: 0, max: 3 }),
      },
      method: 'GET',
    }, null, (err) => {
      handler(err, undefined, res, next);
    });
  });

  it('throws an error for goofy satus codes', () => {
    expect(() => errors({ statusCode: 499 })).toThrow(Joi.ValidationError);
    expect(() => errors({ statusCode: 200 })).toThrow(Joi.ValidationError);
  });
});

describe('isCelebrateError()', () => {
  describe.each`
        value | expected
        ${Error()} | ${false}
        ${'errr'} | ${false}
        ${0} | ${false}
        ${[0, 1]} | ${false}
        ${null} | ${false}
        ${undefined} | ${false}
      `('isCelebrateError($value)', ({ value, expected }) => {
    it(`returns ${expected}`, () => {
      expect.assertions(1);
      expect(isCelebrateError(value)).toBe(expected);
    });
  });

  it('returns true if the error object came from celebrate', () => {
    expect.assertions(1);
    const middleware = celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/xml/),
      },
    });

    return middleware({
      [Segments.HEADERS]: {
        accept: datatype.number(),
      },
    }, null, (err) => {
      expect(isCelebrateError(err)).toBe(true);
    });
  });
});

describe('CelebrateError()', () => {
  const schema = Joi.string().valid('foo');
  // Need a real Joi error to use in a few places for these tests
  const result = schema.validate(null);
  it('returns a formatted error object with options', () => {
    expect.assertions(3);
    const err = new CelebrateError(undefined, { celebrated: true });
    err.details.set(Segments.BODY, result.error);

    expect(err).toHaveProperty('message', 'Validation failed');
    expect(err.details.get(Segments.BODY)).toBe(result.error);
    expect(isCelebrateError(err)).toBe(true);
  });
  it('[sync] returns a CelebrateError object with custom message', () => {
    expect.assertions(3);
    const message = 'my custom error message';
    const err = new CelebrateError(message);
    err.details.set(Segments.BODY, result.error);

    expect(err).toHaveProperty('message', message);
    expect(err.details.get(Segments.BODY)).toBe(result.error);
    expect(isCelebrateError(err)).toBe(false);
  });
  it('[async] returns a CelebrateError object without options', () => {
    expect.assertions(3);
    return schema.validateAsync(null).catch((e) => {
      const err = new CelebrateError();
      err.details.set(Segments.QUERY, e);

      expect(err).toHaveProperty('message', 'Validation failed');
      expect(err.details.get(Segments.QUERY)).toBe(e);
      expect(isCelebrateError(err)).toBe(false);
    });
  });
  it('throws an error if you try to add a detail that is not a joi error', () => {
    expect.assertions(1);
    const err = new CelebrateError();
    expect(() => {
      err.details.set(Segments.BODY, new Error());
    }).toThrow('value must be a joi validation error');
  });
});

describe('celebrator', () => {
  let c;

  const opts = { reqContext: true, mode: Modes.FULL };
  const joiOpts = { convert: true };
  const schema = {
    [Segments.HEADERS]: Joi.object({
      name: Joi.string().required(),
    }),
  };

  it('can be invoked (opts)(joiOpts)(schema)', () => {
    expect(() => {
      c = celebrator(opts)(joiOpts)(schema);
    }).not.toThrow();
    expect(c._schema).toEqual(schema);
  });
  it('can be invoked (opts, joiOpts)(schema)', () => {
    expect(() => {
      c = celebrator(opts, joiOpts)(schema);
    }).not.toThrow();
    expect(c._schema).toEqual(schema);
  });
  it('can be invoked (opts)(joiOpts, schema)', () => {
    expect(() => {
      c = celebrator(opts)(joiOpts, schema);
    }).not.toThrow();
    expect(c._schema).toEqual(schema);
  });
  it('can be invoked (opts, joiOpts, schema);', () => {
    expect(() => {
      c = celebrator(opts, joiOpts, schema);
    }).not.toThrow();
    expect(c._schema).toEqual(schema);
  });
});
