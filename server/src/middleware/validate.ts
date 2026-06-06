import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import ApiError from '../utils/apiError.js';

/**
 * Generic Zod validation middleware factory.
 * Validates req.body, req.query, or req.params against a Zod schema.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema, 'body'), controller.register);
 */
const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((err) => ({
        field: err.path.length ? err.path.join('.') : '(request)',
        message: err.message,
      }));

      const detailMessage =
        formattedErrors.length === 1
          ? formattedErrors[0].message
          : `Validation failed: ${formattedErrors.map((e) => `${e.field} — ${e.message}`).join('; ')}`;

      next(ApiError.badRequest(detailMessage, formattedErrors));
      return;
    }

    // Replace the source with the parsed (and potentially transformed) data
    (req as unknown as Record<string, unknown>)[source] = result.data;
    next();
  };
};

export default validate;
