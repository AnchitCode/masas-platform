import { z } from 'zod';

export const createSavedSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query is too long')
    .trim(),
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  radiusKm: z
    .number()
    .positive('Radius must be greater than 0')
    .max(100, 'Radius cannot exceed 100 km')
    .optional()
    .default(5),
  isActive: z.boolean().optional().default(true),
});

export const updateSavedSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query is too long')
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
  radiusKm: z
    .number()
    .positive('Radius must be greater than 0')
    .max(100, 'Radius cannot exceed 100 km')
    .optional(),
  isActive: z.boolean().optional(),
});

export const savedSearchIdSchema = z.object({
  id: z.string().uuid('Invalid saved search ID format'),
});

export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;
