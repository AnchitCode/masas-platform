const { z } = require('zod');

/** Normalize empty / null expiry to undefined before ISO datetime check */
const preprocessExpiry = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
};

const preprocessNumber = (val) => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }
  return val;
};

const preprocessInt = (val) => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? val : n;
  }
  return val;
};

/**
 * Body-only schemas (must match validate(schema, 'body') — same pattern as auth/pharmacy).
 */
const addInventorySchema = z.object({
  medicineName: z.string().min(1, 'Medicine name is required').trim(),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.string().optional(),
  price: z.preprocess(
    preprocessNumber,
    z.number({ invalid_type_error: 'Price must be a number' }).positive('Price must be greater than 0')
  ),
  quantity: z.preprocess(
    preprocessInt,
    z
      .number({ invalid_type_error: 'Quantity must be a number' })
      .int('Quantity must be a whole number')
      .nonnegative('Quantity must be 0 or more')
  ),
  expiryDate: z.preprocess(preprocessExpiry, z.string().datetime().optional()),
  isAvailable: z.boolean().optional().default(true),
});

const updateInventorySchema = z
  .object({
    price: z.preprocess(
      (val) => (val === '' || val === null ? undefined : preprocessNumber(val)),
      z.number().positive('Price must be greater than 0').optional()
    ),
    quantity: z.preprocess(
      (val) => (val === '' || val === null ? undefined : preprocessInt(val)),
      z.number().int().nonnegative('Quantity must be 0 or more').optional()
    ),
    expiryDate: z.preprocess(preprocessExpiry, z.string().datetime().optional()),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field is required to update',
  });

module.exports = {
  addInventorySchema,
  updateInventorySchema,
};
