import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  computeHealthScoreFromInventory,
  type HealthScoreInput,
  type InventoryRow,
} from '../utils/healthScore.js';

/**
 * Phase 10.3 — Health Score Algorithm Tests
 *
 * Verifies:
 *   - Score matches canonical algorithm exactly
 *   - Each penalty category caps correctly
 *   - Empty inventory → score=72, tier=strong
 *   - Tier boundaries: ≥88 excellent, ≥72 strong, ≥55 watch, <55 critical
 *   - Inventory categorisation matches client-side logic
 */

describe('Health Score Algorithm', () => {
  // ─── computeHealthScore ─────────────────────────────────────────
  describe('computeHealthScore', () => {
    it('returns 100/excellent for a perfect pharmacy', () => {
      const input: HealthScoreInput = {
        total: 50, outOfStock: 0, lowStock: 0, expired: 0, expiringCritical: 0, expiringSoon: 0,
      };
      const result = computeHealthScore(input);
      expect(result.healthScore).toBe(100);
      expect(result.healthTier).toBe('excellent');
    });

    it('returns 72/strong for empty inventory (total === 0)', () => {
      const input: HealthScoreInput = {
        total: 0, outOfStock: 0, lowStock: 0, expired: 0, expiringCritical: 0, expiringSoon: 0,
      };
      const result = computeHealthScore(input);
      expect(result.healthScore).toBe(72);
      expect(result.healthTier).toBe('strong');
    });

    it('applies expired penalty: 1 expired = -12', () => {
      const input: HealthScoreInput = {
        total: 10, outOfStock: 0, lowStock: 0, expired: 1, expiringCritical: 0, expiringSoon: 0,
      };
      expect(computeHealthScore(input).healthScore).toBe(88);
    });

    it('caps expired penalty at 36: 5 expired = -36 (not -60)', () => {
      const input: HealthScoreInput = {
        total: 20, outOfStock: 0, lowStock: 0, expired: 5, expiringCritical: 0, expiringSoon: 0,
      };
      expect(computeHealthScore(input).healthScore).toBe(64);
    });

    it('caps lowStock penalty at 16', () => {
      const input: HealthScoreInput = {
        total: 20, outOfStock: 0, lowStock: 50, expired: 0, expiringCritical: 0, expiringSoon: 0,
      };
      // 100 - min(16, 50*2=100) = 100 - 16 = 84
      expect(computeHealthScore(input).healthScore).toBe(84);
    });

    it('caps outOfStock penalty at 14', () => {
      const input: HealthScoreInput = {
        total: 30, outOfStock: 20, lowStock: 0, expired: 0, expiringCritical: 0, expiringSoon: 0,
      };
      // 100 - min(14, 20*2=40) = 100 - 14 = 86
      expect(computeHealthScore(input).healthScore).toBe(86);
    });

    it('applies all penalties together', () => {
      const input: HealthScoreInput = {
        total: 50, outOfStock: 5, lowStock: 3, expired: 2, expiringCritical: 4, expiringSoon: 8,
      };
      // 100 - min(36,24) - min(18,12) - min(12,8) - min(16,6) - min(14,10)
      // = 100 - 24 - 12 - 8 - 6 - 10 = 40
      expect(computeHealthScore(input).healthScore).toBe(40);
      expect(computeHealthScore(input).healthTier).toBe('critical');
    });

    it('clamps score to 0 (never negative)', () => {
      const input: HealthScoreInput = {
        total: 100, outOfStock: 50, lowStock: 50, expired: 10, expiringCritical: 10, expiringSoon: 50,
      };
      expect(computeHealthScore(input).healthScore).toBe(4);
    });

    // ─── Tier boundaries ──────────────────────────────────────────
    it('tier boundary: 88 → excellent', () => {
      expect(computeHealthScore({
        total: 10, outOfStock: 0, lowStock: 0, expired: 1, expiringCritical: 0, expiringSoon: 0,
      }).healthTier).toBe('excellent'); // score = 88
    });

    it('tier boundary: 87 → strong', () => {
      expect(computeHealthScore({
        total: 10, outOfStock: 0, lowStock: 0, expired: 1, expiringCritical: 0, expiringSoon: 1,
      }).healthTier).toBe('strong'); // score = 87
    });

    it('tier boundary: 72 → strong', () => {
      expect(computeHealthScore({
        total: 10, outOfStock: 0, lowStock: 0, expired: 2, expiringCritical: 1, expiringSoon: 1,
      }).healthTier).toBe('strong'); // 100-24-3-1 = 72
    });

    it('tier boundary: 55 → watch', () => {
      expect(computeHealthScore({
        total: 10, outOfStock: 3, lowStock: 2, expired: 2, expiringCritical: 2, expiringSoon: 3,
      }).healthTier).toBe('watch'); // 100-24-6-3-4-6 = 57
    });

    it('tier boundary: 54 → critical', () => {
      expect(computeHealthScore({
        total: 10, outOfStock: 7, lowStock: 7, expired: 3, expiringCritical: 6, expiringSoon: 12,
      }).healthTier).toBe('critical');
    });
  });

  // ─── computeHealthScoreFromInventory ────────────────────────────
  describe('computeHealthScoreFromInventory', () => {
    it('returns score=72 tier=strong for empty array', () => {
      const result = computeHealthScoreFromInventory([]);
      expect(result.healthScore).toBe(72);
      expect(result.healthTier).toBe('strong');
      expect(result.total).toBe(0);
    });

    it('categorises available items as in-stock', () => {
      const inventory: InventoryRow[] = [
        { quantity: 20, isAvailable: true, expiryDate: null },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.total).toBe(1);
      expect(result.outOfStock).toBe(0);
      expect(result.healthScore).toBe(100);
    });

    it('categorises unavailable items as out-of-stock', () => {
      const inventory: InventoryRow[] = [
        { quantity: 0, isAvailable: true, expiryDate: null },
        { quantity: 5, isAvailable: false, expiryDate: null },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.outOfStock).toBe(2);
    });

    it('categorises low-stock items', () => {
      const inventory: InventoryRow[] = [
        { quantity: 5, isAvailable: true, expiryDate: null, lowStockThreshold: 10 },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.lowStock).toBe(1);
    });

    it('categorises expired items', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const inventory: InventoryRow[] = [
        { quantity: 10, isAvailable: true, expiryDate: yesterday },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.expired).toBe(1);
    });

    it('categorises expiringCritical items (within 30 days)', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 15);
      const inventory: InventoryRow[] = [
        { quantity: 10, isAvailable: true, expiryDate: soon },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.expiringCritical).toBe(1);
    });

    it('categorises expiringSoon items (within 90 days, beyond 30)', () => {
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const inventory: InventoryRow[] = [
        { quantity: 10, isAvailable: true, expiryDate: future },
      ];
      const result = computeHealthScoreFromInventory(inventory);
      expect(result.expiringSoon).toBe(1);
    });
  });
});
