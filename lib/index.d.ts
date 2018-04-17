import { ErrorRequestHandler, RequestHandler } from 'express';
import { Root as joi } from 'joi';

declare function Celebrate (Joi: joi): {
    /**
    * Creates a Celebrate middleware function.
    * @param {Object} schema - object where each key is one of ["params", "headers", "query", "body"] and the value is
    * a Joi schema.
    * @param {Object} [config] - optional configuration options that will be passed directly into Joi.
    * @returns {Function} an express middleware function
    */
    celebrate(schema: {
        params?: object,
        headers?: object,
        query?: object,
        body?: object,
    }, config?: object): RequestHandler
    /**
    * Creates a Celebrate error handler middleware function.
    * @returns {Function} an express error handler function
    */
    errors(): ErrorRequestHandler;
    /**
    * Examines an error object to determine if it originated from the celebrate middleware.
    * @param {Object} err - error object to check
    * @returns {boolean}
    */
    isCelebrate(err:object): boolean;
    /**
    * The Joi version passed into Celebrate
    */
    Joi: joi;
};
export = Celebrate;