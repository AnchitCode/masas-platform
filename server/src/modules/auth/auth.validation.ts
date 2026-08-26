import { z } from 'zod';

/**
 * Auth module Zod validation schemas.
 * Zod v4 uses `error` (string) instead of `required_error`.
 */

// ─── Registration (public — PHARMACY or CUSTOMER) ────────────────

const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  // Only PHARMACY and CUSTOMER allowed via public registration.
  // ADMIN accounts are created ONLY via seed script.
  role: z
    .enum(['PHARMACY', 'CUSTOMER'])
    .default('PHARMACY'),
});

// ─── Login ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
  rememberMe: z
    .boolean()
    .default(false),
});

// ─── Google Auth ─────────────────────────────────────────────────

const googleAuthSchema = z.object({
  idToken: z
    .string({ error: 'Google ID token is required' })
    .min(1, 'Google ID token is required'),
  // Only used for NEW users. Existing users always keep their DB role.
  role: z
    .enum(['PHARMACY', 'CUSTOMER'])
    .optional()
    .default('PHARMACY'),
});

// ─── Forgot Password ────────────────────────────────────────────

const forgotPasswordSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

// ─── Reset Password ─────────────────────────────────────────────

const resetPasswordSchema = z.object({
  token: z
    .string({ error: 'Reset token is required' })
    .min(1, 'Reset token is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

// ─── Verify Email ────────────────────────────────────────────────

const verifyEmailSchema = z.object({
  token: z
    .string({ error: 'Verification token is required' })
    .min(1, 'Verification token is required'),
});

// ─── Resend Verification ─────────────────────────────────────────

const resendVerificationSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
});

// ─── Type Exports ────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
};
