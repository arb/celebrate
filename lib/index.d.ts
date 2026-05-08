import { ErrorRequestHandler, RequestHandler } from 'express';
import { ParamsDictionary, Query } from 'express-serve-static-core';
import * as Joi from 'joi';


export declare const Segments: {
    readonly PARAMS: 'params';
    readonly HEADERS: 'headers';
    readonly QUERY: 'query';
    readonly COOKIES: 'cookies';
    readonly SIGNEDCOOKIES: 'signedCookies';
    readonly BODY: 'body';
};
export type Segments = typeof Segments[keyof typeof Segments];

export declare const Modes: {
    readonly FULL: 'full';
    readonly PARTIAL: 'partial';
};
export type Modes = typeof Modes[keyof typeof Modes];

interface Celebrator2<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query> {
  (requestRules: SchemaOptions): RequestHandler<P, ResBody, ReqBody, ReqQuery>;
}

interface Celebrator1<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query> {
  (joiOpts: Joi.ValidationOptions): Celebrator2<P, ResBody, ReqBody, ReqQuery>;
  (joiOpts: Joi.ValidationOptions, requestRules: SchemaOptions): RequestHandler<P, ResBody, ReqBody, ReqQuery>;
}

interface Celebrator<P=ParamsDictionary, ResBody=any, ReqBody=any, ReqQuery=Query> {
    (opts: CelebrateOptions): Celebrator1<P, ResBody, ReqBody, ReqQuery>;
    (opts: CelebrateOptions, joiOpts: Joi.ValidationOptions): Celebrator2<P, ResBody, ReqBody, ReqQuery>;
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
    params?: Joi.SchemaLike;
    /**
     * When `headers` is set, `joi` will validate `req.headers` with the supplied schema.
     */
    headers?: Joi.SchemaLike;
    /**
     * When `query` is set, `joi` will validate `req.query` with the supplied schema.
     */
    query?: Joi.SchemaLike;
    /**
     * When `cookies` is set, `joi` will validate `req.cookies` with the supplied schema.
     */
    cookies?: Joi.SchemaLike;
    /**
     * When `signedCookies` is set, `joi` will validate `req.signedCookies` with the supplied schema.
     */
    signedCookies?: Joi.SchemaLike;
    /**
     * When `body` is set, `joi` will validate `req.body` with the supplied schema.
     */
    body?: Joi.SchemaLike;
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
export declare function errors(opts?: { statusCode?: number; message?: string }): ErrorRequestHandler;

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
