import { z } from 'zod';

/** Normalize empty / null expiry to undefined before ISO datetime check */
const preprocessExpiry = (v: unknown): unknown => {
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
};

const preprocessNumber = (val: unknown): unknown => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isNaN(n) ? val : n;
  }
  return val;
};

const preprocessInt = (val: unknown): unknown => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? val : n;
  }
  return val;
};

const addInventorySchema = z.object({
  medicineName: z.string().min(1, 'Medicine name is required').trim(),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.string().optional(),
  price: z.preprocess(
    preprocessNumber,
    z.number({ error: 'Price must be a number' }).positive('Price must be greater than 0')
  ),
  quantity: z.preprocess(
    preprocessInt,
    z
      .number({ error: 'Quantity must be a number' })
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

export type AddInventoryInput = z.infer<typeof addInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export {
  addInventorySchema,
  updateInventorySchema,
};
