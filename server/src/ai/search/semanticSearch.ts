/**
 * Semantic Candidate Search (Phase 9.1d)
 *
 * Retrieves medicine candidates from the catalog using pgvector
 * cosine similarity search. This is a CANDIDATE retrieval function —
 * it does NOT determine availability, pricing, or geographic proximity.
 *
 * Pipeline:
 *   user query → normalizeQuery() → embed() → pgvector cosine search
 *             → confidence filter → candidates
 *
 * Confidence Filter (Phase 9.2 quality fix):
 *   Raw cosine similarity always returns the closest vectors, even for
 *   meaningless queries. The confidence filter uses three independent
 *   signals to decide whether results are meaningful:
 *
 *     Signal 1: Hinglish normalization changed the query
 *     Signal 2: Query contains known pharmaceutical/medical terms
 *     Signal 3: Top similarity score ≥ SEMANTIC_CONFIDENCE_THRESHOLD
 *
 *   If NONE fire, all candidates are discarded.
 *
 * IMPORTANT:
 *   Semantic similarity is NOT pharmaceutical truth.
 *   These candidates are a relevance signal only. Existing MASAS business
 *   rules, catalog data, and pharmacy inventory remain authoritative.
 *
 * Failure behavior:
 *   Returns empty candidates array on any error. The caller (future hybrid
 *   search) falls back to keyword-only search transparently.
 */

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { aiConfig } from '../config.js';
import { getEmbeddingProvider } from '../providers/index.js';
import { normalizeQuery } from './queryNormalizer.js';

// ─── Types ───────────────────────────────────────────────────────

export interface SemanticCandidate {
  /** Medicine catalog ID */
  id: string;
  /** Medicine name (lowercase) */
  name: string;
  /** Generic name if available */
  genericName: string | null;
  /** Category if available */
  category: string | null;
  /** Dosage form if available */
  dosageForm: string | null;
  /** Cosine similarity score (0–1, higher = more similar) */
  score: number;
}

export interface SemanticSearchResult {
  /** The query after Hinglish normalization */
  normalizedQuery: string;
  /** Candidate medicines ordered by similarity (descending) */
  candidates: SemanticCandidate[];
  /** Time taken for the entire semantic search pipeline (ms) */
  latencyMs: number;
  /** Whether AI was used (false if disabled/unavailable/error) */
  aiUsed: boolean;
  /** Error message if something went wrong (for debugging) */
  error?: string;
}

// ─── Configuration ───────────────────────────────────────────────

/** Minimum cosine similarity threshold — candidates below this are filtered out at the database level */
const SIMILARITY_THRESHOLD = 0.40;

/** Maximum number of semantic candidates to return */
const MAX_CANDIDATES = 10;

/**
 * Minimum embedding score to accept results without any lexical signal.
 *
 * When a query has no recognizable pharmaceutical terms and wasn't
 * normalized from Hinglish, the top candidate must score at least this
 * high to be considered a meaningful match (e.g., typos of drug names,
 * generic drug names).
 *
 * Derived from evaluation matrix (with category-enriched embeddings):
 *   Closest legitimate query relying on this: "aspririn" at 0.5780
 *   Closest nonsense query:                   "zzzzqqqq9999medicineabc" at 0.5524
 *   Gap: 0.0256
 */
const SEMANTIC_CONFIDENCE_THRESHOLD = 0.57;

// ─── Pharmaceutical Intent Detection ─────────────────────────────

/**
 * Conservative set of terms that unambiguously indicate pharmaceutical
 * or medical search intent. Used as whole-word matches only — substring
 * occurrences inside nonsense tokens (e.g., "xyzmedicine12345") do NOT match.
 */
