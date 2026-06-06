import type { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/apiError.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Role-based authorization middleware factory.
 * Must be used AFTER the auth middleware (requires req.user).
 *
 * Usage:
 *   router.get('/admin', auth, authorize('ADMIN'), controller.dashboard);
 *   router.post('/inventory', auth, authorize('PHARMACY'), controller.addItem);
 */
const authorize = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      throw ApiError.forbidden(
        `Role '${authReq.user.role}' is not authorized to access this resource`
      );
    }

    next();
  };
};

export default authorize;
