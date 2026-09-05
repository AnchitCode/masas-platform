import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import type { SearchInventoryQuery } from './search.validation.js';
import { findSemanticCandidates, hasPharmaceuticalIntent } from '../../ai/search/semanticSearch.js';
import type { SemanticCandidate } from '../../ai/search/semanticSearch.js';
import logger from '../../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────

interface SearchRow {
  inventory_id: string;
  inventory_price: number;
  inventory_quantity: number;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_phone: string;
  pharmacy_latitude: number;
  pharmacy_longitude: number;
  medicine_id: string;
  medicine_name: string;
  medicine_generic_name: string | null;
  medicine_manufacturer: string | null;
  medicine_category: string | null;
  medicine_dosage_form: string | null;
  distance_meters: number;
  match_type: 'exact' | 'partial' | 'generic' | 'semantic';
  relevance_score: number;
  full_count: bigint | null;
}

/** Explicit search target communicated in response metadata */
export interface SearchTarget {
  id: string;
  name: string;
  isAvailable: boolean;
}

// ─── Configuration ──────────────────────────────────────────────

/**
 * Maximum Levenshtein edit distance to consider a query as a typo of
 * a catalog medicine name. ED ≤ 3 covers most single/double-character
 * typos ("aspririn" → aspirin, "Paractemol" → paracetamol).
 */
const MAX_EDIT_DISTANCE = 3;

/**
 * Minimum semantic score to resolve a query as a SYNONYM (not typo)
 * of a catalog medicine. Only reached when the query is NOT within
 * MAX_EDIT_DISTANCE of any catalog name.
 *
 * Derived from evaluation matrix (17-medicine catalog):
 *   Lowest legitimate synonym: "acetaminophen" → paracetamol at 0.6616
 *   Highest nonsense (no pharma intent): "zzzzqqqq9999medicineabc" at 0.6329
 *   Gap: 0.0287. Threshold 0.65 sits safely inside this gap.
 */
const SYNONYM_THRESHOLD = 0.65;

/**
 * Minimum ratio of a candidate's score to the top candidate's score
 * for NL/concept queries when no category match is found (fallback).
 * Candidates below this ratio are considered weakly related and excluded.
 */
const RELEVANCE_RATIO = 0.90;

// ─── Condition → Category Map ───────────────────────────────────

/**
 * Maps condition/symptom keywords found in NL queries to their
 * therapeutic category. Used to filter semantic candidates to only
 * the relevant medicine category.
 *
 * Entries are sorted longest-first at lookup time so that multi-word
 * phrases ("acid reflux") match before single words ("acid").
 *
 * When a query contains no matching keyword, filtering falls back
 * to the RELEVANCE_RATIO score filter.
 */
const CONDITION_CATEGORY_MAP: ReadonlyArray<readonly [string, string]> = [
  // Pain / Fever → Analgesic
  ['body ache',  'Analgesic'],
  ['painkiller', 'Analgesic'],
  ['pain',       'Analgesic'],
  ['headache',   'Analgesic'],
  ['fever',      'Analgesic'],

  // Allergy → Antihistamine
  ['allergic',   'Antihistamine'],
  ['allergy',    'Antihistamine'],
  ['itching',    'Antihistamine'],
  ['sneezing',   'Antihistamine'],

  // Infection → Antibiotic
  ['antibiotic', 'Antibiotic'],
  ['infection',  'Antibiotic'],

  // Acid / Stomach → Antacid
  ['acid reflux','Antacid'],
  ['heartburn',  'Antacid'],
  ['acidity',    'Antacid'],
  ['gastric',    'Antacid'],
  ['stomach',    'Antacid'],

  // Supplement
  ['supplement', 'Supplement'],
  ['vitamin',    'Supplement'],

  // Rehydration
  ['dehydration','Rehydration'],
  ['diarrhea',   'Rehydration'],
  ['electrolyte','Rehydration'],
];