const KNOWN_PHARMA_TERMS: ReadonlySet<string> = new Set([
  // Dosage forms
  'medicine', 'tablet', 'capsule', 'syrup', 'pill', 'drops',
  'ointment', 'cream', 'gel', 'injection', 'suspension',
  // Symptoms / conditions
  'pain', 'fever', 'headache', 'cold', 'cough', 'allergy',
  'infection', 'flu', 'nausea', 'acidity', 'diarrhea',
  // Medical concepts
  'relief', 'supplement', 'vitamin', 'antibiotic', 'antiviral',
  'antacid', 'painkiller', 'analgesic', 'antipyretic',
]);

/**
 * Determine if a query has pharmaceutical intent using lexical signals.
 *
 * Two independent checks:
 *   1. Hinglish normalization changed the query (the normalizer recognized
 *      Hindi/Hinglish medical terms and translated them)
 *   2. The normalized query contains known pharmaceutical/medical terms
 *      as whole whitespace-delimited words
 *
 * @param rawQuery - Original user query
 * @param normalizedQuery - Query after Hinglish normalization
 * @returns true if pharmaceutical intent is detected
 */
export function hasPharmaceuticalIntent(rawQuery: string, normalizedQuery: string): boolean {
  // Signal 1: Hinglish normalization changed the query
  if (normalizedQuery !== rawQuery.toLowerCase().trim()) {
    return true;
  }

  // Signal 2: Any token is a known pharmaceutical term (whole-word match)
  const tokens = normalizedQuery.split(/\s+/);
  for (const token of tokens) {
    if (KNOWN_PHARMA_TERMS.has(token)) {
      return true;
    }
  }

  return false;
}

/**
 * Post-retrieval confidence filter.
 *
 * Decides whether pgvector candidates represent a meaningful semantic
 * match or just noise from high-dimensional cosine similarity.
 *
 * Decision logic (accept if ANY signal fires):
 *   1. hasPharmaceuticalIntent() → query has medical language
 *   2. topScore ≥ SEMANTIC_CONFIDENCE_THRESHOLD → strong embedding match
 *   Otherwise → reject all candidates
 *
 * @param candidates - Raw candidates from pgvector (already above SIMILARITY_THRESHOLD)
 * @param rawQuery - Original user query
 * @param normalizedQuery - Query after Hinglish normalization
 * @returns Filtered candidates (same array if accepted, empty if rejected)
 */
function filterByConfidence(
  candidates: SemanticCandidate[],
  rawQuery: string,
  normalizedQuery: string,
): { filtered: SemanticCandidate[]; reason: string } {
  if (candidates.length === 0) {
    return { filtered: [], reason: 'no-candidates' };
  }

  const topScore = candidates[0]!.score;

  // Signal 1 + 2: Pharmaceutical intent (normalization or known terms)
  if (hasPharmaceuticalIntent(rawQuery, normalizedQuery)) {
    return { filtered: candidates, reason: 'pharmaceutical-intent' };
  }

  // Signal 3: High embedding confidence
  if (topScore >= SEMANTIC_CONFIDENCE_THRESHOLD) {
    return { filtered: candidates, reason: 'high-confidence-score' };
  }

  // No signal fired — reject as low-confidence noise
  return { filtered: [], reason: 'low-confidence-rejected' };
}

// ─── Semantic Search ─────────────────────────────────────────────

/**
 * Search the medicine catalog using semantic (vector) similarity.
 *
 * This function:
 *   1. Normalizes the query (Hinglish → English)
 *   2. Generates an embedding vector for the normalized query
 *   3. Queries pgvector for the closest medicines by cosine similarity
 *   4. Filters by minimum similarity threshold
 *   5. Returns candidates with scores
 *
 * On ANY failure, returns { candidates: [], aiUsed: false } — never throws.
 *
 * @param query - Raw user search query (may contain Hinglish)
 * @param limit - Maximum candidates to return (default: 10)
 * @returns SemanticSearchResult with candidates and metadata
 */
