/* eslint-env jest */
const expect = require('expect');
const { name, random, date } = require('faker');
const {
  celebrate,
  Joi,
  errors,
  isCelebrate,
  format,
} = require('../lib');


describe('celebrate()', () => {
  describe.each`
    schema
    ${false}
    ${undefined}
    ${{}}
    ${{ query: { name: Joi.string(), age: Joi.number() }, foo: Joi.string() }}
    `('celebrate($schema)', ({ schema }) => {
  it('throws an error', () => {
    expect(() => {
      celebrate(schema);
    }).toThrow(Joi.ValidationError);
  });
});

  describe.each`
    segment | schema | req | message
    ${'headers'} | ${{ headers: { accept: Joi.string().regex(/xml/) } }} | ${{ headers: { accept: 'application/json' } }} | ${'"accept" with value "application/json" fails to match the required pattern: /xml/'}
    ${'params'} | ${{ params: { id: Joi.string().token() } }} | ${{ params: { id: '@@@' } }} | ${'"id" must only contain alpha-numeric and underscore characters'}
    ${'query'} | ${{ query: Joi.object().keys({ start: Joi.date() }) }} | ${{ query: { end: random.number() } }} | ${'"end" is not allowed'}
    ${'body'} | ${{ body: { first: Joi.string().required(), last: Joi.string(), role: Joi.number().integer() } }} | ${{ body: { first: name.firstName(), last: random.number() }, method: 'POST' }} | ${'"last" must be a string'}
    ${'cookies'} | ${{ cookies: { state: Joi.string().required() } }} | ${{ cookies: { state: random.number() } }} | ${'"state" must be a string'}
    ${'signedCookies'} | ${{ signedCookies: { uid: Joi.string().required() } }} | ${{ signedCookies: { uid: random.number() } }} | ${'"uid" must be a string'}
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
      params: {
        id: Joi.string().required(),
      },
      query: Joi.object().keys({
        start: Joi.date(),
      }),
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    });

    return middleware({
      params: {
        id: random.alphaNumeric(10),
      },
      query: {
        end: random.boolean(),
      },
      body: {
        first: name.firstName(),
        last: name.lastName(),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.joi.details[0].message).toBe('"end" is not allowed');
      expect(err.meta.source).toBe('query');
    });
  });

  it('applys any joi transorms back to the object', () => {
    const first = name.firstName();
    const last = name.lastName();
    const role = name.jobTitle();
    const req = {
      body: {
        first,
        last,
      },
      query: undefined,
      method: 'POST',
    };
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer().default(role),
      },
      query: Joi.number(),
    });

    return middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.body).toEqual({
        first,
        last,
        role,
      });
      expect(req.query).toBeUndefined();
    });
  });

  it('does not validate req.body if the method is "GET" or "HEAD"', () => {
    expect.assertions(1);
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    });

    return middleware({
      body: {
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
        'john.base': '"{#label}" must equal "john"',
      },
      validate(value, helpers) {
        if (value !== 'john') {
          return { value, errors: helpers.error('john.base') };
        }
        return { value, errors: null };
      },
    }));

    const middleware = celebrate({
      body: {
        first: f.john(),
        role: f.number().integer(),
      },
    });

    return middleware({
      body: {
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
      query: Joi.object().keys({
        page: Joi.number(),
      }),
    }, { stripUnknown: true });
    const req = {
      query: {
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
      headers: {
        accept: Joi.string().regex(/xml/),
      },
    }, { escapeHtml: false });

    return middleware({
      headers: {
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
      body: {
        id: Joi.number().valid(Joi.ref('$id')),
      },
    }, {
      context: {
        id: 100,
      },
    });

    return middleware({
      method: 'POST',
      body: {
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
      params: {
        userId: Joi.number().integer().required(),
      },
      body: {
        id: Joi.number().valid(Joi.ref('$params.userId')),
      },
    }, null, {
      reqContext: true,
    });

    return middleware({
      method: 'POST',
      params: {
        userId: 10,
      },
      body: {
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
      query: {
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
      query: {
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
      body: {
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
      body: {
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
      query: {
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
      query: {
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
      headers: {
        accept: Joi.string().regex(/xml/),
      },
    });

    return middleware({
      headers: {
        accept: random.number(),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
    });
  });
});

describe('format()', () => {
  // Need a real Joi error to use in a few places for these tests
  const result = Joi.string().valid('foo').validate(null);
  describe.each`
    value
    ${null}
    ${undefined}
    ${Error()}
    `('format($value)', ({ value }) => {
  it('throws an error', () => {
    expect.assertions(1);
    expect(() => format(value)).toThrow();
  });
});
  it('throws an error if the source is not a valid string', () => {
    expect.assertions(1);
    expect(() => format(result, 'foo')).toThrow(Joi.ValidationError);
  });
  it('throws an error if the option arguments is incorrect', () => {
    expect.assertions(1);
    expect(() => format(result, 'body', false)).toThrow(Joi.ValidationError);
  });
  it('returns a formatted error object without options', () => {
    expect.assertions(1);
    expect(format(result, 'body')).toMatchSnapshot();
  });
  it('returns a formatted error object with options', () => {
    expect.assertions(1);
    expect(format(result, 'body', { celebrated: true })).toMatchSnapshot();
  });
});
