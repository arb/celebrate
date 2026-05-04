import { describe, test, mock } from 'node:test';
import { expect } from 'expect';
import Express from 'express';
import signature from 'cookie-signature';
import CookieParser from 'cookie-parser';
import { faker } from '@faker-js/faker';
import {
  celebrate,
  Joi,
  Segments,
  isCelebrateError,
} from '../lib/index.js';

const cookieSecret = faker.string.alphanumeric();

const Server = () => {
  const app = Express();
  app.use(CookieParser(cookieSecret));
  app.use(Express.json());

  // Tests register their routes on this child router. Mounting the error
  // handler on the parent app right after the router means any CelebrateError
  // that bubbles out of a celebrate middleware lands here, where the test can
  // inspect it via `server.errors.error`.
  const router = Express.Router();
  const errors = { error: null };

  app.use(router);
  app.use((err, req, res, _next) => {
    errors.error = err;
    res.status(isCelebrateError(err) ? 400 : 500).end();
  });

  // Drives the app over real HTTP on a per-call ephemeral port. The whole
  // chain is awaited so node:test sees a complete unit of work: listen,
  // fetch, then full server close before resolving with the response.
  const inject = async (options) => {
    const httpServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => httpServer.once('listening', resolve));
    try {
      const { port } = httpServer.address();
      const response = await fetch(`http://127.0.0.1:${port}${options.url}`, {
        method: options.method ?? 'GET',
        headers: {
          'user-agent': 'shot',
          connection: 'close',
          ...(options.payload && { 'content-type': 'application/json' }),
          ...options[Segments.HEADERS],
        },
        body: options.payload && JSON.stringify(options.payload),
      });
      return {
        statusCode: response.status,
        payload: await response.text(),
      };
    } finally {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  };

  // Hand back an explicit test handle so tests have a single `server` object
  // for route registration, request injection, and error inspection -- without
  // mutating Express's router/app objects.
  return {
    get: router.get.bind(router),
    post: router.post.bind(router),
    use: router.use.bind(router),
    inject,
    errors,
  };
};

describe('validations', () => {
  test('req.headers', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.get('/', celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/xml/),
      },
    }, {
      allowUnknown: true,
    }), next);

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/',
      [Segments.HEADERS]: {
        accept: 'application/json',
      },
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.HEADERS)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });

  test('req.params', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.get('/user/:id', celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().token(),
      },
    }), next);

    const { statusCode } = await server.inject({
      method: 'get',
      url: '/user/@@',
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.PARAMS)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });

  test('req.query', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.get('/', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        start: Joi.date(),
      }),
    }), next);

    const { statusCode } = await server.inject({
      url: '/?end=celebrate',
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.QUERY)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });

  test('req.cookies', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.post('/', celebrate({
      cookies: {
        state: Joi.number().required(),
      },
    }), next);

    const { statusCode } = await server.inject({
      url: '/',
      method: 'post',
      [Segments.HEADERS]: {
        Cookie: 'state=notanumber',
      },
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.COOKIES)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });

  test('req.signedCookies', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.get('/', celebrate({
      [Segments.SIGNEDCOOKIES]: {
        state: Joi.number().required(),
      },
    }), next);

    const val = signature.sign('notanumber', cookieSecret);

    const { statusCode } = await server.inject({
      url: '/',
      method: 'get',
      [Segments.HEADERS]: {
        Cookie: `state=s:${val}`,
      },
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.SIGNEDCOOKIES)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });

  test('req.body', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

    server.post('/', celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string(),
        role: Joi.number().integer(),
      },
    }), next);

    const { statusCode } = await server.inject({
      url: '/',
      method: 'post',
      payload: {
        first: 'john',
        last: 123,
      },
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.BODY)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
  });
});

// These tests assert on the post-celebrate `req` (defaults applied, values
// coerced) which only exists inside the route handler's closure. A simple
// `let captured` smuggles that req out to the assertion scope -- no deferred
// or queue is needed because `inject()` awaits the full request lifecycle
// (listen, fetch, handler, close) before resolving, so by the time the
// `await` returns the closure has already run.
describe('update req values', () => {
  test('req.headers', async () => {
    expect.assertions(1);
    const server = Server();
    let captured;

    server.get('/', celebrate({
      [Segments.HEADERS]: {
        accept: Joi.string().regex(/json/),
        'secret-header': Joi.string().default('@@@@@@'),
      },
    }, {
      allowUnknown: true,
    }), (req, res) => {
      captured = req;
      res.send();
    });

    await server.inject({
      method: 'GET',
      url: '/',
      [Segments.HEADERS]: {
        accept: 'application/json',
      },
    });

    expect(captured.headers['secret-header']).toBe('@@@@@@');
  });

  test('req.params', async () => {
    expect.assertions(1);
    const server = Server();
    let captured;

    server.get('/user/:id', celebrate({
      [Segments.PARAMS]: {
        id: Joi.string().uppercase(),
      },
    }), (req, res) => {
      captured = req;
      res.send();
    });

    await server.inject({
      method: 'get',
      url: '/user/adam',
    });

    expect(captured.params.id).toBe('ADAM');
  });

  test('req.query', async () => {
    expect.assertions(1);
    const server = Server();
    let captured;

    server.get('/', celebrate({
      [Segments.QUERY]: Joi.object().keys({
        name: Joi.string().uppercase(),
        page: Joi.number().default(1),
      }),
    }), (req, res) => {
      captured = req;
      res.send();
    });

    await server.inject({
      url: '/?name=john',
    });

    expect(captured.query).toEqual({
      name: 'JOHN',
      page: 1,
    });
  });

  test('req.body', async () => {
    expect.assertions(1);
    const server = Server();
    let captured;

    server.post('/', celebrate({
      [Segments.BODY]: {
        first: Joi.string().required(),
        last: Joi.string().default('Smith'),
        role: Joi.string().uppercase(),
      },
    }), (req, res) => {
      captured = req;
      res.send();
    });

    await server.inject({
      url: '/',
      method: 'post',
      payload: {
        first: 'john',
        role: 'admin',
      },
    });

    expect(captured.body).toEqual({
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
    // Same closure-capture trick as the `update req values` block above, plus
    // the response status from the inject() return value.
    let captured;

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
      captured = req;
      res.send();
    });

    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/12345',
      payload: {
        id: 12345,
      },
    });

    expect(captured.body.id).toEqual(captured.params.userId);
    expect(statusCode).toBe(200);
  });

  test('fails validation based on req values', async () => {
    expect.assertions(4);
    const server = Server();
    const next = mock.fn();

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

    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/123',
      payload: {
        id: 12345,
      },
    });

    expect(statusCode).toBe(400);
    expect(isCelebrateError(server.errors.error)).toBe(true);
    expect(server.errors.error.details.has(Segments.BODY)).toBe(true);
    expect(next.mock.callCount()).toBe(0);
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
      res.send(req.headers);
    });

    const attempts = Array.from({ length: 10 }, async () => {
      const { payload } = await server.inject({
        method: 'GET',
        url: '/',
        headers: {
          accept: 'application/json',
        },
      });
      return JSON.parse(payload);
    });

    return Promise.all(attempts).then((v) => {
      v.forEach((headers) => {
        expect(headers['secret-header']).toBe('@@@@@@');
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

    const attempts = Array.from({ length: 10 }, async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/',
        payload: {
          age: faker.number.int(),
        },
        headers: {
          accept: 'application/json',
        },
      });
      return statusCode;
    });

    return Promise.all(attempts).then((v) => {
      v.forEach((statusCode) => {
        expect(statusCode).toEqual(400);
      });
    });
  });
});
