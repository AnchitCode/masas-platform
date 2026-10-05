import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────

interface SearchImpressionInput {
  pharmacyId: string;
  medicineId: string;
  matchType: string;
  position: number;
}

interface SearchAnalyticsInput {
  query: string;
  normalizedQuery: string | null;
  latitude: number;
  longitude: number;
  radiusKm: number;
  resultCount: number;
  aiUsed: boolean;
  targetMedicineId: string | null;
  targetFound: boolean | null;
  responseTimeMs: number;
  impressions: SearchImpressionInput[];
}

// ─── Coordinate rounding ────────────────────────────────────────

/**
 * Round to 2 decimal places ≈ 1.1 km precision.
 * Substantially reduces location sensitivity without eliminating
 * geographic usefulness for aggregate analytics.
 */
function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─── Main logger ────────────────────────────────────────────────

/**
 * Log a search query and its resulting pharmacy impressions.
 *
 * Fire-and-forget: this function NEVER throws. A failed write
 * is logged but does not affect the search response.
 *
 * Creates:
 *   1. One `search_queries` row per search
 *   2. N `search_impressions` rows (one per result, via createMany)
 *
 * Called from searchPublicInventory() with `void logSearchAnalytics(...).catch(() => {})`
 */
export async function logSearchAnalytics(data: SearchAnalyticsInput): Promise<void> {
  try {
    const searchQuery = await prisma.searchQuery.create({
      data: {
        query: data.query,
        normalizedQuery: data.normalizedQuery,
        latitude: data.latitude,        // already rounded by caller
        longitude: data.longitude,      // already rounded by caller
        radiusKm: data.radiusKm,
        resultCount: data.resultCount,
        aiUsed: data.aiUsed,
        targetMedicineId: data.targetMedicineId,
        targetFound: data.targetFound,
        responseTimeMs: data.responseTimeMs,
      },
    });

    if (data.impressions.length > 0) {
      await prisma.searchImpression.createMany({
        data: data.impressions.map((imp) => ({
          searchQueryId: searchQuery.id,
          pharmacyId: imp.pharmacyId,
          medicineId: imp.medicineId,
          matchType: imp.matchType,
          position: imp.position,
        })),
      });
    }
  } catch (error) {
    logger.error('search-analytics: log failed', { error: String(error) });
    // Fire-and-forget: search response is NEVER delayed by analytics
  }
}

export { roundCoord, type SearchAnalyticsInput };
