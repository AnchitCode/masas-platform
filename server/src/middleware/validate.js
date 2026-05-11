const ApiError = require('../utils/apiError');

/**
 * Generic Zod validation middleware factory.
 * Validates req.body, req.query, or req.params against a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Which part of the request to validate
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.post('/register', validate(registerSchema, 'body'), controller.register);
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return next(ApiError.badRequest('Validation failed', formattedErrors));
    }

    // Replace the source with the parsed (and potentially transformed) data
    req[source] = result.data;
    next();
  };
};

module.exports = validate;
