
/* eslint-env jest */
const Express = require('express');
const Artificial = require('artificial');
const BodyParser = require('body-parser');
const CookieParser = require('cookie-parser');
const signature = require('cookie-signature');
const { random } = require('faker');
const Teamwork = require('@hapi/teamwork');
const {
  celebrate,
  Joi,
  Segments,
} = require('../lib');

const Server = () => {
  const server = Express();
  server.use(CookieParser(random.alphaNumeric()));
  server.use(BodyParser.json());
  Artificial(server);
  return server;
};


describe('validations', () => {
  test('req.headers', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.get('/', celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/xml/),
      },
    }, {
      allowUnknown: true,
    }), next);

    server.inject({
      method: 'GET',
      url: '/',
      [Segments.HEADERS]: {
        accept: 'application/json',
      },
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('req.params', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.get('/user/:id', celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().token(),
      },
    }), next);

    server.inject({
      method: 'get',
      url: '/user/@@',
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('req.query', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.get('/', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        start: Joi.date(),
      }),
    }), next);

    server.inject({
      url: '/?end=celebrate',
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('req.cookies', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.post('/', celebrate({
      cookies: {
        state: Joi.number().required(),
      },
    }), next);

    server.inject({
      url: '/',
      method: 'post',
      [Segments.HEADERS]: {
        Cookie: 'state=notanumber',
      },
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('req.signedCookies', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.get('/', celebrate({
      [Segments.SIGNEDCOOKIES]: {
        secureState: Joi.number().required(),
      },
    }), next);

    const val = signature.sign('notanumber', 'secret');

    server.inject({
      url: '/',
      method: 'get',
      [Segments.HEADERS]: {
        Cookie: `state=s:${val}`,
      },
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('req.body', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.post('/', celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    }), next);

    server.inject({
      url: '/',
      method: 'post',
      payload: {
        first: 'john',
        last: 123,
      },
    }, team.attend.bind(team));

    const { statusCode } = await team.work;

    expect(statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('update req values', () => {
  test('req.headers', async () => {
    expect.assertions(1);
    const server = Server();
    const team = new Teamwork.Team();

    server.get('/', celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/json/),
        'secret-header': Joi.string().default('@@@@@@'),
      },
    }, {
      allowUnknown: true,
    }), (req) => {
      delete req.headers.host; // this can change computer to computer, so just remove it
      team.attend(req);
    });

    server.inject({
      method: 'GET',
      url: '/',
      [Segments.HEADERS]: {
        accept: 'application/json',
      },
    });

    const { headers } = await team.work;

    expect(headers).toEqual({
      accept: 'application/json',
      'user-agent': 'shot',
      'secret-header': '@@@@@@',
    });
  });

  test('req.params', async () => {
    expect.assertions(1);
    const server = Server();
    const team = new Teamwork.Team();

    server.get('/user/:id', celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().uppercase(),
      },
    }), team.attend.bind(team));

    server.inject({
      method: 'get',
      url: '/user/adam',
    });

    const { params } = await team.work;

    expect(params.id).toBe('ADAM');
  });

  test('req.query', async () => {
    expect.assertions(1);
    const server = Server();
    const team = new Teamwork.Team();

    server.get('/', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        name: Joi.string().uppercase(),
        page: Joi.number().default(1),
      }),
    }), team.attend.bind(team));


    server.inject({
      url: '/?name=john',
    });

    const { query } = await team.work;

    expect(query).toEqual({
      name: 'JOHN',
      page: 1,
    });
  });

  test('req.body', async () => {
    expect.assertions(1);
    const server = Server();
    const team = new Teamwork.Team();

    server.post('/', celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string().default('Smith'),
        role: Joi.string().uppercase(),
      },
    }), team.attend.bind(team));

    server.inject({
      url: '/',
      method: 'post',
      payload: {
        first: 'john',
        role: 'admin',
      },
    });

    const { body } = await team.work;
    expect(body).toEqual({
      first: 'john',
      role: 'ADMIN',
      last: 'Smith',
    });
  });
});

describe('reqContext', () => {
  test('passes req as Joi context during validation', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team({ meetings: 2 });

    server.post('/:userId', celebrate({
      [Segments.BODY]: {
        id: Joi.number().valid(Joi.ref('$params.userId')),
      },
      [Segments.PARAMS]: {
        userId: Joi.number().integer().required(),
      },
    }, null, {
      reqContext: true,
    }), (req, res) => {
      team.attend(req);
      res.send();
    });

    server.inject({
      method: 'POST',
      url: '/12345',
      payload: {
        id: 12345,
      },
    }, team.attend.bind(team));

    const [req, res] = await team.work;
    expect(req.body.id).toEqual(req.params.userId);
    expect(res.statusCode).toBe(200);
  });

  test('fails validation based on req values', async () => {
    expect.assertions(2);
    const server = Server();
    const team = new Teamwork.Team();
    const next = jest.fn();

    server.post('/:userId', celebrate({
      [Segments.BODY]: {
        id: Joi.number().valid(Joi.ref('$params.userId')),
      },
      [Segments.PARAMS]: {
        userId: Joi.number().integer().required(),
      },
    }, null, {
      reqContext: true,
    }), next);

    server.inject({
      method: 'POST',
      url: '/123',
      payload: {
        id: 12345,
      },
    }, team.attend.bind(team));

    const res = await team.work;

    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('multiple-runs', () => {
  test('continues to set default values', () => {
    expect.assertions(10);
    const server = Server();

    server.get('/', celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/json/),
        'secret-header': Joi.string().default('@@@@@@'),
      },
    }, {
      allowUnknown: true,
    }), (req, res) => {
      delete req.headers.host; // this can change computer to computer, so just remove it
      res.send(req.headers);
    });

    const attempts = Array.from({ length: 10 }, () => new Promise((resolve) => server.inject({
      method: 'GET',
      url: '/',
      headers: {
        accept: 'application/json',
      },
    }, (r) => {
      resolve(JSON.parse(r.payload));
    })));

    return Promise.all(attempts).then((v) => {
      v.forEach((headers) => {
        expect(headers).toEqual({
          accept: 'application/json',
          'user-agent': 'shot',
          'secret-header': '@@@@@@',
        });
      });
    });
  });

  test('continues to validate values', () => {
    expect.assertions(10);
    const server = Server();

    server.post('/', celebrate({
      [Segments.BODY]: {
        name: Joi.string().required(),
      },
    }));

    const attempts = Array.from({ length: 10 }, () => new Promise((resolve) => server.inject({
      method: 'POST',
      url: '/',
      payload: {
        age: random.number(),
      },
      headers: {
        accept: 'application/json',
      },
    }, (r) => {
      resolve(r.statusCode);
    })));

    return Promise.all(attempts).then((v) => {
      v.forEach((statusCode) => {
        expect(statusCode).toEqual(500);
      });
    });
  });
});
