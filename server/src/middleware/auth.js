const ApiError = require('../utils/apiError');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.isOperational) {
      next(error);
    } else {
      // JWT verification errors (invalid, expired, etc.)
      next(error);
    }
  }
};


module.exports = auth;
