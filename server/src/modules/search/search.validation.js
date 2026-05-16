const { z } = require('zod');

const preprocessFloat = (val) => {
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
 * Query params for public inventory search (Express always provides strings).
 */
const searchInventoryQuerySchema = z.object({
  q: z
    .string({ required_error: 'Search query is required' })
    .min(1, 'Search query cannot be empty')
    .max(200, 'Search query is too long')
    .trim(),
  lat: z.preprocess(
    preprocessFloat,
    z.number({ invalid_type_error: 'Latitude must be a number' }).min(-90).max(90)
  ),
  lng: z.preprocess(
    preprocessFloat,
    z.number({ invalid_type_error: 'Longitude must be a number' }).min(-180).max(180)
  ),
  radiusKm: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : preprocessFloat(val)),
    z
      .number({ invalid_type_error: 'Radius must be a number' })
      .positive('Radius must be greater than 0')
      .max(100, 'Radius cannot exceed 100 km')
      .optional()
      .default(10)
  ),
  page: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : preprocessInt(val)),
    z.number({ invalid_type_error: 'Page must be a number' }).int().min(1).optional().default(1)
  ),
  limit: z.preprocess(
    (val) => (val === undefined || val === '' ? undefined : preprocessInt(val)),
    z
      .number({ invalid_type_error: 'Limit must be a number' })
      .int()
      .min(1)
      .max(50, 'Limit cannot exceed 50')
      .optional()
      .default(20)
  ),
});

module.exports = {
  searchInventoryQuerySchema,
};
