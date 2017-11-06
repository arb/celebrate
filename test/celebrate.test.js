'use strict';

const expect = require('expect');
const Celebrate = require('../lib');

const celebrate = Celebrate.celebrate;
const Joi = Celebrate.Joi;
const errors = Celebrate.errors;
const values = Celebrate.values;

const Res = () => ({ locals: {}});

describe('Celebrate Middleware', () => {
  it('throws an error if using an invalid schema', () => {
    expect.assertions(3);
    expect(() => {
      celebrate({
        query: {
          name: Joi.string(),
          age: Joi.number()
        },
        foo: Joi.string()
      });
    }).toThrow('"foo" is not allowed');

    expect(() => {
      celebrate();
    }).toThrow('"value" must have at least 1 children');

    expect(() => {
      celebrate(false);
    }).toThrow('"value" must have at least 1 children');
  });

  it('validates req.headers', () => {
    expect.assertions(2);
    const middleware = celebrate({
      headers: {
        accept: Joi.string().regex(/xml/)
      }
    });

    middleware({
      headers: {
        accept: 'application/json'
      }
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"accept" with value "application&#x2f;json" fails to match the required pattern: /xml/');
    });
  });

  it('validates req.params', () => {
    expect.assertions(2);
    const middleware = celebrate({
      params: {
        id: Joi.string().token()
      }
    });

    middleware({
      params: {
        id: '@@@'
      }
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"id" must only contain alpha-numeric and underscore characters');
    });
  });

  it('validates req.query', () => {
    expect.assertions(2);
    const middleware = celebrate({
      query: Joi.object().keys({
        start: Joi.date()
      })
    });

    middleware({
      query: {
        end: 1
      }
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('validates req.body', () => {
    expect.assertions(2);
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer()
      }
    });

    middleware({
      body: {
        first: 'john',
        last: 123
      },
      method: 'POST'
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"last" must be a string');
    });
  });

  it('errors on the first validation problem (params, query, body)', () => {
    expect.assertions(2);
    const middleware = celebrate({
      params: {
        id: Joi.string().required()
      },
      query: Joi.object().keys({
        start: Joi.date()
      }),
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer()
      }
    });

    middleware({
      params: {
        id: '1'
      },
      query: {
        end: false
      },
      body: {
        first: 'john',
        last: 123
      }
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('applys any joi transorms back to res.locals.celebrate the object', () => {
    expect.assertions(3);
    const req = {
      body: {
        first: 'john',
        last: 'doe'
      },
      query: undefined,
      method: 'POST'
    };
    const res = Res();
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer().default('admin')
      },
      query: Joi.number()
    });

    middleware(req, res, (err) => {
      expect(err).toBe(null);
      const v = values(res, req);
      expect(v.body).toEqual({
        first: 'john',
        last: 'doe',
        role: 'admin'
      });
      expect(v.query).toBeUndefined();
    });
  });

  it('does not validate req.body if the method is "GET" or "HEAD"', () => {
    expect.assertions(1);
    const middleware = celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer()
      }
    });

    middleware({
      body: {
        first: 'john',
        last: 123
      },
      method: 'GET'
    }, Res(), (err) => {
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
        validate (params, v, state, options) {
          if (v !== 'john') {
            return this.createError('string.isJohn', { v }, state, options);
          }
        }
      }]
    });

    const middleware = celebrate({
      body: {
        first: _Joi.string().required().isJohn(),
        role: _Joi.number().integer()
      }
    });

    middleware({
      body: {
        first: 'george',
        role: 123
      },
      method: 'POST'
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"first" must equal "john"');
    });
  });

  it('uses the supplied Joi options', () => {
    expect.assertions(2);
    const middleware = celebrate({
      query: Joi.object().keys({
        page: Joi.number()
      })
    }, { stripUnknown: true });
    const req = {
      query: {
        start: Date.now(),
        page: 1
      },
      method: 'GET'
    };
    const res = Res();

    middleware(req, res, (err) => {
      expect(err).toBe(null);
      const v = values(res);
      expect(v.query).toEqual({ page: 1 });
    });
  });

  it('honors the escapeHtml Joi option', () => {
    expect.assertions(2);
    const middleware = celebrate({
      headers: {
        accept: Joi.string().regex(/xml/)
      }
    }, { escapeHtml: false });

    middleware({
      headers: {
        accept: 'application/json'
      }
    }, Res(), (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"accept" with value "application/json" fails to match the required pattern: /xml/');
    });
  });

  it('copies all req.x values to res.locales.celebrate', () => {
    expect.assertions(6);
    const req = {
      body: {
        first: 'john',
        last: 'doe'
      },
      query: { page: '1' },
      params: { userId: 100 },
      headers: {
        accept: 'application/json',
        userAgent: 'not-a-browser',
      },
      method: 'POST'
    };
    const res = Res();
    const middleware = celebrate({
      query: {
        page: Joi.number()
      }
    });

    middleware(req, res, (err) => {
      expect(err).toBe(null);
      const v = values(res);
      expect(v.body).toEqual({
        first: 'john',
        last: 'doe',
      });
      expect(v.headers).toEqual({
        accept: 'application/json',
        userAgent: 'not-a-browser',
      });
      expect(v.query).toEqual({
        page: 1,
      });
      expect(v.params).toEqual({
        userId: 100,
      });
      expect(v.headers).toEqual({
        accept: 'application/json',
        userAgent: 'not-a-browser',
      });
    });
  });

  describe('errors()', () => {
    it('responds with a joi error', () => {
      expect.assertions(3);
      const handler = Celebrate.errors();
      const next = jest.fn();
      const res = {
        status (statusCode) {
          expect(statusCode).toBe(400);
          return {
            send (err) {
              expect(err).toMatchSnapshot();
              expect(next).not.toHaveBeenCalled();
            }
          };
        }
      };

      const schema = Joi.object({
        first: Joi.string().required(),
        last: Joi.string().required(),
        role: Joi.number().integer().min(4)
      });

      Joi.validate({ role: '0' }, schema, { abortEarly: false, convert: false }, (err) => {
        err._meta = { source: 'query' };
        handler(err, undefined, res, next);
      });
    });

    it('passes the error through next if not a joi error', () => {
      const handler = Celebrate.errors();
      const res = {
        status (statusCode) {
          Code.fail('status called');
        }
      };
      const next = (err) => {
        expect(err).toEqual({
          isBoom: true,
          message: 'Not Found',
          statusCode: 404
        });
      };

      handler({
        isBoom: true,
        message: 'Not Found',
        statusCode: 404
      }, undefined, res, next);
    });

    it('only includes key values if joi returns details', () => {
      expect.assertions(3);
      const handler = Celebrate.errors();
      const next = jest.fn();
      const res = {
        status (statusCode) {
          expect(statusCode).toBe(400);
          return {
            send (err) {
              expect(err).toMatchSnapshot();
              expect(next).not.toHaveBeenCalled();
            }
          };
        }
      };

      const schema = Joi.object({
        first: Joi.string().required()
      });

      Joi.validate({ role: '0' }, schema, (err) => {
        err._meta = { source: 'body' };
        err.details = null;
        handler(err, undefined, res, next);
      });
    });
  });

  describe('values()', () => {
    it('returns res.locals.celebrate if present', () => {
      const v = {};
      expect(values({locals: {celebrate: v}}, null)).toBe(v);
    });

    it('returns the fallback value if res.locals.celebrate is not present', () => {
      const req = {
        query: { foo: 'bar' },
        params: { id: 100 },
        onComplete: () => {},
      };
      expect(values(null, req)).toEqual({
        query: { foo: 'bar' },
        params: { id: 100 },
      });
    });
  });
});
