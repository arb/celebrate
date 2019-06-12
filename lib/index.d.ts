import { ErrorRequestHandler, RequestHandler } from 'express';
import { Root as joi, ValidationOptions } from '@hapi/joi';

declare namespace Celebrate {
    /**
    * Creates a Celebrate middleware function.
    */
    function celebrate(schema: {
        /**
         * When `params` is set, `joi` will validate `req.params` with the supplied schema.
         */
        params?: object,
        /**
         * When `headers` is set, `joi` will validate `req.headers` with the supplied schema.
         */
        headers?: object,
        /**
         * When `query` is set, `joi` will validate `req.query` with the supplied schema.
         */
        query?: object,
        /**
         * When `cookies` is set, `joi` will validate `req.cookies` with the supplied schema.
         */
        cookies?: object,
        /**
         * When `signedCookies` is set, `joi` will validate `req.signedCookies` with the supplied schema.
         */
        signedCookies?: object,
        /**
         * When `body` is set, `joi` will validate `req.body` with the supplied schema.
         */
        body?: object,
    },  
    joiOptions?: ValidationOptions,
    celebrateOptions?: {
        /**
         * When `true` uses the entire `req` object as the `context` value during validation. 
         */
       reqContext: boolean, 
    }): RequestHandler
    /**
     * Creates a Celebrate error handler middleware function.
     */
    function errors(): () => ErrorRequestHandler;
    /**
     * The Joi version Celebrate uses internally.
     */
    export const Joi: joi;

    /**
     * Examines an error object to determine if it originated from the celebrate middleware.
     */
    function isCelebrate(err: object): boolean;
}

export = Celebrate;