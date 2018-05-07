import { ErrorRequestHandler, RequestHandler } from 'express';
import { Root as joi } from 'joi';

declare namespace Celebrate {
    /**
    * Creates a Celebrate middleware function.
    * @param {Object} schema - object where each key is one of ["params", "headers", "query", "body"] and the value is
    * a Joi schema.
    * @param {Object} [config] - optional configuration options that will be passed directly into Joi.
    * @returns {Function} an express middleware function
    */
    function celebrate(schema: {
        params?: object,
        headers?: object,
        query?: object,
        body?: object,
    }, config?: object): RequestHandler
    /**
     * Creates a Celebrate error handler middleware function.
     * @returns {Function} an express error handler function
     */
    function errors(): ErrorRequestHandler;
    /**
     * The Joi version Celebrate uses internally.
     */
    export const Joi: joi;

    /**
     * Examines an error object to determine if it originated from the celebrate middleware.
     * @param {Object} err - error object to check
     * @returns {boolean}
     */
    function isCelebrate(err:object): boolean;
}

export = Celebrate;
