/**
 * Semantic Candidate Search Tests (Phase 9.1d)
 *
 * Tests the pgvector semantic search with mocked embedding provider.
 * Does NOT require Ollama — uses mock vectors for deterministic testing.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createTestMedicine, prisma } from './setup.js';

// ─── Mock AI Config ──────────────────────────────────────────────

vi.mock('../ai/config.js', () => ({
  aiConfig: {
    enabled: true,
    embeddingDimensions: 768,
    embeddingProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    embeddingModel: 'nomic-embed-text',
  },
}));

// ─── Mock Embedding Provider ─────────────────────────────────────

const mockEmbed = vi.fn<(text: string) => Promise<number[]>>();
const mockIsAvailable = vi.fn<() => Promise<boolean>>();

vi.mock('../ai/providers/index.js', () => ({
  getEmbeddingProvider: () => ({
    name: 'mock',
    embed: mockEmbed,
    embedBatch: async (texts: string[]) => {
      const results = [];
      for (const t of texts) results.push(await mockEmbed(t));
      return results;
    },
    isAvailable: mockIsAvailable,
    getDimensions: () => 768,
  }),
  getLLMProvider: () => ({}),
}));

// Import after mocks
import { findSemanticCandidates } from '../ai/search/semanticSearch.js';

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Create a deterministic 768-dim vector with a specific "direction"
 * so we can control cosine similarity between vectors.
 */
function makeVector(seed: number, dim = 768): number[] {
  const v = new Array(dim).fill(0);
  // Set a few dimensions based on seed to create distinct directions
  v[seed % dim] = 1.0;
  v[(seed * 7) % dim] = 0.5;
  v[(seed * 13) % dim] = 0.3;
  return v;
}

/**
 * Store a pre-computed embedding for a medicine via raw SQL.
 */
