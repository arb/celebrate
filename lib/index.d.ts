import { ErrorRequestHandler, RequestHandler } from 'express';
import {
    Root as joi,
    ValidationOptions,
    ValidationError,
    ValidationResult,
} from '@hapi/joi';


export declare enum Segments {
    PARAMS        = 'params',
    HEADERS       = 'headers',
    QUERY         = 'query',
    COOKIES       = 'cookies',
    SIGNEDCOOKIES = 'signedCookies',
    BODY          = 'body',
}


interface CelebrateInternalError {
    joi: ValidationError;
    meta: { source: Segments };
}

interface Celebrator1 {
  (joiOpts: ValidationOptions): Celebrator2;
  (joiOpts: ValidationOptions, requestRules: SchemaOptions): RequestHandler;
}

interface Celebrator2 {
  (requestRules: SchemaOptions): RequestHandler;
}

interface Celebrator {
    (opts: CelebrateOptions): Celebrator1;
    (opts: CelebrateOptions, joiOpts: ValidationOptions): Celebrator2;
    (
        opts: CelebrateOptions,
        joiOpts: ValidationOptions,
        requestRules: SchemaOptions
    ): RequestHandler;
  }

export interface CelebrateOptions {
    /**
     * When `true` uses the entire `req` object as the `context` value during validation.
     */
    reqContext?: boolean;
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
export declare function celebrate(requestRules: SchemaOptions, joiOpts?: ValidationOptions, opts?: CelebrateOptions): RequestHandler;

/**
 * Curried version of `celebrate`.
 */
export declare const celebrator: Celebrator;

/**
 * Creates a Celebrate error handler middleware function.
 */
export declare function errors(opts?: { statusCode: number }): ErrorRequestHandler;

/**
 * The Joi version Celebrate uses internally.
 */
export declare const Joi: joi;

/**
 * Examines an error object to determine if it originated from the celebrate middleware.
 */
export declare function isCelebrate(err: object): boolean;

/**
 * The standard error used by Celebrate
 */
export declare function CelebrateError(error: ValidationError, segment: Segments, opts?: { celebrated?: boolean }): Error & CelebrateInternalError;
