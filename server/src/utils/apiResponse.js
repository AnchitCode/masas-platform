/**
 * Standardized API response helpers.
 * Ensures every response follows the same shape:
 *   { success: true/false, data: {}, message: "..." }
 */

class ApiResponse {
  /**
   * Send a success response.
   * @param {import('express').Response} res
   * @param {number} statusCode - HTTP status code (200, 201, etc.)
   * @param {string} message - Human-readable message
   * @param {any} data - Response payload
   */
  static success(res, statusCode, message, data = null) {
    const response = { success: true, message };
    if (data !== null) {
      response.data = data;
    }
    return res.status(statusCode).json(response);
  }

  /**
   * Send an error response.
   * @param {import('express').Response} res
   * @param {number} statusCode - HTTP status code (400, 401, etc.)
   * @param {string} message - Human-readable error message
   * @param {any} errors - Optional validation errors or details
   */
  static error(res, statusCode, message, errors = null) {
    const response = { success: false, message };
    if (errors !== null) {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  }
}

module.exports = ApiResponse;
