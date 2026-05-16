/**
 * Derives operational KPIs and health signals from inventory rows.
 * Pure functions — no I/O; keeps Dashboard honest when APIs expand.
 */

const LOW_STOCK_THRESHOLD = 10;
const EXPIRING_SOON_DAYS = 90;
const EXPIRING_CRITICAL_DAYS = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - start) / 86400000);
}

/**
 * @param {Array<Record<string, unknown>>} inventory
 * @returns {{
 *   total: number;
 *   inStock: number;
 *   outOfStock: number;
 *   lowStock: number;
 *   expired: number;
 *   expiringCritical: number;
 *   expiringSoon: number;
 *   healthScore: number;
 *   healthTier: 'excellent' | 'strong' | 'watch' | 'critical';
 * }}
 */
export function computeOperationalMetrics(inventory) {
  const rows = Array.isArray(inventory) ? inventory : [];
  let inStock = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let expired = 0;
  let expiringCritical = 0;
  let expiringSoon = 0;

  for (const item of rows) {
    const qty = typeof item.quantity === 'number' ? item.quantity : 0;
    const available = Boolean(item.isAvailable) && qty > 0;
    if (!available) outOfStock += 1;
    else inStock += 1;

    if (available && qty > 0 && qty <= LOW_STOCK_THRESHOLD) lowStock += 1;

    const days = daysUntil(item.expiryDate);
    if (days !== null) {
      if (days < 0) expired += 1;
      else if (days <= EXPIRING_CRITICAL_DAYS) expiringCritical += 1;
      else if (days <= EXPIRING_SOON_DAYS) expiringSoon += 1;
    }
  }

  const total = rows.length;
  let score = 100;
  score -= Math.min(36, expired * 12);
  score -= Math.min(18, expiringCritical * 3);
  score -= Math.min(12, expiringSoon * 1);
  score -= Math.min(16, lowStock * 2);
  score -= Math.min(14, outOfStock * 2);
  if (total === 0) score = Math.min(score, 72);

  const healthScore = Math.max(0, Math.min(100, Math.round(score)));
  const healthTier =
    healthScore >= 88 ? 'excellent' : healthScore >= 72 ? 'strong' : healthScore >= 55 ? 'watch' : 'critical';

  return {
    total,
    inStock,
    outOfStock,
    lowStock,
    expired,
    expiringCritical,
    expiringSoon,
    healthScore,
    healthTier,
  };
}

/**
 * @param {Array<Record<string, unknown>>} inventory
 * @param {{ status?: string }} [pharmacy]
 */
export function buildOperationalTimeline(inventory, pharmacy) {
  const rows = Array.isArray(inventory) ? inventory : [];
  const events = [];

  if (pharmacy?.status) {
    events.push({
      id: 'status',
      tone: pharmacy.status === 'VERIFIED' ? 'success' : pharmacy.status === 'PENDING' ? 'warning' : 'danger',
      title: 'Workspace verification',
      detail:
        pharmacy.status === 'VERIFIED'
          ? 'Your pharmacy is verified and eligible for public discovery.'
          : pharmacy.status === 'PENDING'
            ? 'Verification is in progress — inventory may be read-only until approved.'
            : 'Verification needs attention — review profile requirements.',
    });
  }

  const expiredRows = rows.filter((item) => {
    const days = daysUntil(item.expiryDate);
    return days !== null && days < 0;
  });
  for (const item of expiredRows.slice(0, 3)) {
    const name = item.medicine?.name || 'SKU';
    events.push({
      id: `exp-${item.id}`,
      tone: 'danger',
      title: `Expired lot on record — ${name}`,
      detail: 'Remove or quarantine expired stock to protect patients and audit readiness.',
    });
  }

  const criticalExpiry = rows.filter((item) => {
    const days = daysUntil(item.expiryDate);
    return days !== null && days >= 0 && days <= EXPIRING_CRITICAL_DAYS;
  });
  criticalExpiry.sort((a, b) => (daysUntil(a.expiryDate) ?? 0) - (daysUntil(b.expiryDate) ?? 0));
  for (const item of criticalExpiry.slice(0, 3)) {
    const name = item.medicine?.name || 'SKU';
    const days = daysUntil(item.expiryDate) ?? 0;
    events.push({
      id: `expsoon-${item.id}`,
      tone: 'warning',
      title: `Expiry window — ${name}`,
      detail: `Batch expires in ${days} day${days === 1 ? '' : 's'}. Prioritize dispensing or return workflows.`,
    });
  }

  const low = [...rows].filter((item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : 0;
    return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
  });
  low.sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0));
  for (const item of low.slice(0, 3)) {
    const name = item.medicine?.name || 'SKU';
    const qty = typeof item.quantity === 'number' ? item.quantity : 0;
    events.push({
      id: `low-${item.id}`,
      tone: 'warning',
      title: `Reorder signal — ${name}`,
      detail: `On-hand quantity is ${qty}. Consider replenishment to avoid stock-outs.`,
    });
  }

  if (rows.length === 0 && pharmacy?.status === 'VERIFIED') {
    events.push({
      id: 'empty-catalog',
      tone: 'neutral',
      title: 'Catalog baseline',
      detail: 'No inventory rows yet. Add medicines to activate forecasting and expiry intelligence.',
    });
  }

  return events.slice(0, 8);
}

/**
 * @param {ReturnType<typeof computeOperationalMetrics>} metrics
 */
export function buildAiInsights(metrics) {
  const insights = [];
  if (metrics.expired > 0) {
    insights.push({
      id: 'expired',
      title: 'Expired inventory detected',
      confidence: 0.94,
      body: `${metrics.expired} SKU${metrics.expired === 1 ? '' : 's'} ${metrics.expired === 1 ? 'is' : 'are'} past expiry. Clearing them improves compliance and search quality.`,
      action: 'Review expiry queue',
      href: '/dashboard/inventory',
    });
  }
  if (metrics.expiringCritical > 0 && insights.length < 3) {
    insights.push({
      id: 'critical-expiry',
      title: 'Short-dated stock concentration',
      confidence: 0.88,
      body: `${metrics.expiringCritical} item${metrics.expiringCritical === 1 ? '' : 's'} expire within ${EXPIRING_CRITICAL_DAYS} days. Consider targeted promotions or transfers.`,
      action: 'Open inventory',
      href: '/dashboard/inventory',
    });
  }
  if (metrics.lowStock > 0 && insights.length < 3) {
    insights.push({
      id: 'low-stock',
      title: 'Reorder candidates identified',
      confidence: 0.82,
      body: `${metrics.lowStock} SKU${metrics.lowStock === 1 ? '' : 's'} are at or below the operational floor (${LOW_STOCK_THRESHOLD} units).`,
      action: 'Triage low stock',
      href: '/dashboard/inventory',
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: 'stable',
      title: 'Operational posture is stable',
      confidence: 0.76,
      body:
        metrics.total === 0
          ? 'Add catalog data to unlock demand forecasting, anomaly context, and supplier reliability scoring.'
          : 'No urgent expiry or stock-floor breaches detected. MASAS will surface anomalies as patterns emerge.',
      action: metrics.total === 0 ? 'Build catalog' : 'View inventory',
      href: '/dashboard/inventory',
    });
  }
  return insights.slice(0, 3);
}
