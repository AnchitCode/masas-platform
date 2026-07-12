import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../lib/prisma.js';
import env from '../../config/env.js';
import ApiError from '../../utils/apiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';
import { generateSecureToken, hashToken } from '../../utils/tokenUtils.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email.js';
import { logAuthEvent } from '../../utils/authAudit.js';
import type { RegisterInput, LoginInput } from './auth.validation.js';

const SALT_ROUNDS = 12;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const REMEMBER_ME_EXPIRY = '30d';
const DEFAULT_REFRESH_EXPIRY = '7d';

// Google OAuth client (singleton)
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Auth service — business logic for authentication.
 */
const authService = {
  // ─── Register ────────────────────────────────────────────────

  /**
   * Register a new PHARMACY user.
   * Creates user with isEmailVerified = false, sends verification email.
   * Does NOT return JWT tokens — user must verify email first.
   */
  async register({ name, email, password }: RegisterInput, req: Request) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user (always PHARMACY, always unverified)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'PHARMACY',
        isEmailVerified: false,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    // Generate verification token (raw → email, hash → database)
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Send verification email
    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
    // Fire-and-forget — don't block registration on email failure
    sendVerificationEmail(email, name || '', verifyUrl).catch(() => {});

    // Audit log
    void logAuthEvent({ userId: user.id, action: 'REGISTER', req });

    return { user };
  },

  // ─── Google Auth ─────────────────────────────────────────────

  /**
   * Authenticate via Google ID token.
   * - Existing user by googleId → login
   * - Existing user by email (no googleId) → link Google account + login
   * - New user → create with isEmailVerified = true
   * - Admin accounts → blocked
   */
  async googleAuth(idToken: string, req: Request) {
    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw ApiError.unauthorized('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists by googleId
    let user = await prisma.user.findUnique({
      where: { googleId },
      select: {
        id: true, email: true, name: true, avatarUrl: true,
        role: true, isEmailVerified: true, tokenVersion: true,
        createdAt: true,
        pharmacy: { select: { id: true, name: true, status: true } },
      },
    });

    let isNewUser = false;

    if (user) {
      // Existing Google-linked user → login
      if (user.role === 'ADMIN') {
        throw ApiError.forbidden('Admin accounts cannot use Google sign-in');
      }
    } else {
      // Check by email
      const existingByEmail = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true, email: true, name: true, avatarUrl: true,
          role: true, isEmailVerified: true, tokenVersion: true,
          googleId: true, createdAt: true,
          pharmacy: { select: { id: true, name: true, status: true } },
        },
      });

      if (existingByEmail) {
        // Block admin accounts
        if (existingByEmail.role === 'ADMIN') {
          throw ApiError.forbidden('Admin accounts cannot use Google sign-in');
        }

        // Link Google account to existing user
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId,
            avatarUrl: picture || existingByEmail.avatarUrl,
            isEmailVerified: true, // Google verified the email
            name: existingByEmail.name || name,
          },
          select: {
            id: true, email: true, name: true, avatarUrl: true,
            role: true, isEmailVerified: true, tokenVersion: true,
            createdAt: true,
            pharmacy: { select: { id: true, name: true, status: true } },
          },
        });

        void logAuthEvent({ userId: user.id, action: 'GOOGLE_LINK', req });
      } else {
        // New user — create
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name: name || null,
            avatarUrl: picture || null,
            googleId,
            isEmailVerified: true, // Google verified the email
            role: 'PHARMACY',
            // passwordHash stays null — Google-only user
          },
          select: {
            id: true, email: true, name: true, avatarUrl: true,
            role: true, isEmailVerified: true, tokenVersion: true,
            createdAt: true,
            pharmacy: { select: { id: true, name: true, status: true } },
          },
        });
        isNewUser = true;

        void logAuthEvent({ userId: user.id, action: 'GOOGLE_REGISTER', req });
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      DEFAULT_REFRESH_EXPIRY,
    );

    // Store refresh token
    await this._storeRefreshToken(user.id, refreshToken, DEFAULT_REFRESH_EXPIRY, req);

    if (!isNewUser) {
      void logAuthEvent({ userId: user.id, action: 'GOOGLE_LOGIN', req });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      pharmacy: user.pharmacy,
      createdAt: user.createdAt,
    };

    return { user: safeUser, accessToken, refreshToken, isNewUser };
  },

  // ─── Login ───────────────────────────────────────────────────

  /**
   * Login with email and password.
   * Checks isEmailVerified before allowing login.
   */
  async login({ email, password, rememberMe }: LoginInput, req: Request) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, name: true, avatarUrl: true,
        passwordHash: true, role: true, isEmailVerified: true,
        tokenVersion: true, createdAt: true,
        pharmacy: { select: { id: true, name: true, status: true } },
      },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Google-only user trying to login with password
    if (!user.passwordHash) {
      throw ApiError.unauthorized('This account uses Google sign-in. Please sign in with Google.');
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check email verification
    if (!user.isEmailVerified) {
      throw ApiError.forbidden('Please verify your email address before signing in. Check your inbox for the verification link.');
    }

    // Generate tokens
    const refreshExpiry = rememberMe ? REMEMBER_ME_EXPIRY : DEFAULT_REFRESH_EXPIRY;
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      refreshExpiry,
    );

    // Store refresh token
    await this._storeRefreshToken(user.id, refreshToken, refreshExpiry, req);

    // Audit log
    void logAuthEvent({ userId: user.id, action: 'LOGIN', req });

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      pharmacy: user.pharmacy,
      createdAt: user.createdAt,
    };

    return { user: safeUser, accessToken, refreshToken };
  },

  // ─── Forgot Password ────────────────────────────────────────

  /**
   * Initiate password reset.
   * Always returns 200 (no user enumeration).
   */
  async forgotPassword(email: string, req: Request) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    // Always return success regardless — but only send email if user exists and has a password
    if (user && user.passwordHash) {
      // Delete existing unused reset tokens
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      // Generate token
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      // Send reset email
      const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
      sendPasswordResetEmail(user.email, user.name || '', resetUrl).catch(() => {});

      void logAuthEvent({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', req });
    }

    // Always return the same response (prevent user enumeration)
    return { message: 'If an account with that email exists, we have sent a password reset link.' };
  },

  // ─── Reset Password ─────────────────────────────────────────

  /**
   * Reset password using a valid token.
   * Invalidates ALL refresh tokens across all devices.
   */
  async resetPassword(rawToken: string, newPassword: string, req: Request) {
    const tokenHash = hashToken(rawToken);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (!resetToken) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    if (resetToken.usedAt) {
      throw ApiError.badRequest('This reset link has already been used');
    }

    if (new Date() > resetToken.expiresAt) {
      throw ApiError.badRequest('This reset link has expired. Please request a new one.');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Transaction: update password + increment tokenVersion + mark token used + revoke all refresh tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    void logAuthEvent({
      userId: resetToken.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      req,
    });

    return { message: 'Password has been reset successfully. Please sign in with your new password.' };
  },

  // ─── Verify Email ────────────────────────────────────────────

  /**
   * Verify email address using a token.
   * Deletes ALL verification tokens for this user after success.
   */
  async verifyEmail(rawToken: string, req: Request) {
    const tokenHash = hashToken(rawToken);

    const verifyToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isEmailVerified: true } } },
    });

    if (!verifyToken) {
      throw ApiError.badRequest('Invalid or expired verification link');
    }

    if (new Date() > verifyToken.expiresAt) {
      throw ApiError.badRequest('This verification link has expired. Please request a new one.');
    }

    // Already verified — idempotent
    if (verifyToken.user.isEmailVerified) {
      // Clean up tokens anyway
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: verifyToken.userId },
      });
      return { message: 'Email has already been verified. You can sign in.' };
    }

    // Transaction: mark verified + delete ALL verification tokens for this user
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verifyToken.userId },
        data: { isEmailVerified: true },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { userId: verifyToken.userId },
      }),
    ]);

    void logAuthEvent({
      userId: verifyToken.userId,
      action: 'EMAIL_VERIFIED',
      req,
    });

    return { message: 'Email verified successfully. You can now sign in.' };
  },

  // ─── Resend Verification ─────────────────────────────────────

  /**
   * Resend verification email.
   * Always returns 200 (no user enumeration).
   */
  async resendVerification(email: string, req: Request) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, isEmailVerified: true },
    });

    if (user && !user.isEmailVerified) {
      // Delete existing tokens
      await prisma.emailVerificationToken.deleteMany({
        where: { userId: user.id },
      });

      // Generate new token
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await prisma.emailVerificationToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      // Send email
      const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawToken}`;
      sendVerificationEmail(user.email, user.name || '', verifyUrl).catch(() => {});

      void logAuthEvent({ userId: user.id, action: 'VERIFICATION_RESENT', req });
    }

    return { message: 'If an account with that email exists and is unverified, we have sent a verification email.' };
  },

  // ─── Refresh Token ───────────────────────────────────────────

  /**
   * Refresh the access token using a valid refresh token.
   * Validates against stored refresh tokens + tokenVersion.
   * Implements token rotation (old token revoked, new one issued).
   */
  async refresh(refreshTokenJwt: string | undefined, req: Request) {
    if (!refreshTokenJwt) {
      throw ApiError.unauthorized('Refresh token is required');
    }

    // Verify JWT
    const decoded = verifyRefreshToken(refreshTokenJwt);

    // Look up stored token
    const storedTokenHash = hashToken(refreshTokenJwt);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: storedTokenHash },
    });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    if (storedToken.revokedAt) {
      throw ApiError.unauthorized('Refresh token has been revoked');
    }

    if (new Date() > storedToken.expiresAt) {
      throw ApiError.unauthorized('Refresh token has expired');
    }

    // Ensure user still exists and tokenVersion matches
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, tokenVersion: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      // Token version mismatch — password was reset, all tokens invalidated
      throw ApiError.unauthorized('Token has been invalidated. Please sign in again.');
    }

    // Rotate: revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
    );

    // Store new refresh token
    await this._storeRefreshToken(user.id, newRefreshToken, DEFAULT_REFRESH_EXPIRY, req);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  // ─── Logout ──────────────────────────────────────────────────

  /**
   * Logout — revoke the refresh token.
   */
  async logout(refreshTokenJwt: string | undefined, req: Request, userId?: string) {
    if (refreshTokenJwt) {
      const tokenHash = hashToken(refreshTokenJwt);
      try {
        await prisma.refreshToken.update({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Token may not exist in DB (from before migration) — that's fine
      }
    }

    void logAuthEvent({ userId, action: 'LOGOUT', req });
  },

  // ─── Get Me ──────────────────────────────────────────────────

  /**
   * Get the current authenticated user's profile.
   */
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  },

  // ─── Internal Helpers ────────────────────────────────────────

  /**
   * Store a refresh token hash in the database for revocation support.
   */
  async _storeRefreshToken(
    userId: string,
    token: string,
    expiresIn: string,
    req: Request,
  ) {
    const tokenHash = hashToken(token);

    // Parse expiry duration
    const daysMatch = expiresIn.match(/^(\d+)d$/);
    const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });
  },
};

export default authService;
