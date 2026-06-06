import type { ApiSuccessResponseBody, ApiErrorResponseBody } from '../types/index.js';

const createSuccessResponse = <T = unknown>(
  message = 'Success',
  data: T | null = null,
): ApiSuccessResponseBody<T> => {
  const response: ApiSuccessResponseBody<T> = {
    success: true,
    message,
  };
  if (data !== null) {
    response.data = data;
  }
  return response;
};

const createErrorResponse = (
  message = 'Error',
  errors: Array<{ field: string; message: string }> | null = null,
): ApiErrorResponseBody => {
  const response: ApiErrorResponseBody = {
    success: false,
    message,
  };
  if (errors !== null) {
    response.errors = errors;
  }
  return response;
};

export {
  createSuccessResponse,
  createErrorResponse,
};
