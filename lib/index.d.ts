import { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * Creates a Celebrate middleware function.
 * @param {object} schema object where each key is one of ["params", "headers", "query", "body"] and the value is
 * a Joi schema.
 * @param {object} config optional configuration options that will be passed directly into Joi.
 */
declare function Celebrate (schema: {
    params?: object,
    headers?: object,
    query?: object,
    body?: object,
}, config?: object): RequestHandler;

declare namespace Celebrate {
    /**
     * Creates a Celebrate error handler middleware function
     */
    function errors(): ErrorRequestHandler;
}

export = Celebrate;
