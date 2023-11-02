import { ErrorRequestHandler, RequestHandler } from 'express';
import { ParamsDictionary, Query } from 'express-serve-static-core';
import * as Joi from 'joi';


export declare enum Segments {
    PARAMS        = 'params',
    HEADERS       = 'headers',
    QUERY         = 'query',
    COOKIES       = 'cookies',
    SIGNEDCOOKIES = 'signedCookies',
    BODY          = 'body',
}

export declare enum Modes {
    FULL = 'full',
    PARTIAL = 'partial',
}

interface Celebrator1<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query> {
  (joiOpts: Joi.ValidationOptions): Celebrator2;
  (joiOpts: Joi.ValidationOptions, requestRules: SchemaOptions): RequestHandler<P, ResBody, ReqBody, ReqQuery>;
}

interface Celebrator2 {
  (requestRules: SchemaOptions): RequestHandler;
}

interface Celebrator<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query> {
    (opts: CelebrateOptions): Celebrator1;
    (opts: CelebrateOptions, joiOpts: Joi.ValidationOptions): Celebrator2;
    (
        opts: CelebrateOptions,
        joiOpts: Joi.ValidationOptions,
        requestRules: SchemaOptions
    ): RequestHandler<P, ResBody, ReqBody, ReqQuery>;
  }

export interface CelebrateOptions {
    /**
     * When `true` uses the entire `req` object as the `context` value during validation.
     */
    reqContext?: boolean;
    /**
     * Which validation mode celebrate should use. Defaults to `PARTIAL`.
     */
    mode?: Modes;
}

export interface SchemaOptions {
    /**
     * When `params` is set, `joi` will validate `req.params` with the supplied schema.
     */
    params?: object;
    /**
     * When `headers` is set, `joi` will validate `req.headers` with the supplied schema.
     */
    headers?: object;
    /**
     * When `query` is set, `joi` will validate `req.query` with the supplied schema.
     */
    query?: object;
    /**
     * When `cookies` is set, `joi` will validate `req.cookies` with the supplied schema.
     */
    cookies?: object;
    /**
     * When `signedCookies` is set, `joi` will validate `req.signedCookies` with the supplied schema.
     */
    signedCookies?: object;
    /**
     * When `body` is set, `joi` will validate `req.body` with the supplied schema.
     */
    body?: object;
}

/**
* Creates a celebrate middleware function.
*/
export declare function celebrate<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query>(requestRules: SchemaOptions, joiOpts?: Joi.ValidationOptions, opts?: CelebrateOptions): RequestHandler<P, ResBody, ReqBody, ReqQuery>;

/**
 * Curried version of `celebrate`.
 */
export declare const celebrator: Celebrator;

/**
 * Creates a Celebrate error handler middleware function.
 */
export declare function errors<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query>(opts?: { statusCode: number }): ErrorRequestHandler<P, ResBody, ReqBody, ReqQuery>;

/**
 * The Joi version Celebrate uses internally.
 */
export { Joi };

/**
 * Examines an error object to determine if it originated from the celebrate middleware.
 */
export declare function isCelebrateError(err: any): err is CelebrateError;

/**
 * The standard error used by Celebrate
 */
export declare class CelebrateError extends Error {
    details: Map<string, Joi.ValidationError>;
    constructor(message?:string, opts?: { celebrated?: boolean });
}
