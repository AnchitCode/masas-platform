import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import ApiResponse from '../utils/apiResponse.js';
import type ApiError from '../utils/apiError.js';

interface PrismaError extends Error {
  code?: string;
}

interface ZodError extends Error {
  name: 'ZodError';
  errors: Array<{ path: (string | number)[]; message: string }>;
}

/**
 * Global error handler middleware.
 * Must be registered LAST in the middleware chain (after all routes).
 * Catches all errors — operational (ApiError) and unexpected.
 */
const errorHandler = (err: Error & Partial<ApiError> & Partial<PrismaError>, req: Request, res: Response, _next: NextFunction): Response => {
  // Log the error
  logger.error(err.message, {
    statusCode: (err as ApiError).statusCode || 500,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma known errors
  if ((err as PrismaError).code === 'P2002') {
    return ApiResponse.error(res, 409, 'A record with this value already exists');
  }

  if ((err as PrismaError).code === 'P2025') {
    return ApiResponse.error(res, 404, 'Record not found');
  }

  // Zod validation errors (thrown from validate middleware)
  if (err.name === 'ZodError') {
    const zodErr = err as unknown as ZodError;
    const formattedErrors = zodErr.errors.map((e) => ({
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
  if ((err as ApiError).isOperational) {
    return ApiResponse.error(res, (err as ApiError).statusCode, err.message, (err as ApiError).errors);
  }

  // Unexpected errors — don't leak details in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  return ApiResponse.error(res, 500, message);
};

export default errorHandler;
