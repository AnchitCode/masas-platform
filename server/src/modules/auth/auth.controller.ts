import type { Request, Response, NextFunction } from 'express';
import authService from './auth.service.js';
import ApiResponse from '../../utils/apiResponse.js';
import env from '../../config/env.js';
import type { AuthenticatedRequest } from '../../types/index.js';

/**
 * Auth controller — handles HTTP requests for authentication.
 * Each method wraps the service call and sends a standardized response.
 */
const authController = {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: env.isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return ApiResponse.success(res, 201, 'User registered successfully', {
        user,
        accessToken,
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
      const { user, accessToken, refreshToken } = await authService.login(req.body);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: env.isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      return ApiResponse.success(res, 200, 'Login successful', {
        user,
        accessToken,
      });
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
      const { accessToken, refreshToken } = await authService.refresh(token);

      // Rotate refresh token cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: env.isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

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
  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.isProd,
        sameSite: env.isProd ? 'none' : 'lax',
        path: '/',
      });

      return ApiResponse.success(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  },
};

export default authController;
