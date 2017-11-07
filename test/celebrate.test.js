'use strict';

const expect = require('expect');
const Celebrate = require('../lib');
const Joi = Celebrate.Joi;

describe('Celebrate Middleware', () => {
  it('throws an error if using an invalid schema', () => {
    expect.assertions(3);
    expect(() => {
      Celebrate({
        query: {
          name: Joi.string(),
          age: Joi.number()
        },
        foo: Joi.string()
      });
    }).toThrow('"foo" is not allowed');

    expect(() => {
      Celebrate();
    }).toThrow('"value" must have at least 1 children');

    expect(() => {
      Celebrate(false);
    }).toThrow('"value" must have at least 1 children');
  });

  it('validates req.headers', () => {
    expect.assertions(2);
    const middleware = Celebrate({
      headers: {
        accept: Joi.string().regex(/xml/)
      }
    });

    middleware({
      headers: {
        accept: 'application/json'
      }
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"accept" with value "application&#x2f;json" fails to match the required pattern: /xml/');
    });
  });

  it('validates req.params', () => {
    expect.assertions(2);
    const middleware = Celebrate({
      params: {
        id: Joi.string().token()
      }
    });

    middleware({
      params: {
        id: '@@@'
      }
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"id" must only contain alpha-numeric and underscore characters');
    });
  });

  it('validates req.query', () => {
    expect.assertions(2);
    const middleware = Celebrate({
      query: Joi.object().keys({
        start: Joi.date()
      })
    });

    middleware({
      query: {
        end: 1
      }
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('validates req.body', () => {
    expect.assertions(2);
    const middleware = Celebrate({
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
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"last" must be a string');
    });
  });

  it('errors on the first validation problem (params, query, body)', () => {
    expect.assertions(2);
    const middleware = Celebrate({
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
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"end" is not allowed');
    });
  });

  it('applys any joi transorms back to the object', () => {
    expect.assertions(3);
    const req = {
      body: {
        first: 'john',
        last: 'doe'
      },
      query: undefined,
      method: 'POST'
    };
    const middleware = Celebrate({
      body: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer().default('admin')
      },
      query: Joi.number()
    });

    middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.body).toEqual({
        first: 'john',
        last: 'doe',
        role: 'admin'
      });
      expect(req.query).toBeUndefined();
    });
  });

  it('does not validate req.body if the method is "GET" or "HEAD"', () => {
    expect.assertions(1);
    const middleware = Celebrate({
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
        validate (params, v, state, options) {
          if (v !== 'john') {
            return this.createError('string.isJohn', { v }, state, options);
          }
        }
      }]
    });

    const middleware = Celebrate({
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
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"first" must equal "john"');
    });
  });

  it('uses the supplied the Joi options', () => {
    expect.assertions(2);
    const middleware = Celebrate({
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

    middleware(req, null, (err) => {
      expect(err).toBe(null);
      expect(req.query).toEqual({ page: 1 });
    });
  });

  it('honors the escapeHtml Joi option', () => {
    expect.assertions(2);
    const middleware = Celebrate({
      headers: {
        accept: Joi.string().regex(/xml/)
      }
    }, { escapeHtml: false });

    middleware({
      headers: {
        accept: 'application/json'
      }
    }, null, (err) => {
      expect(err.isJoi).toBe(true);
      expect(err.details[0].message).toBe('"accept" with value "application/json" fails to match the required pattern: /xml/');
    });
  });

  describe('errors()', () => {
    it('responds with a joi error from celebrate middleware', () => {
        expect.assertions(3);
        const middleware = Celebrate({
          query: {
            role: Joi.number().integer().min(4)
          }
        });
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

        middleware({
          query: {
            role: '0'
          },
          method: 'GET'
        }, null, (err) => {
            handler(err, undefined, res, next);
        });
    });

    it('passes the error through next if not a joi error from celebrate middleware', () => {
        let errorDirectlyFromJoi = null;
        const handler = Celebrate.errors();
        const res = {
          status (statusCode) {
            Code.fail('status called');
          }
        };
        const next = (err) => {
          expect(err).toEqual(errorDirectlyFromJoi);
        };

        const schema = Joi.object({
          role: Joi.number().integer().min(4)
        });

        Joi.validate({ role: '0' }, schema, { abortEarly: false, convert: false }, (err) => {
          errorDirectlyFromJoi = err;
          handler(err, undefined, res, next);
        });
    });

    it('only includes key values if joi returns details', () => {
      expect.assertions(3);
      const middleware = Celebrate({
        body: {
          first: Joi.string().required()
        }
      });
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

      middleware({
        body: {
          role: '0'
      },
      method: 'POST'
      }, null, (err) => {
          err.details = null;
          handler(err, undefined, res, next);
      });
    });
  });
});
