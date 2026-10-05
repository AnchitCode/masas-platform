import { z } from 'zod';

/**
 * Phase 10.4 — Pharmacy Analytics Validation Schemas
 */

// GET /pharmacy/analytics/trends?period=7d|30d|90d
export const trendsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('7d'),
});

// GET /pharmacy/analytics/search-visibility?period=7d|30d
export const searchVisibilityQuerySchema = z.object({
  period: z.enum(['7d', '30d']).default('7d'),
});

// GET /pharmacy/analytics/export?format=csv
export const exportQuerySchema = z.object({
  format: z.enum(['csv']).default('csv'),
});

export type TrendsQuery = z.infer<typeof trendsQuerySchema>;
export type SearchVisibilityQuery = z.infer<typeof searchVisibilityQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
