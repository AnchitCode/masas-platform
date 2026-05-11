const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain (after all routes).
 * Catches all errors — operational (ApiError) and unexpected.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Log the error
  logger.error(err.message, {
    statusCode: err.statusCode || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma known errors
  if (err.code === 'P2002') {
    return ApiResponse.error(res, 409, 'A record with this value already exists');
  }

  if (err.code === 'P2025') {
    return ApiResponse.error(res, 404, 'Record not found');
  }

  // Zod validation errors (thrown from validate middleware)
  if (err.name === 'ZodError') {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.error(res, 400, 'Validation failed', formattedErrors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 401, 'Token expired');
  }

  // Operational errors (our ApiError instances)
  if (err.isOperational) {
    return ApiResponse.error(res, err.statusCode, err.message, err.errors);
  }

  // Unexpected errors — don't leak details in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  return ApiResponse.error(res, 500, message);
};

module.exports = errorHandler;
