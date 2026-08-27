/**
 * Semantic Candidate Search (Phase 9.1d)
 *
 * Retrieves medicine candidates from the catalog using pgvector
 * cosine similarity search. This is a CANDIDATE retrieval function —
 * it does NOT determine availability, pricing, or geographic proximity.
 *
 * Pipeline:
 *   user query → normalizeQuery() → embed() → pgvector cosine search → candidates
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

/** Minimum cosine similarity threshold — candidates below this are filtered out */
const SIMILARITY_THRESHOLD = 0.3;

/** Maximum number of semantic candidates to return */
const MAX_CANDIDATES = 10;

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
    const result: SemanticCandidate[] = candidates.map((row) => ({
      id: row.id,
      name: row.name,
      genericName: row.generic_name,
      category: row.category,
      dosageForm: row.dosage_form,
      score: Number(row.similarity),
    }));

    logger.debug('Semantic search complete', {
      query: query.substring(0, 50),
      normalizedQuery,
      candidateCount: result.length,
      topScore: result[0]?.score ?? null,
      latencyMs: Date.now() - startTime,
    });

    return {
      normalizedQuery,
      candidates: result,
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
  MAX_CANDIDATES,
} as const;
