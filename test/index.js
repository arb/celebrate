'use strict';

const Code = require('code');
const Lab = require('lab');
const Celebrate = require('../lib');
const Joi = Celebrate.Joi;

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const describe = lab.describe;
const it = lab.it;

describe('Celebrate Middleware', () => {
  it('throws an error if using an invalid schema', (done) => {
    expect(() => {
      Celebrate({
        query: {
          name: Joi.string(),
          age: Joi.number()
        },
        foo: Joi.string()
      });
    }).to.throw('"foo" is not allowed');

    expect(() => {
      Celebrate();
    }).to.throw('"value" must have at least 1 children');

    expect(() => {
      Celebrate(false);
    }).to.throw('"value" must have at least 1 children');

    done();
  });

  it('validates req.headers', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"accept" with value "application&#x2f;json" fails to match the required pattern: /xml/');
      done();
    });
  });

  it('validates req.params', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"id" must only contain alpha-numeric and underscore characters');
      done();
    });
  });

  it('validates req.query', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"end" is not allowed');
      done();
    });
  });

  it('validates req.body', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"last" must be a string');
      done();
    });
  });

  it('errors on the first validation problem (params, query, body)', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"end" is not allowed');
      done();
    });
  });

  it('applys any joi transorms back to the object', (done) => {
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
      expect(err).to.be.null();
      expect(req.body).to.equal({
        first: 'john',
        last: 'doe',
        role: 'admin'
      });
      expect(req.query).to.be.undefined();
      done();
    });
  });

  it('does not validate req.body if the method is "GET" or "HEAD"', (done) => {
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
      expect(err).to.be.null();
      done();
    });
  });

  it('works with Joi.extend()', (done) => {
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
      expect(err).to.exist();
      expect(err.isJoi).to.be.true();
      expect(err.details[0].message).to.equal('"first" must equal "john"');
      done();
    });
  });

  it('uses the supplied the Joi options', (done) => {
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
      expect(err).to.not.exist();
      expect(req.query).to.equal({ page: 1 });
      done();
    });
  });

  describe('errors()', () => {
    it('responds with a joi error', (done) => {
      const handler = Celebrate.errors();
      const res = {
        status (statusCode) {
          expect(statusCode).to.equal(400);
          return {
            send (err) {
              expect(err).to.equal({
                error: 'Bad Request',
                message: 'child "first" fails because ["first" is required]. child "last" fails because ["last" is required]. child "role" fails because ["role" must be a number]',
                statusCode: 400,
                validation: {
                  keys: [
                    'first',
                    'last',
                    'role'
                  ],
                  source: 'query'
                }
              });
              done();
            }
          };
        }
      };
      const next = () => {
        Code.fail('next called');
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

    it('passes the error through next if not a joi error', (done) => {
      const handler = Celebrate.errors();
      const res = {
        status (statusCode) {
          Code.fail('status called');
        }
      };
      const next = (err) => {
        expect(err).to.equal({
          isBoom: true,
          message: 'Not Found',
          statusCode: 404
        });
        done();
      };

      handler({
        isBoom: true,
        message: 'Not Found',
        statusCode: 404
      }, undefined, res, next);
    });

    it('only includes key values if joi returns details', (done) => {
      const handler = Celebrate.errors();
      const res = {
        status (statusCode) {
          expect(statusCode).to.equal(400);
          return {
            send (err) {
              expect(err).to.equal({
                error: 'Bad Request',
                message: 'child "first" fails because ["first" is required]',
                statusCode: 400,
                validation: {
                  keys: [],
                  source: 'body'
                }
              });
              done();
            }
          };
        }
      };
      const next = () => {
        Code.fail('next called');
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
});
