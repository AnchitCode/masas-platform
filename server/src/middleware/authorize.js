const ApiError = require('../utils/apiError');

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER the auth middleware (requires req.user).
 *
 * @param {...string} allowedRoles - Roles permitted to access this route
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.get('/admin', auth, authorize('ADMIN'), controller.dashboard);
 *   router.post('/inventory', auth, authorize('PHARMACY'), controller.addItem);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Role '${req.user.role}' is not authorized to access this resource`
      );
    }

    next();
  };
};

module.exports = authorize;
