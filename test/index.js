'use strict';

const Code = require('code');
const Joi = require('joi');
const Lab = require('lab');
const Celebrate = require('../lib');

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
      console.log(err.details[0].message);
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
      expect(err).to.be.undefined();
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
      expect(err).to.be.undefined();
      done();
    });
  });
});
