/**
 * Canonical Health Score Algorithm (Phase 10.3).
 *
 * SOURCE OF TRUTH for both server-side aggregation and client-side display.
 * The client implementation in `client/src/lib/dashboardMetrics.ts` must
 * produce identical results for the same input.
 *
 * Algorithm:
 *   Base score = 100
 *   - min(36, expired × 12)
 *   - min(18, expiringCritical × 3)
 *   - min(12, expiringSoon × 1)
 *   - min(16, lowStock × 2)
 *   - min(14, outOfStock × 2)
 *   If total === 0: score = min(score, 72)
 *   Clamped to [0, 100], rounded.
 *
 * Tiers:
 *   ≥ 88 → excellent
 *   ≥ 72 → strong
 *   ≥ 55 → watch
 *   < 55 → critical
 */

// ─── Thresholds ─────────────────────────────────────────────────

const LOW_STOCK_THRESHOLD = 10;
const EXPIRING_SOON_DAYS = 90;
const EXPIRING_CRITICAL_DAYS = 30;

// ─── Types ──────────────────────────────────────────────────────

export type HealthTier = 'excellent' | 'strong' | 'watch' | 'critical';

export interface HealthScoreInput {
  total: number;
  outOfStock: number;
  lowStock: number;
  expired: number;
  expiringCritical: number;
  expiringSoon: number;
}

export interface HealthScoreResult {
  healthScore: number;
  healthTier: HealthTier;
}

// ─── Inventory item interface ───────────────────────────────────

export interface InventoryRow {
  quantity: number;
  isAvailable: boolean;
  expiryDate: Date | null;
  lowStockThreshold?: number;
}

// ─── Core computation ───────────────────────────────────────────

/**
 * Compute health score from pre-counted categories.
 *
 * Pure function — no I/O, no side effects, deterministic.
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  let score = 100;
  score -= Math.min(36, input.expired * 12);
  score -= Math.min(18, input.expiringCritical * 3);
  score -= Math.min(12, input.expiringSoon * 1);
  score -= Math.min(16, input.lowStock * 2);
  score -= Math.min(14, input.outOfStock * 2);

  if (input.total === 0) {
    score = Math.min(score, 72);
  }

  const healthScore = Math.max(0, Math.min(100, Math.round(score)));
  const healthTier: HealthTier =
    healthScore >= 88 ? 'excellent'
      : healthScore >= 72 ? 'strong'
        : healthScore >= 55 ? 'watch'
          : 'critical';

  return { healthScore, healthTier };
}

// ─── Inventory categorisation helper ────────────────────────────

function daysUntil(date: Date): number {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

/**
 * Categorise an inventory array and compute the health score.
 *
 * This is the server-side equivalent of `computeOperationalMetrics()`
 * in `client/src/lib/dashboardMetrics.ts`.
 */
export function computeHealthScoreFromInventory(inventory: InventoryRow[]): HealthScoreInput & HealthScoreResult {
  let outOfStock = 0;
  let lowStock = 0;
  let expired = 0;
  let expiringCritical = 0;
  let expiringSoon = 0;

  for (const item of inventory) {
    const qty = typeof item.quantity === 'number' ? item.quantity : 0;
    const available = item.isAvailable && qty > 0;

    if (!available) outOfStock += 1;

    if (available && qty > 0 && qty <= (item.lowStockThreshold ?? LOW_STOCK_THRESHOLD)) {
      lowStock += 1;
    }

    if (item.expiryDate) {
      const days = daysUntil(item.expiryDate);
      if (days < 0) expired += 1;
      else if (days <= EXPIRING_CRITICAL_DAYS) expiringCritical += 1;
      else if (days <= EXPIRING_SOON_DAYS) expiringSoon += 1;
    }
  }

  const total = inventory.length;
  const counts: HealthScoreInput = { total, outOfStock, lowStock, expired, expiringCritical, expiringSoon };
  const score = computeHealthScore(counts);

  return { ...counts, ...score };
}

export { LOW_STOCK_THRESHOLD, EXPIRING_SOON_DAYS, EXPIRING_CRITICAL_DAYS };
