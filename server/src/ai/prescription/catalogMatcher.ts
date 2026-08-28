/**
 * Catalog Matcher (Phase 9.2c)
 *
 * Matches LLM-extracted medicine name candidates against the MedicineCatalog
 * using exact, fuzzy, and semantic matching (reuses Phase 9.1d infrastructure).
 *
 * IMPORTANT:
 *   - This does NOT provide medical advice or automatic substitutions.
 *   - Matches are presented to the user for review and verification.
 *   - Sequential processing to respect M1 8 GB memory constraints.
 */

import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { findSemanticCandidates } from '../search/semanticSearch.js';
import { aiConfig } from '../config.js';
import logger from '../../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface CatalogMatch {
  /** Medicine catalog ID */
  id: string;
  /** Medicine name */
  name: string;
  /** Generic/active ingredient name */
  genericName: string | null;
  /** How the match was found */
  matchType: 'exact' | 'fuzzy' | 'semantic';
  /** Match confidence (0–1) */
  confidence: number;
}

export interface MatchResult {
  /** The original name extracted by the LLM */
  extractedName: string;
  /** Best matching catalog medicines (max 3) */
  matches: CatalogMatch[];
}

interface CatalogRow {
  id: string;
  name: string;
  generic_name: string | null;
}

// ─── Matching Logic ─────────────────────────────────────────────

const MAX_MATCHES_PER_CANDIDATE = 3;

/**
 * Find exact matches in the catalog (case-insensitive).
 */
async function findExactMatches(name: string): Promise<CatalogMatch[]> {
  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT id, name, generic_name
    FROM medicine_catalog
    WHERE name ILIKE ${name}
    LIMIT ${MAX_MATCHES_PER_CANDIDATE}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    genericName: r.generic_name,
    matchType: 'exact' as const,
    confidence: 1.0,
  }));
}

/**
 * Find fuzzy matches in the catalog (substring/contains match).
 * Excludes IDs already found by exact match.
 */
async function findFuzzyMatches(name: string, excludeIds: string[]): Promise<CatalogMatch[]> {
  const pattern = `%${name}%`;
  const limit = MAX_MATCHES_PER_CANDIDATE;

  const excludeClause = excludeIds.length > 0
    ? Prisma.sql`AND id NOT IN (${Prisma.join(excludeIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT id, name, generic_name
    FROM medicine_catalog
    WHERE (name ILIKE ${pattern} OR generic_name ILIKE ${pattern})
      ${excludeClause}
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    genericName: r.generic_name,
    matchType: 'fuzzy' as const,
    confidence: 0.7,
  }));
}

/**
 * Find semantic matches using Phase 9.1d vector search.
 * Excludes IDs already found by exact/fuzzy match.
 */
async function findSemanticMatches(name: string, excludeIds: string[]): Promise<CatalogMatch[]> {
  const { candidates } = await findSemanticCandidates(name, MAX_MATCHES_PER_CANDIDATE + excludeIds.length);

  return candidates
    .filter((c) => !excludeIds.includes(c.id))
    .slice(0, MAX_MATCHES_PER_CANDIDATE)
    .map((c) => ({
      id: c.id,
      name: c.name,
      genericName: c.genericName,
      matchType: 'semantic' as const,
      confidence: c.score,
    }));
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Match a list of extracted medicine name candidates against the MedicineCatalog.
 *
 * For each candidate:
 *   1. Try exact match (ILIKE)
 *   2. If not enough matches, try fuzzy (substring)
 *   3. If AI enabled and still not enough, try semantic (vector search)
 *
 * Processing is sequential to respect M1 memory constraints.
 *
 * @param candidates - Array of medicine name strings from LLM extraction
 * @returns Array of MatchResults, one per candidate
 */
export async function matchCandidates(candidates: string[]): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  const start = Date.now();

  for (const extractedName of candidates) {
    const trimmed = extractedName.trim();
    if (trimmed.length === 0) {
      results.push({ extractedName, matches: [] });
      continue;
    }

    const allMatches: CatalogMatch[] = [];

    // 1. Exact match
    const exactMatches = await findExactMatches(trimmed);
    allMatches.push(...exactMatches);

    // 2. Fuzzy match (if we need more)
    if (allMatches.length < MAX_MATCHES_PER_CANDIDATE) {
      const existingIds = allMatches.map((m) => m.id);
      const fuzzyMatches = await findFuzzyMatches(trimmed, existingIds);
      allMatches.push(...fuzzyMatches);
    }

    // 3. Semantic match (if AI enabled and we need more)
    if (allMatches.length < MAX_MATCHES_PER_CANDIDATE && aiConfig.enabled) {
      const existingIds = allMatches.map((m) => m.id);
      try {
        const semanticMatches = await findSemanticMatches(trimmed, existingIds);
        allMatches.push(...semanticMatches);
      } catch {
        // Semantic search failure is non-fatal — we still have exact/fuzzy results
        logger.debug('Semantic matching failed for candidate, continuing', { extractedName: trimmed });
      }
    }

    // Cap at MAX_MATCHES_PER_CANDIDATE
    results.push({
      extractedName,
      matches: allMatches.slice(0, MAX_MATCHES_PER_CANDIDATE),
    });
  }

  const latencyMs = Date.now() - start;
  logger.debug('Catalog matching complete', {
    candidateCount: candidates.length,
    totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
    latencyMs,
  });

  return results;
}
