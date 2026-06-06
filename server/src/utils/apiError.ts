/**
 * Custom API error class.
 * Extends native Error with HTTP status codes for cleaner error handling.
 * Thrown in services/controllers, caught by the global error handler.
 */

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, errors: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // Distinguishes expected errors from bugs

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors: unknown = null): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflict'): ApiError {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message);
  }
}

export default ApiError;