export async function findSemanticCandidates(
  query: string,
  limit: number = MAX_CANDIDATES,
): Promise<SemanticSearchResult> {
  const startTime = Date.now();

  // Empty query guard
  if (!query || query.trim() === '') {
    return {
      normalizedQuery: '',
      candidates: [],
      latencyMs: 0,
      aiUsed: false,
    };
  }

  // AI disabled guard
  if (!aiConfig.enabled) {
    return {
      normalizedQuery: query.toLowerCase().trim(),
      candidates: [],
      latencyMs: Date.now() - startTime,
      aiUsed: false,
      error: 'AI is disabled',
    };
  }

  // Step 1: Normalize query (Hinglish → English)
  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return {
      normalizedQuery: '',
      candidates: [],
      latencyMs: Date.now() - startTime,
      aiUsed: false,
    };
  }

  try {
    // Step 2: Check provider availability
    const provider = getEmbeddingProvider(aiConfig);
    const isAvailable = await provider.isAvailable();

    if (!isAvailable) {
      logger.warn('Semantic search: embedding provider unavailable');
      return {
        normalizedQuery,
        candidates: [],
        latencyMs: Date.now() - startTime,
        aiUsed: false,
        error: 'Embedding provider unavailable',
      };
    }

    // Step 3: Generate query embedding
    const queryVector = await provider.embed(normalizedQuery);

    if (queryVector.length !== aiConfig.embeddingDimensions) {
      logger.error('Semantic search: query embedding dimension mismatch', {
        expected: aiConfig.embeddingDimensions,
        got: queryVector.length,
      });
      return {
        normalizedQuery,
        candidates: [],
        latencyMs: Date.now() - startTime,
        aiUsed: false,
        error: 'Embedding dimension mismatch',
      };
    }

    // Step 4: pgvector cosine similarity search
    // Uses the HNSW index (idx_medicine_catalog_embedding_hnsw)
    // Cosine distance: 1 - cosine_similarity, so we compute similarity as (1 - distance)
    const vectorStr = `[${queryVector.join(',')}]`;

    const candidates = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        generic_name: string | null;
        category: string | null;
        dosage_form: string | null;
        similarity: number;
      }>
    >(
      `SELECT
        id,
        name,
        generic_name,
        category,
        dosage_form,
        1 - ("embedding" <=> $1::vector) AS similarity
      FROM "medicine_catalog"
      WHERE "embedding" IS NOT NULL
        AND 1 - ("embedding" <=> $1::vector) >= $2
      ORDER BY "embedding" <=> $1::vector
      LIMIT $3`,
      vectorStr,
      SIMILARITY_THRESHOLD,
      limit,
    );

    // Step 5: Map to SemanticCandidate
    const rawCandidates: SemanticCandidate[] = candidates.map((row) => ({
      id: row.id,
      name: row.name,
      genericName: row.generic_name,
      category: row.category,
      dosageForm: row.dosage_form,
      score: Number(row.similarity),
    }));

    // Step 6: Confidence filter — reject low-confidence noise
    const { filtered, reason } = filterByConfidence(rawCandidates, query, normalizedQuery);

    logger.debug('Semantic search complete', {
      query: query.substring(0, 50),
      normalizedQuery,
      rawCandidateCount: rawCandidates.length,
      filteredCandidateCount: filtered.length,
      topScore: rawCandidates[0]?.score ?? null,
      confidenceDecision: reason,
      latencyMs: Date.now() - startTime,
    });

    return {
      normalizedQuery,
      candidates: filtered,
      latencyMs: Date.now() - startTime,
      aiUsed: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Semantic search failed', { error: message, query: query.substring(0, 50) });

    return {
      normalizedQuery,
      candidates: [],
      latencyMs: Date.now() - startTime,
      aiUsed: false,
      error: message,
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────

/** Exposed for testing — not part of the public API */
export const _config = {
  SIMILARITY_THRESHOLD,
  SEMANTIC_CONFIDENCE_THRESHOLD,
  MAX_CANDIDATES,
  KNOWN_PHARMA_TERMS,
} as const;

/** Exposed for testing — not part of the public API */
export const _confidence = {
  hasPharmaceuticalIntent,
  filterByConfidence,
} as const;
