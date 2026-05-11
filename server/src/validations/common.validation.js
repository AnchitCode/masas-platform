const { z } = require('zod');

/**
 * Shared validation schemas — reusable fragments used across modules.
 */

// UUID parameter validation (for route params like /:id)
const uuidParam = z.object({
  id: z.string().uuid({ message: 'Invalid ID format' }),
});

// Pagination query params
const pagination = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform(Number)
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().min(1).max(50)),
});

// Coordinate query params (for location-based search)
const coordinates = z.object({
  lat: z
    .string()
    .transform(Number)
    .pipe(z.number().min(-90).max(90)),
  lng: z
    .string()
    .transform(Number)
    .pipe(z.number().min(-180).max(180)),
  radius: z
    .string()
    .optional()
    .default('5000')
    .transform(Number)
    .pipe(z.number().min(100).max(50000)), // 100m to 50km in meters
});

module.exports = {
  uuidParam,
  pagination,
  coordinates,
};