// Pre-sort by phrase length descending for greedy matching
const SORTED_CONDITION_MAP = [...CONDITION_CATEGORY_MAP].sort(
  (a, b) => b[0].length - a[0].length,
);

// ─── Catalog Pre-check ──────────────────────────────────────────

/**
 * Check if the raw query directly matches a medicine_catalog entry by
 * name or generic_name. This distinguishes explicit medicine-target
 * queries ("Aspirin", "Vitamin D") from natural-language / concept
 * queries ("dard ki dawa", "headache medicine", "fever medicine").
 *
 * Returns the first matching catalog entry, or null.
 */
async function findCatalogTarget(query: string): Promise<{ id: string; name: string } | null> {
  const result = await prisma.medicineCatalog.findFirst({
    where: {
      OR: [
        { name: { equals: query, mode: 'insensitive' } },
        { genericName: { equals: query, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  return result;
}

// ─── Levenshtein Edit Distance ──────────────────────────────────

/**
 * Standard Levenshtein edit distance (insertion, deletion, substitution).
 * Used to detect typos like "Paractemol" → "paracetamol" (ED = 1).
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,      // deletion
        dp[i]![j - 1]! + 1,      // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  return dp[m]![n]!;
}

/**
 * Find the closest catalog medicine name by edit distance.
 * Returns the match if ED ≤ maxED, otherwise null.
 * If tied, picks alphabetically first (deterministic).
 */
async function findClosestByEditDistance(
  query: string,
  maxED: number,
): Promise<{ id: string; name: string; editDistance: number } | null> {
  const catalog = await prisma.medicineCatalog.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const queryLower = query.toLowerCase().trim();
  let best: { id: string; name: string; editDistance: number } | null = null;

  for (const medicine of catalog) {
    const ed = levenshtein(queryLower, medicine.name);
    if (ed <= maxED && (best === null || ed < best.editDistance)) {
      best = { id: medicine.id, name: medicine.name, editDistance: ed };
    }
  }

  return best;
}

// ─── NL Category Detection ─────────────────────────────────────

/**
 * Detect the target therapeutic category from an NL query by scanning
 * for condition/symptom keywords.
 *
 * Uses the pre-sorted CONDITION_CATEGORY_MAP (longest phrases first)
 * for greedy matching. Returns null if no keyword matches.
 *
 * Works with both English NL queries and normalized Hinglish:
 *   "pain medicine"     → "Analgesic"
 *   "fever medicine"    → "Analgesic"   (normalized from "bukhar ki dawa")
 *   "allergy medicine"  → "Antihistamine"
 *   "acidity medicine"  → "Antacid"
 *   "cold medicine"     → null (ambiguous, falls back to ratio filter)
 */
function detectQueryCategory(normalizedQuery: string): string | null {
  const q = normalizedQuery.toLowerCase();
  for (const [phrase, category] of SORTED_CONDITION_MAP) {
    if (q.includes(phrase)) {
      return category;
    }
  }
  return null;
}

// ─── Typo/Synonym Resolution ────────────────────────────────────

/**
 * Attempt to resolve a query as a typo or synonym of a catalog medicine.
 *
 * Two-stage resolution:
 *   1. Edit distance: if query is within MAX_EDIT_DISTANCE of a catalog
 *      medicine name, resolve directly to that medicine. This is more
 *      reliable than embedding scores for typos and avoids issues like
 *      "Paractemol" → crocin (which scores higher by embedding but is
 *      not the intended medicine).
 *   2. Synonym: if no close edit distance match, check if the top
 *      semantic candidate scores ≥ SYNONYM_THRESHOLD (0.65). This
 *      handles legitimate synonyms like "acetaminophen" → paracetamol.
 *
 * Skipped entirely if the query has pharmaceutical intent (NL/concept).
 *
 * Examples:
 *   "Paractemol"    → ED 1 → paracetamol (not crocin!)
 *   "aspririn"      → ED 1 → aspirin
 *   "cetrizine"     → ED 1 → cetirizine
 *   "acetaminophen" → ED > 3, score 0.66 ≥ 0.65 → paracetamol (synonym)
 *   "zzzzqqqq..."   → ED > 3, score 0.63 < 0.65 → null (rejected)
 *   "pain medicine" → skipped (has pharma intent)
 */
async function resolveTypoTarget(
  rawQuery: string,
  normalizedQuery: string,
  candidates: SemanticCandidate[],
): Promise<{ id: string; name: string } | null> {
  if (candidates.length === 0) return null;

  // Skip if query has pharmaceutical/medical intent (NL/concept query)
  if (hasPharmaceuticalIntent(rawQuery, normalizedQuery)) return null;

  // Stage 1: Edit distance — most reliable for typos
  const edMatch = await findClosestByEditDistance(rawQuery, MAX_EDIT_DISTANCE);
  if (edMatch) {
    logger.debug('Typo resolved via edit distance', {
      query: rawQuery,
      resolved: edMatch.name,
      editDistance: edMatch.editDistance,
    });
    return { id: edMatch.id, name: edMatch.name };
  }

  // Stage 2: Synonym — higher threshold for non-typo drug name synonyms
  const top = candidates[0]!;
  if (top.score >= SYNONYM_THRESHOLD) {
    logger.debug('Query resolved as synonym', {
      query: rawQuery,
      resolved: top.name,
      score: top.score,
    });
    return { id: top.id, name: top.name };
  }

  return null;
}

// ─── Candidate Filtering ────────────────────────────────────────

/**
 * Filter semantic candidates before injecting into the SQL query.
 *
 * For exact/typo targets:
 *   Same as before — remove exact target (keyword ILIKE covers it),
 *   keep typo target (needs semantic join), keep rest for OOS alternatives.
 *
 * For NL/concept queries (target = null, has pharma intent):
 *   1. Try category detection from query keywords.
 *      If category found → keep only candidates from that category.
 *   2. Fallback: apply RELEVANCE_RATIO score filter.
 *
 * For non-pharma, non-target queries (unrecognized):
 *   Return empty — the query is not a medicine, not a typo, not a
 *   synonym, and has no medical language. No results.
 */
function filterCandidatesForQuery(
  candidates: SemanticCandidate[],
  target: { id: string; name: string } | null,
  isResolvedFromTypo: boolean,
  hasPharmaIntent: boolean,
  normalizedQuery: string,
): SemanticCandidate[] {
  if (candidates.length === 0) return [];

  // ── Target resolved (exact or typo/synonym) ──
  if (target) {
    if (isResolvedFromTypo) {
      // Typo/synonym target: keep ALL candidates (target needs semantic join to appear)
      return candidates;
    }
    // Exact catalog target: remove target itself (it appears via keyword match)
    return candidates.filter((c) => c.id !== target.id);
  }

  // ── No target resolved ──

  // Non-pharma queries that didn't resolve as typo/synonym → unrecognized
  if (!hasPharmaIntent) {
    return [];
  }

  // NL/concept query: try category-aware filtering first
  const targetCategory = detectQueryCategory(normalizedQuery);

  if (targetCategory) {
    const categoryFiltered = candidates.filter((c) => c.category === targetCategory);
    if (categoryFiltered.length > 0) {
      logger.debug('NL query: category filter applied', {
        normalizedQuery,
        targetCategory,
        before: candidates.length,
        after: categoryFiltered.length,
      });
      return categoryFiltered;
    }
    // Category detected but no candidates match — fall through to ratio filter
    // (this can happen if no catalog medicines have that category yet)
    logger.debug('NL query: category filter matched no candidates, falling back to ratio', {
      normalizedQuery,
      targetCategory,
    });
  }

  // Fallback: relative score ratio filter
  const topScore = candidates[0]!.score;
  const threshold = topScore * RELEVANCE_RATIO;
  return candidates.filter((c) => c.score >= threshold);
}

// ─── Main Search ────────────────────────────────────────────────

/**
 * Public medicine + inventory search near a point (Phase 9.1e Hybrid Search).
 * Uses PostGIS on pharmacy lat/lon (float columns) cast to geography.
 * Ranks by relevance tier first, then distance.
 *
 * Phase 9.2 follow-up: Adds explicit catalog pre-check and target metadata
 * so the frontend can distinguish "medicine is out of stock" from
 * "no results found" and render semantic matches separately.
 */
const searchPublicInventory = async ({ q, lat, lng, radiusKm, page, limit }: SearchInventoryQuery) => {
  const radiusMeters = radiusKm * 1000;
  const offset = (page - 1) * limit;
  const pattern = `%${q}%`;
  const exact = q;

  // 1. Catalog pre-check: Does the query match an explicit medicine name?
  //    Natural-language queries (e.g. "dard ki dawa") won't match here.
  const catalogTarget = await findCatalogTarget(q);

  // 2. Fetch semantic candidates (Phase 9.1d)
  const { candidates: rawCandidates, aiUsed, normalizedQuery } = await findSemanticCandidates(q, 20);

  // 3. Typo/synonym resolution: if no exact catalog match, attempt to
  //    resolve the query as a typo or synonym of a catalog medicine.
  //    Now uses edit distance first (more reliable for typos), then
  //    elevated synonym threshold (0.65) for drug name synonyms.
  const resolvedTarget = catalogTarget ? null : await resolveTypoTarget(q, normalizedQuery, rawCandidates);
  const target = catalogTarget ?? resolvedTarget;
  const isResolvedFromTypo = resolvedTarget !== null;

  // 4. Determine pharmaceutical intent for candidate filtering
  const hasPharmaIntent = hasPharmaceuticalIntent(q, normalizedQuery);

  // 5. Filter candidates for SQL injection
  const candidates = filterCandidatesForQuery(
    rawCandidates, target, isResolvedFromTypo, hasPharmaIntent, normalizedQuery,
  );

  logger.debug('Search target resolution', {
    query: q.substring(0, 50),
    exactTarget: catalogTarget?.name ?? null,
    resolvedTarget: resolvedTarget?.name ?? null,
    isResolvedFromTypo,
    hasPharmaIntent,
    rawCandidateCount: rawCandidates.length,
    filteredCandidateCount: candidates.length,
  });

  // 3. Build parameterized semantic join clause safely
  let semanticJoin = Prisma.empty;
  let semanticMatchCase = Prisma.empty;
  let semanticScoreExpr = Prisma.sql`0`;
  let matchCondition = Prisma.sql`(mc.name ILIKE ${pattern} OR mc.generic_name ILIKE ${pattern})`;

  if (candidates.length > 0) {
    const valueTuples = candidates.map(
      (c) => Prisma.sql`(${c.id}::text, ${c.score}::float)`
    );
    semanticJoin = Prisma.sql`LEFT JOIN (VALUES ${Prisma.join(valueTuples)}) AS sem(id, score) ON mc.id = sem.id`;
    matchCondition = Prisma.sql`(${matchCondition} OR sem.id IS NOT NULL)`;
    semanticScoreExpr = Prisma.sql`COALESCE(sem.score * 60, 0)`;
    semanticMatchCase = Prisma.sql`WHEN sem.id IS NOT NULL THEN 'semantic'`;
  }

  // 4. Execute hybrid query with explicit match_type classification in SQL
  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      pi.id AS inventory_id,
      pi.price AS inventory_price,
      pi.quantity AS inventory_quantity,
      p.id AS pharmacy_id,
      p.name AS pharmacy_name,
      p.address AS pharmacy_address,
      p.phone AS pharmacy_phone,
      p.latitude AS pharmacy_latitude,
      p.longitude AS pharmacy_longitude,
      mc.id AS medicine_id,
      mc.name AS medicine_name,
      mc.generic_name AS medicine_generic_name,
      mc.manufacturer AS medicine_manufacturer,
      mc.category AS medicine_category,
      mc.dosage_form AS medicine_dosage_form,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) AS distance_meters,
      CASE
        WHEN mc.name ILIKE ${exact} THEN 'exact'
        WHEN mc.name ILIKE ${pattern} THEN 'partial'
        WHEN mc.generic_name ILIKE ${pattern} THEN 'generic'
        ${semanticMatchCase}
        ELSE 'semantic'
      END AS match_type,
      GREATEST(
        CASE WHEN mc.name ILIKE ${exact} THEN 100 ELSE 0 END,
        CASE WHEN mc.name ILIKE ${pattern} THEN 80 ELSE 0 END,
        CASE WHEN mc.generic_name ILIKE ${pattern} THEN 70 ELSE 0 END,
        ${semanticScoreExpr}
      ) AS relevance_score,
      COUNT(*) OVER() AS full_count
    FROM pharmacy_inventory pi
    INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
    INNER JOIN medicine_catalog mc ON mc.id = pi.medicine_id
    ${semanticJoin}
    WHERE p.status = 'VERIFIED'
      AND pi.is_available = true
      AND pi.quantity > 0
      AND ${matchCondition}
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
    ORDER BY relevance_score DESC, distance_meters ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const total = rows.length > 0 && rows[0].full_count != null ? Number(rows[0].full_count) : 0;

  // 6. Map rows — match_type now comes directly from SQL
  let results = rows.map((row) => ({
    distanceMeters: Number(row.distance_meters),
    matchType: row.match_type as 'exact' | 'partial' | 'generic' | 'semantic',
    pharmacy: {
      id: row.pharmacy_id,
      name: row.pharmacy_name,
      address: row.pharmacy_address,
      phone: row.pharmacy_phone,
      latitude: row.pharmacy_latitude,
      longitude: row.pharmacy_longitude,
    },
    medicine: {
      id: row.medicine_id,
      name: row.medicine_name,
      genericName: row.medicine_generic_name,
      manufacturer: row.medicine_manufacturer,
      category: row.medicine_category,
      dosageForm: row.medicine_dosage_form,
    },
    inventory: {
      id: row.inventory_id,
      price: row.inventory_price,
      quantity: row.inventory_quantity,
    },
  }));

  // 7. Post-SQL: Target-aware result filtering
  let targetMeta: SearchTarget | undefined;

  if (target) {
    const targetInResults = results.some(
      (r) => r.medicine.id === target.id
    );

    if (targetInResults) {
      // Target is AVAILABLE — suppress ALL semantic results
      // For resolved typos: the target appears as 'semantic' in SQL,
      // re-tag it as 'exact' so the frontend renders it as primary.
      if (isResolvedFromTypo) {
        results = results.map((r) =>
          r.medicine.id === target.id
            ? { ...r, matchType: 'exact' as const }
            : r
        );
      }
      results = results.filter(
        (r) => r.matchType !== 'semantic'
      );
    } else {
      // Target is OOS — filter semantic results by category match
      const targetCat = await prisma.medicineCatalog.findUnique({
        where: { id: target.id },
        select: { category: true },
      });

      if (targetCat?.category) {
        results = results.filter(
          (r) => r.matchType !== 'semantic' || r.medicine.category === targetCat.category
        );
      }
      // If no category data, keep semantic results as-is (graceful fallback)
    }

    targetMeta = {
      id: target.id,
      name: target.name,
      isAvailable: targetInResults,
    };

    logger.debug('Search target filtering applied', {
      query: q,
      targetName: target.name,
      isAvailable: targetInResults,
      isResolvedFromTypo,
      finalResultCount: results.length,
    });
  }

  return {
    results,
    total,
    page,
    limit,
    meta: {
      aiUsed,
      normalizedQuery: aiUsed && normalizedQuery !== q.toLowerCase().trim() ? normalizedQuery : undefined,
      target: targetMeta,
    },
  };
};

export {
  searchPublicInventory,
};
