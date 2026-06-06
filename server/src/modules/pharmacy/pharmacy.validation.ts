import { z } from 'zod';

/**
 * Pharmacy module Zod validation schemas.
 */

const createPharmacySchema = z.object({
  name: z
    .string({ error: 'Pharmacy name is required' })
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be at most 200 characters')
    .trim(),
  licenseNumber: z
    .string({ error: 'License number is required' })
    .min(3, 'License number must be at least 3 characters')
    .max(50, 'License number must be at most 50 characters')
    .trim(),
  address: z
    .string({ error: 'Address is required' })
    .min(5, 'Address must be at least 5 characters')
    .max(500, 'Address must be at most 500 characters')
    .trim(),
  phone: z
    .string({ error: 'Phone number is required' })
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number must be at most 20 characters')
    .trim(),
  latitude: z
    .number({ error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

const updatePharmacySchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name must be at most 200 characters')
    .trim()
    .optional(),
  address: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(500, 'Address must be at most 500 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .min(7, 'Phone number must be at least 7 characters')
    .max(20, 'Phone number must be at most 20 characters')
    .trim()
    .optional(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
});

export type CreatePharmacyInput = z.infer<typeof createPharmacySchema>;
export type UpdatePharmacyInput = z.infer<typeof updatePharmacySchema>;

export {
  createPharmacySchema,
  updatePharmacySchema,
};
