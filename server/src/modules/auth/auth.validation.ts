import { z } from 'zod';

/**
 * Auth module Zod validation schemas.
 * Zod v4 uses `error` (string) instead of `required_error`.
 */

const registerSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  role: z
    .enum(['PHARMACY', 'ADMIN'], {
      error: 'Role must be PHARMACY or ADMIN',
    })
    .default('PHARMACY'),
});

const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export {
  registerSchema,
  loginSchema,
};
