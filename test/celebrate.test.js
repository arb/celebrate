/* eslint-env jest */
const expect = require('expect');
const {
  celebrate,
  Joi,
  errors,
  isCelebrate,
} = require('../lib');

describe('celebrate()', () => {
  describe.each`
    schema | expected
    ${false} | ${'"value" must have at least 1 children'}
    ${undefined} | ${'"value" must have at least 1 children'}
    ${{ query: { name: Joi.string(), age: Joi.number() }, foo: Joi.string() }} | ${'"foo" is not allowed'}
    `('celebrate(schema)', ({ schema, expected }) => {
  it(`throws an error with ${expected}`, () => {
    expect(() => {
      celebrate(schema);
    }).toThrow(expected);
  });
});

  describe.each`
    name | schema | req | message
    ${'req.headers'} | ${{ headers: { accept: Joi.string().regex(/xml/) } }} | ${{ headers: { accept: 'application/json' } }} | ${'"accept" with value "application&#x2f;json" fails to match the required pattern: /xml/'}
    ${'req.params'} | ${{ params: { id: Joi.string().token() } }} | ${{ params: { id: '@@@' } }} | ${'"id" must only contain alpha-numeric and underscore characters'}
    ${'req.query'} | ${{ query: Joi.object().keys({ start: Joi.date() }) }} | ${{ query: { end: 1 } }} | ${'"end" is not allowed'}
    ${'req.body'} | ${{ body: { first: Joi.string().required(), last: Joi.string(), role: Joi.number().integer() } }} | ${{ body: { first: 'john', last: 123 }, method: 'POST' }} | ${'"last" must be a string'}
    `('celebate middleware', ({
  schema, req, message, name,
}) => {
  it(`validates ${name}`, () => {
    expect.assertions(2);
    const middleware = celebrate(schema);

    middleware(req, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.details[0].message).toBe(message);
    });
  });
});

  it('errors on the first validation problem (params, query, body)', () => {
    expect.assertions(2);
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

    middleware({
      params: {
        id: '1',
      },
      query: {
        end: false,
      },
      body: {
        first: 'john',
        last: 123,
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('applys any joi transorms back to the object', () => {
    expect.assertions(3);
    const req = {
      body: {
        first: 'john',
        last: 'doe',
      },
      query: undefined,
      method: 'POST',
    };
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer().default('admin'),
      },
      query: Joi.number(),
    });

    middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.body).toEqual({
        first: 'john',
        last: 'doe',
        role: 'admin',
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

    middleware({
      body: {
        first: 'john',
        last: 123,
      },
      method: 'GET',
    }, null, (err) => {
      expect(err).toBe(null);
    });
  });

  it('works with Joi.extend()', () => {
    expect.assertions(2);
    const _Joi = Joi.extend({
      base: Joi.string(),
      name: 'string',
      language: { isJohn: 'must equal "john"' },
      rules: [{
        name: 'isJohn',
        validate(params, v, state, options) {
          if (v !== 'john') {
            return this.createError('string.isJohn', { v }, state, options);
          }
          return undefined;
        },
      }],
    });

    const middleware = celebrate({
      body: {
        first: _Joi.string().required().isJohn(),
        role: _Joi.number().integer(),
      },
    });

    middleware({
      body: {
        first: 'george',
        role: 123,
      },
      method: 'POST',
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.details[0].message).toBe('"first" must equal "john"');
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
        start: Date.now(),
        page: 1,
      },
      method: 'GET',
    };

    middleware(req, null, (err) => {
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

    middleware({
      headers: {
        accept: 'application/json',
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
      expect(err.details[0].message).toBe('"accept" with value "application/json" fails to match the required pattern: /xml/');
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

    middleware({
      query: {
        role: '0',
      },
      method: 'GET',
    }, null, (err) => {
      handler(err, undefined, res, next);
    });
  });

  it('passes the error through next if not a joi error from celebrate middleware', () => {
    let errorDirectlyFromJoi = null;
    const handler = errors();
    const res = {
      status() {
        throw Error('status called');
      },
    };
    const next = (err) => {
      expect(err).toEqual(errorDirectlyFromJoi);
    };

    const schema = Joi.object({
      role: Joi.number().integer().min(4),
    });

    Joi.validate({ role: '0' }, schema, { abortEarly: false, convert: false }, (err) => {
      errorDirectlyFromJoi = err;
      handler(err, undefined, res, next);
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

    middleware({
      body: {
        role: '0',
      },
      method: 'POST',
    }, null, (err) => {
      err.details = null; // eslint-disable-line no-param-reassign
      handler(err, undefined, res, next);
    });
  });
});

describe('isCelebrate', () => {
  describe.each`
        value | expected
        ${Error()} | ${false}
        ${'errr'} | ${false}
        ${0} | ${false}
        ${[0, 1]} | ${false}
        ${null} | ${false}
        ${undefined} | ${false}
      `('$value', ({ value, expected }) => {
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

    middleware({
      headers: {
        accept: 'application/json',
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
    });
  });
});
