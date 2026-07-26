import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
import { formatZodError } from '../../lib/format-zod-error';

/**
 * Validates req.query against a Zod schema. On failure, responds 400 with
 * every failing field and why. On success, req.query is replaced with the
 * parsed (and coerced) value.
 *
 * Express 5 makes req.query a getter-only property (no plain setter), so a
 * direct `req.query = ...` assignment throws. Object.defineProperty
 * sidesteps that by redefining the (configurable) property outright.
 */
export const validateQuery = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid query parameters',
        errors: formatZodError(result.error),
      });
    }

    Object.defineProperty(req, 'query', {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
};
