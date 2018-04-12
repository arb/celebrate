/* eslint-env jest */
const Express = require('express');
const Artificial = require('artificial');
const BodyParser = require('body-parser');
const Celebrate = require('../lib');

const celebrate = Celebrate.celebrate;
const Joi = Celebrate.Joi;
const errors = Celebrate.errors;

const Server = () => {
  const server = Express();
  server.use(BodyParser.json());
  Artificial(server);
  return server;
};

describe('express integration', () => {
  describe('validations', () => {
    it('req.headers', (done) => {
      expect.assertions(2);
      const server = Server();

      server.get('/', celebrate({
        headers: {
          accept: Joi.string().regex(/xml/)
        }
      }, {
        allowUnknown: true
      }));

      server.use(errors());

      server.inject({
        method: 'GET',
        url: '/',
        headers: {
          accept: 'application/json'
        }
      }, (res) => {
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.payload)).toMatchSnapshot();
        done();
      });
    });

    it('req.params', (done) => {
      expect.assertions(2);
      const server = Server();
      server.get('/user/:id', celebrate({
        params: {
          id: Joi.string().token()
        }
      }));

      server.use(errors());

      server.inject({
        method: 'get',
        url: '/user/@@'
      }, (res) => {
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.payload)).toMatchSnapshot();
        done();
      });
    });

    it('req.query', (done) => {
      expect.assertions(2);
      const server = Server();

      server.get('/', celebrate({
        query: Joi.object().keys({
          start: Joi.date()
        })
      }));

      server.use(errors());

      server.inject({
        url: '/?end=celebrate'
      }, (res) => {
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.payload)).toMatchSnapshot();
        done();
      });
    });

    it('req.body', (done) => {
      expect.assertions(2);
      const server = Server();
      server.post('/', celebrate({
        body: {
          first: Joi.string().required(),
          last: Joi.string(),
          role: Joi.number().integer()
        }
      }));

      server.use(errors());

      server.inject({
        url: '/',
        method: 'post',
        payload: {
          first: 'john',
          last: 123
        }
      }, (res) => {
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.payload)).toMatchSnapshot();
        done();
      });
    });
  });
  describe('update req values', () => {
    it('req.headers', (done) => {
      expect.assertions(1);
      const server = Server();

      server.get('/', celebrate({
        headers: {
          accept: Joi.string().regex(/json/),
          'secret-header': Joi.string().default('@@@@@@')
        }
      }, {
        allowUnknown: true
      }), (req, res) => {
        delete req.headers.host; // this can change computer to computer, so just remove it
        expect(req.headers).toEqual({
          accept: 'application/json',
          'user-agent': 'shot',
          'secret-header': '@@@@@@'
        });
        res.send();
      });

      server.inject({
        method: 'GET',
        url: '/',
        headers: {
          accept: 'application/json'
        }
      }, () => done());
    });

    it('req.params', (done) => {
      expect.assertions(1);
      const server = Server();
      server.get('/user/:id', celebrate({
        params: {
          id: Joi.string().uppercase()
        }
      }), (req, res) => {
        expect(req.params.id).toBe('ADAM');
        res.send();
      });

      server.inject({
        method: 'get',
        url: '/user/adam'
      }, () => done());
    });

    it('req.query', (done) => {
      expect.assertions(1);
      const server = Server();

      server.get('/', celebrate({
        query: Joi.object().keys({
          name: Joi.string().uppercase(),
          page: Joi.number().default(1)
        })
      }), (req, res) => {
        expect(req.query).toBe({
          name: 'JOHN',
          page: 1
        });
        res.send();
      });


      server.inject({
        url: '/?name=john'
      }, () => done());
    });

    it('req.body', (done) => {
      expect.assertions(1);
      const server = Server();
      server.post('/', celebrate({
        body: {
          first: Joi.string().required(),
          last: Joi.string().default('Smith'),
          role: Joi.string().uppercase()
        }
      }), (req, res) => {
        expect(req.body).toEqual({
          first: 'john',
          role: 'ADMIN',
          last: 'Smith'
        });
        res.send();
      });

      server.inject({
        url: '/',
        method: 'post',
        payload: {
          first: 'john',
          role: 'admin'
        }
      }, () => done());
    });
  });
});