async function storeEmbedding(medicineId: string, vector: number[]): Promise<void> {
  const vectorStr = `[${vector.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `UPDATE "medicine_catalog" SET "embedding" = $1::vector, "embedding_hash" = 'test-hash' WHERE "id" = $2`,
    vectorStr,
    medicineId,
  );
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Semantic Candidate Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAvailable.mockResolvedValue(true);
  });

  describe('successful searches', () => {
    it('returns candidates with similarity scores', async () => {
      // Create medicine and store an embedding
      const med = await createTestMedicine({ name: 'test-paracetamol', genericName: 'Acetaminophen' });
      const medVector = makeVector(1);
      await storeEmbedding(med.id, medVector);

      // Mock: return a similar vector for the query
      mockEmbed.mockResolvedValue(medVector); // Same vector = similarity ~1.0

      const result = await findSemanticCandidates('paracetamol');

      expect(result.aiUsed).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0]!.id).toBe(med.id);
      expect(result.candidates[0]!.name).toBe('test-paracetamol');
      expect(result.candidates[0]!.score).toBeGreaterThan(0.9);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns candidates ordered by similarity (highest first)', async () => {
      const med1 = await createTestMedicine({ name: 'semantic-close' });
      const med2 = await createTestMedicine({ name: 'semantic-far' });

      // Create query vector and two medicine vectors with different similarity
      const queryVector = makeVector(42);
      // med1: identical to query → similarity ~1.0
      await storeEmbedding(med1.id, queryVector);
      // med2: shifted version of query → lower but above threshold
      const shiftedVector = [...queryVector];
      // Perturb a few dimensions to reduce similarity but keep above 0.3
      shiftedVector[0] = 0.8;
      shiftedVector[1] = 0.6;
      shiftedVector[2] = 0.4;
      await storeEmbedding(med2.id, shiftedVector);

      mockEmbed.mockResolvedValue(queryVector);

      const result = await findSemanticCandidates('test query');

      expect(result.candidates.length).toBe(2);
      // First candidate should have higher score
      expect(result.candidates[0]!.score).toBeGreaterThanOrEqual(result.candidates[1]!.score);
    });

    it('includes genericName, category, dosageForm in candidates', async () => {
      const med = await createTestMedicine({
        name: 'test-ibuprofen',
        genericName: 'Ibuprofen',
        category: 'NSAID',
        dosageForm: 'Tablet',
      });
      const v = makeVector(5);
      await storeEmbedding(med.id, v);
      mockEmbed.mockResolvedValue(v);

      const result = await findSemanticCandidates('ibuprofen');

      expect(result.candidates[0]!.genericName).toBe('Ibuprofen');
      expect(result.candidates[0]!.category).toBe('NSAID');
      expect(result.candidates[0]!.dosageForm).toBe('Tablet');
    });

    it('applies Hinglish normalization before embedding', async () => {
      const med = await createTestMedicine({ name: 'test-pain-med' });
      const v = makeVector(10);
      await storeEmbedding(med.id, v);
      mockEmbed.mockResolvedValue(v);

      const result = await findSemanticCandidates('dard ki dawa');

      expect(result.normalizedQuery).toBe('pain medicine');
      expect(result.aiUsed).toBe(true);
      // embed() was called with the normalized query
      expect(mockEmbed).toHaveBeenCalledWith('pain medicine');
    });
  });

  describe('filtering', () => {
    it('filters out candidates below similarity threshold', async () => {
      const med = await createTestMedicine({ name: 'low-sim-med' });
      // Create a vector that will have low similarity to the query
      await storeEmbedding(med.id, makeVector(1));
      // Return a completely different vector → low cosine similarity
      const orthogonalVector = new Array(768).fill(0);
      orthogonalVector[500] = 1.0; // Point in a very different direction
      mockEmbed.mockResolvedValue(orthogonalVector);

      const result = await findSemanticCandidates('completely unrelated query');

      // Should either be empty or all candidates should be above threshold
      for (const c of result.candidates) {
        expect(c.score).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('respects limit parameter', async () => {
      // Create multiple medicines
      for (let i = 0; i < 5; i++) {
        const med = await createTestMedicine({ name: `limit-test-${i}` });
        await storeEmbedding(med.id, makeVector(i + 1));
      }
      mockEmbed.mockResolvedValue(makeVector(1)); // Similar to first

      const result = await findSemanticCandidates('test', 2);

      expect(result.candidates.length).toBeLessThanOrEqual(2);
    });

    it('skips medicines without embeddings', async () => {
      const medWith = await createTestMedicine({ name: 'has-embedding' });
      await createTestMedicine({ name: 'no-embedding' }); // No embedding stored

      const v = makeVector(20);
      await storeEmbedding(medWith.id, v);
      mockEmbed.mockResolvedValue(v);

      const result = await findSemanticCandidates('test');

      // Only the medicine with an embedding should appear
      const names = result.candidates.map((c) => c.name);
      expect(names).toContain('has-embedding');
      expect(names).not.toContain('no-embedding');
    });
  });

  // ─── Error Handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('returns empty candidates for empty query', async () => {
      const result = await findSemanticCandidates('');
      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
    });

    it('returns empty candidates for whitespace query', async () => {
      const result = await findSemanticCandidates('   ');
      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
    });

    it('returns empty candidates when provider is unavailable', async () => {
      mockIsAvailable.mockResolvedValue(false);

      const result = await findSemanticCandidates('paracetamol');

      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toContain('unavailable');
    });

    it('returns empty candidates when embed() throws', async () => {
      mockIsAvailable.mockResolvedValue(true);
      mockEmbed.mockRejectedValue(new Error('Ollama connection refused'));

      const result = await findSemanticCandidates('paracetamol');

      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toContain('connection refused');
    });

    it('returns empty candidates when embed() returns wrong dimensions', async () => {
      mockIsAvailable.mockResolvedValue(true);
      mockEmbed.mockResolvedValue(Array(512).fill(0.1)); // Wrong dimensions

      const result = await findSemanticCandidates('paracetamol');

      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toContain('dimension mismatch');
    });

    it('never throws — always returns a result object', async () => {
      mockIsAvailable.mockRejectedValue(new Error('Network error'));

      // Should not throw
      const result = await findSemanticCandidates('test');
      expect(result).toBeDefined();
      expect(result.candidates).toEqual([]);
      expect(result.aiUsed).toBe(false);
    });
  });

  // ─── Normalization Integration ─────────────────────────────────

  describe('query normalization integration', () => {
    it('normalizes Hinglish in the result metadata', async () => {
      mockEmbed.mockResolvedValue(makeVector(1));

      const result = await findSemanticCandidates('bukhar ki dawa');
      expect(result.normalizedQuery).toBe('fever medicine');
    });

    it('passes English queries through unchanged', async () => {
      mockEmbed.mockResolvedValue(makeVector(1));

      const result = await findSemanticCandidates('Headache Medicine');
      expect(result.normalizedQuery).toBe('headache medicine');
    });
  });
});
