import { z } from 'zod';

/**
 * Phase 10.5 — Admin Analytics Validation Schemas
 */

// GET /admin/analytics/search-trends?period=7d|30d
export const searchTrendsQuerySchema = z.object({
  period: z.enum(['7d', '30d']).default('7d'),
});

// GET /admin/analytics/top-searches?period=7d|30d&limit=20
export const topSearchesQuerySchema = z.object({
  period: z.enum(['7d', '30d']).default('7d'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /admin/analytics/demand-gaps?period=30d&limit=20
export const demandGapsQuerySchema = z.object({
  period: z.enum(['7d', '30d']).default('30d'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /admin/analytics/pharmacy-leaderboard?limit=20
export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchTrendsQuery = z.infer<typeof searchTrendsQuerySchema>;
export type TopSearchesQuery = z.infer<typeof topSearchesQuerySchema>;
export type DemandGapsQuery = z.infer<typeof demandGapsQuerySchema>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
