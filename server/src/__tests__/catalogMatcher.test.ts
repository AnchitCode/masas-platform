/**
 * Catalog Matcher Tests (Phase 9.2c)
 *
 * Tests the medicine catalog matching logic.
 * Uses mocked database and semantic search to isolate unit behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchCandidates } from '../ai/prescription/catalogMatcher.js';
import { aiConfig } from '../ai/config.js';
import prisma from '../lib/prisma.js';
import { findSemanticCandidates } from '../ai/search/semanticSearch.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

// Mock semantic search
vi.mock('../ai/search/semanticSearch.js', () => ({
  findSemanticCandidates: vi.fn().mockResolvedValue({
    candidates: [],
    aiUsed: false,
    normalizedQuery: '',
    latencyMs: 0,
  }),
}));

const originalEnabled = aiConfig.enabled;

describe('Catalog Matcher (Phase 9.2c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (aiConfig as { enabled: boolean }).enabled = true;
  });

  afterEach(() => {
    (aiConfig as { enabled: boolean }).enabled = originalEnabled;
  });

  it('returns exact match when catalog has the medicine', async () => {
    // First call is exact match
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ id: 'med-1', name: 'Paracetamol', generic_name: 'Acetaminophen' }]);

    const results = await matchCandidates(['Paracetamol']);

    expect(results).toHaveLength(1);
    expect(results[0].extractedName).toBe('Paracetamol');
    expect(results[0].matches).toHaveLength(1);
    expect(results[0].matches[0].matchType).toBe('exact');
    expect(results[0].matches[0].confidence).toBe(1.0);
    expect(results[0].matches[0].name).toBe('Paracetamol');
  });

  it('falls through to fuzzy match when no exact match', async () => {
    // First call: exact match returns nothing
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([]) // exact
      .mockResolvedValueOnce([{ id: 'med-2', name: 'Paracetamol 500mg', generic_name: null }]); // fuzzy

    const results = await matchCandidates(['Paracetamol']);

    expect(results[0].matches).toHaveLength(1);
    expect(results[0].matches[0].matchType).toBe('fuzzy');
    expect(results[0].matches[0].confidence).toBe(0.7);
  });

  it('falls through to semantic match when no exact or fuzzy match', async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([]) // exact
      .mockResolvedValueOnce([]); // fuzzy

    vi.mocked(findSemanticCandidates).mockResolvedValueOnce({
      candidates: [
        { id: 'med-3', name: 'Acetaminophen', genericName: null, category: null, dosageForm: null, score: 0.85 },
      ],
      aiUsed: true,
      normalizedQuery: 'paracetamol',
      latencyMs: 100,
    });

    const results = await matchCandidates(['Paracetamol']);

    expect(results[0].matches).toHaveLength(1);
    expect(results[0].matches[0].matchType).toBe('semantic');
    expect(results[0].matches[0].confidence).toBe(0.85);
  });

  it('skips semantic match when AI is disabled', async () => {
    (aiConfig as { enabled: boolean }).enabled = false;

    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([]) // exact
      .mockResolvedValueOnce([]); // fuzzy

    const results = await matchCandidates(['UnknownMedicine']);

    expect(results[0].matches).toHaveLength(0);
    expect(findSemanticCandidates).not.toHaveBeenCalled();
  });

  it('handles multiple candidates sequentially', async () => {
    // Candidate 1: exact match (1 result), then fuzzy (0 results) since 1 < 3
    // Candidate 2: exact (0 results), then fuzzy match (1 result)
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ id: 'med-1', name: 'Paracetamol', generic_name: null }]) // C1 exact
      .mockResolvedValueOnce([]) // C1 fuzzy (none extra)
      .mockResolvedValueOnce([]) // C2 exact (empty)
      .mockResolvedValueOnce([{ id: 'med-2', name: 'Amoxicillin 250mg', generic_name: 'Amoxicillin' }]); // C2 fuzzy

    const results = await matchCandidates(['Paracetamol', 'Amoxicillin']);

    expect(results).toHaveLength(2);
    expect(results[0].matches[0].matchType).toBe('exact');
    expect(results[1].matches[0].matchType).toBe('fuzzy');
  });

  it('returns empty matches for empty candidate name', async () => {
    const results = await matchCandidates(['']);

    expect(results).toHaveLength(1);
    expect(results[0].matches).toHaveLength(0);
    // No DB queries should be made for empty strings
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('handles empty candidates array', async () => {
    const results = await matchCandidates([]);

    expect(results).toHaveLength(0);
  });

  it('caps matches at 3 per candidate', async () => {
    // Return 5 exact matches — should be capped to 3
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: 'med-1', name: 'Med A', generic_name: null },
      { id: 'med-2', name: 'Med B', generic_name: null },
      { id: 'med-3', name: 'Med C', generic_name: null },
      { id: 'med-4', name: 'Med D', generic_name: null },
      { id: 'med-5', name: 'Med E', generic_name: null },
    ]);

    const results = await matchCandidates(['Med']);

    expect(results[0].matches.length).toBeLessThanOrEqual(3);
  });

  it('handles semantic search failure gracefully', async () => {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([]) // exact
      .mockResolvedValueOnce([]); // fuzzy

    vi.mocked(findSemanticCandidates).mockRejectedValueOnce(new Error('Ollama down'));

    const results = await matchCandidates(['TestMedicine']);

    // Should not throw, should return empty matches
    expect(results[0].matches).toHaveLength(0);
  });
});
