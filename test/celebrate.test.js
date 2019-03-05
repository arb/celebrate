/* eslint-env jest */
const expect = require('expect');
const { name, random, date } = require('faker');
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
    segment | schema | req | message
    ${'req.headers'} | ${{ headers: { accept: Joi.string().regex(/xml/) } }} | ${{ headers: { accept: 'application/json' } }} | ${'"accept" with value "application&#x2f;json" fails to match the required pattern: /xml/'}
    ${'req.params'} | ${{ params: { id: Joi.string().token() } }} | ${{ params: { id: '@@@' } }} | ${'"id" must only contain alpha-numeric and underscore characters'}
    ${'req.query'} | ${{ query: Joi.object().keys({ start: Joi.date() }) }} | ${{ query: { end: random.number() } }} | ${'"end" is not allowed'}
    ${'req.body'} | ${{ body: { first: Joi.string().required(), last: Joi.string(), role: Joi.number().integer() } }} | ${{ body: { first: name.firstName(), last: random.number() }, method: 'POST' }} | ${'"last" must be a string'}
    ${'req.cookies'} | ${{ cookies: { state: Joi.string().required() } }} | ${{ cookies: { state: random.number() } }} | ${'"state" must be a string'}
    ${'req.signedCookies'} | ${{ cookies: { uid: Joi.string().required() } }} | ${{ cookies: { uid: random.number() } }} | ${'"uid" must be a string'}
    `('celebate middleware', ({
  schema, req, message, segment,
}) => {
  it(`validates ${segment}`, () => {
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
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('applys any joi transorms back to the object', () => {
    expect.assertions(3);
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

    middleware(req, null, (err) => {
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

    middleware({
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
        first: name.firstName(),
        role: random.number(),
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
        start: date.recent(),
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

  describe('contexts', () => {
    it('supports static reference', () => {
      expect.assertions(2);
      const middleware = celebrate({
        body: {
          id: Joi.number().only(Joi.ref('$id')),
        },
      }, {
        context: {
          id: 100,
        },
      });

      middleware({
        method: 'POST',
        body: {
          id: random.number({ min: 1, max: 99 }),
        },
      }, null, (err) => {
        expect(isCelebrate(err)).toBe(true);
        expect(err.details[0].message).toBe('"id" must be one of [context:id]');
      });
    });

    it('supports a request reference (fail)', () => {
      expect.assertions(2);
      const middleware = celebrate({
        params: {
          userId: Joi.number().integer().required(),
        },
        body: {
          id: Joi.number().only(Joi.ref('$params.userId')),
        },
      }, null, {
        reqContext: true,
      });

      middleware({
        method: 'POST',
        params: {
          userId: 10,
        },
        body: {
          id: random.number({ min: 1, max: 9 }),
        },
      }, null, (err) => {
        expect(isCelebrate(err)).toBe(true);
        expect(err.details[0].message).toBe('"id" must be one of [context:params.userId]');
      });
    });

    it('supports a request reference (pass)', () => {
      expect.assertions(1);
      const middleware = celebrate({
        params: {
          userId: Joi.number().integer().required(),
        },
        body: {
          id: Joi.number().only(Joi.ref('$params.userId')),
        },
      }, {
        context: {
          params: {
            userId: 5,
          },
        },
      }, {
        reqContext: true,
      });

      middleware({
        method: 'POST',
        params: {
          userId: 10,
        },
        body: {
          id: 10,
        },
      }, null, (err) => {
        expect(isCelebrate(err)).toBe(false);
      });
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
        role: random.number({ min: 0, max: 3 }),
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

    Joi.validate({
      role: random.word(),
    }, schema, { abortEarly: false, convert: false }, (err) => {
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
        role: random.word(),
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
        accept: random.number(),
      },
    }, null, (err) => {
      expect(isCelebrate(err)).toBe(true);
    });
  });
});
