const { z } = require('zod');

/**
 * Admin module Zod validation schemas.
 */

/**
 * GET /api/v1/admin/pharmacies — query params
 * Reuses pagination logic from common.validation but keeps the schema self-contained
 * so the validate middleware can parse req.query as a single shape.
 */
const listPharmaciesSchema = z.object({
  status: z
    .enum(['PENDING', 'VERIFIED', 'REJECTED'], {
      errorMap: () => ({ message: 'Status must be PENDING, VERIFIED, or REJECTED' }),
    })
    .optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().min(1, 'Page must be at least 1')),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().min(1).max(50, 'Limit cannot exceed 50')),
});

/**
 * PATCH /api/v1/admin/pharmacies/:id/status — body
 * rejectionReason is optional for now; not persisted to DB until a notification system exists.
 */
const updatePharmacyStatusSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be VERIFIED or REJECTED' }),
  }),
  rejectionReason: z
    .string()
    .max(500, 'Rejection reason cannot exceed 500 characters')
    .optional(),
});

module.exports = {
  listPharmaciesSchema,
  updatePharmacyStatusSchema,
};
