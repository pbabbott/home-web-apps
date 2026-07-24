import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
import { formatZodError } from '../../lib/format-zod-error';

/**
 * Validates req.body against a Zod schema. On failure, responds 400 with
 * every failing field and why, instead of letting a malformed request reach
 * the route handler (and, from there, a datastore that then 500s on it).
 * On success, req.body is replaced with the parsed (and coerced) value.
 */
export const validateBody = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: formatZodError(result.error),
      });
    }

    req.body = result.data;
    next();
  };
};
