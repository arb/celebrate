/* eslint-env jest */
const expect = require('expect');
const {
  name, random, date, internet,
} = require('faker');
const {
  celebrate,
  Joi,
  errors,
  isCelebrate,
  CelebrateError,
  Segments,
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
    ${Segments.QUERY} | ${{ [Segments.QUERY]: Joi.object().keys({ start: Joi.date() }) }} | ${{ [Segments.QUERY]: { end: random.number() } }} | ${'"end" is not allowed'}
    ${Segments.BODY} | ${{ [Segments.BODY]: { first: Joi.string().required(), last: Joi.string(), role: Joi.number().integer() } }} | ${{ [Segments.BODY]: { first: name.firstName(), last: random.number() }, method: 'POST' }} | ${'"last" must be a string'}
    ${Segments.COOKIES} | ${{ [Segments.COOKIES]: { state: Joi.string().required() } }} | ${{ [Segments.COOKIES]: { state: random.number() } }} | ${'"state" must be a string'}
    ${Segments.SIGNEDCOOKIES} | ${{ [Segments.SIGNEDCOOKIES]: { uid: Joi.string().required() } }} | ${{ [Segments.SIGNEDCOOKIES]: { uid: random.number() } }} | ${'"uid" must be a string'}
    `('celebate middleware', ({
  schema, req, message, segment,
}) => {
  it(`validates ${segment}`, () => {
    expect.assertions(3);
    const middleware = celebrate(schema);

    return middleware(req, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe(message);
      expect(err.meta.source).toBe(segment);
    });
  });
});

  it('errors on the first validation problem (params, query, body)', () => {
    expect.assertions(3);
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
        end: random.boolean(),
      },
      [Segments.BODY]: {
        first: name.firstName(),
        last: name.lastName(),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"end" is not allowed');
      expect(err.meta.source).toBe(Segments.QUERY);
    });
  });

  it('applys any joi transorms back to the object', () => {
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
        role: Joi.number().integer().default(role),
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
        role: random.number(),
      },
      method: 'POST',
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"first" must equal "john"');
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
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"accept" with value "application/json" fails to match the required pattern: /xml/');
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
        id: random.number({ min: 1, max: 99 }),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"id" must be [ref:global:id]');
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
        id: random.number({ min: 1, max: 9 }),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"id" must be [ref:global:params.userId]');
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
        role: random.number({ min: 0, max: 3 }),
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

  it('only includes key values if joi returns details', () => {
    expect.assertions(3);
    const middleware = celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
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
      [Segments.BODY]: {
        role: random.word(),
      },
      method: 'POST',
    }, null, (err) => {
      err.joi.details = null; // eslint-disable-line no-param-reassign
      handler(err, undefined, res, next);
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
        role: random.number({ min: 0, max: 3 }),
      },
      method: 'GET',
    }, null, (err) => {
      handler(err, undefined, res, next);
    });
  });
});

describe('isCelebrate()', () => {
  describe.each`
        value | expected
        ${Error()} | ${false}
        ${'errr'} | ${false}
        ${0} | ${false}
        ${[0, 1]} | ${false}
        ${null} | ${false}
        ${undefined} | ${false}
      `('isCelebrate($value)', ({ value, expected }) => {
  it(`returns ${expected}`, () => {
    expect.assertions(1);
    expect(isCelebrate(value)).toBe(expected);
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
        accept: random.number(),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
    });
  });
});

describe('CelebrateError()', () => {
  const schema = Joi.string().valid('foo');
  // Need a real Joi error to use in a few places for these tests
  const result = schema.validate(null);
  describe.each`
    value
    ${null}
    ${undefined}
    ${Error()}
    ${{}}
    `('CelebrateError($value)', ({ value }) => {
  it('throws an error', () => {
    expect.assertions(1);
    expect(() => CelebrateError(value)).toThrow('"error" must be a Joi error');
  });
});
  it('throws an error if the source is not a valid string', () => {
    expect.assertions(1);
    expect(() => CelebrateError(result.error, 'foo')).toThrow(Joi.ValidationError);
  });
  it('throws an error if the option arguments is incorrect', () => {
    expect.assertions(1);
    expect(() => CelebrateError(result.error, 'body', false)).toThrow(Joi.ValidationError);
  });
  it('returns a formatted error object with options', () => {
    expect.assertions(2);
    const err = CelebrateError(result.error, 'body', { celebrated: true });
    expect(err).toMatchObject({
      joi: expect.any(Joi.ValidationError),
      meta: { source: 'body' },
      message: expect.any(String),
    });
    expect(isCelebrate(err)).toBe(true);
  });
  it('[sync] returns a CelebrateError object without options', () => {
    expect.assertions(2);
    const err = CelebrateError(result.error, 'body');
    expect(err).toMatchObject({
      joi: expect.any(Joi.ValidationError),
      meta: { source: 'body' },
      message: expect.any(String),
    });
    expect(isCelebrate(err)).toBe(false);
  });
  it('[async] returns a CelebrateError object without options', () => {
    expect.assertions(2);
    return schema.validateAsync(null).catch((e) => {
      const err = CelebrateError(e, 'body');
      expect(err).toMatchObject({
        joi: expect.any(Joi.ValidationError),
        meta: { source: 'body' },
        message: expect.any(String),
      });
      expect(isCelebrate(err)).toBe(false);
    });
  });
});
