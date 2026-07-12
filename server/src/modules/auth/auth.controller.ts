import type { Request, Response, NextFunction } from 'express';
import authService from './auth.service.js';
import ApiResponse from '../../utils/apiResponse.js';
import env from '../../config/env.js';
import type { AuthenticatedRequest } from '../../types/index.js';

/** Cookie max-age constants */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Helper to set the refresh token cookie with consistent options.
 */
function setRefreshCookie(res: Response, refreshToken: string, rememberMe = false) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    maxAge: rememberMe ? THIRTY_DAYS_MS : SEVEN_DAYS_MS,
    path: '/',
  });
}

/**
 * Helper to clear the refresh token cookie.
 */
function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  });
}

/**
 * Auth controller — handles HTTP requests for authentication.
 * Each method wraps the service call and sends a standardized response.
 */
const authController = {
  /**
   * POST /api/v1/auth/register
   * Returns success message — no tokens (user must verify email first).
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body, req);

      return ApiResponse.success(res, 201, 'Account created. Please check your email to verify your address.', {
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body, req);
      const rememberMe = req.body.rememberMe === true;

      setRefreshCookie(res, refreshToken, rememberMe);

      return ApiResponse.success(res, 200, 'Login successful', {
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/google
   */
  async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, accessToken, refreshToken, isNewUser } = await authService.googleAuth(
        req.body.idToken,
        req,
      );

      setRefreshCookie(res, refreshToken);

      return ApiResponse.success(res, isNewUser ? 201 : 200, isNewUser ? 'Account created via Google' : 'Google login successful', {
        user,
        accessToken,
        isNewUser,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.forgotPassword(req.body.email, req);
      return ApiResponse.success(res, 200, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password, req);

      // Clear any existing refresh cookie
      clearRefreshCookie(res);

      return ApiResponse.success(res, 200, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/verify-email?token=xxx
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.query.token as string;
      const result = await authService.verifyEmail(token, req);
      return ApiResponse.success(res, 200, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/resend-verification
   */
  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.resendVerification(req.body.email, req);
      return ApiResponse.success(res, 200, result.message);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies.refreshToken as string | undefined;
      const { accessToken, refreshToken } = await authService.refresh(token, req);

      // Rotate refresh token cookie
      setRefreshCookie(res, refreshToken);

      return ApiResponse.success(res, 200, 'Token refreshed', { accessToken });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await authService.getMe(authReq.user.userId);
      return ApiResponse.success(res, 200, 'User profile retrieved', { user });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshTokenJwt = req.cookies.refreshToken as string | undefined;

      // Try to extract userId for audit log
      let userId: string | undefined;
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const { verifyAccessToken } = await import('../../utils/jwt.js');
          const decoded = verifyAccessToken(authHeader.split(' ')[1]);
          userId = decoded.userId;
        }
      } catch {
        // Can't extract userId — that's fine for logout
      }

      await authService.logout(refreshTokenJwt, req, userId);

      clearRefreshCookie(res);

      return ApiResponse.success(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },
};

export default authController;
