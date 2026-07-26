import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
import { formatZodError } from '../../lib/format-zod-error';

/**
 * Validates req.params against a Zod schema. On failure, responds 400 with
 * every failing field and why, instead of letting a malformed param (e.g. a
 * non-UUID id) reach the route handler and blow up as a 500 downstream.
 */
export const validateParams = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid request parameters',
        errors: formatZodError(result.error),
      });
    }

    next();
  };
};
