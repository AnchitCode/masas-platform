const createSuccessResponse = (
  message = 'Success',
  data = null
) => {
  return {
    success: true,
    message,
    data,
  };
};

const createErrorResponse = (
  message = 'Error',
  errors = null
) => {
  return {
    success: false,
    message,
    errors,
  };
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
};