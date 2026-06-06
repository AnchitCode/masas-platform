import type { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/apiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 */
const auth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    (req as unknown as Record<string, unknown>).user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Pass both operational and JWT verification errors to error handler
    next(error);
  }
};

export default auth;
