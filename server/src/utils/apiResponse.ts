import type { Response } from 'express';

/**
 * Standardized API response helpers.
 * Ensures every response follows the same shape:
 *   { success: true/false, data: {}, message: "..." }
 */

class ApiResponse {
  /**
   * Send a success response.
   */
  static success(res: Response, statusCode: number, message: string, data: unknown = null): Response {
    const response: Record<string, unknown> = { success: true, message };
    if (data !== null) {
      response.data = data;
    }
    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response.
   */
  static error(res: Response, statusCode: number, message: string, errors: unknown = null): Response {
    const response: Record<string, unknown> = { success: false, message };
    if (errors !== null) {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  }
}

export default ApiResponse;
