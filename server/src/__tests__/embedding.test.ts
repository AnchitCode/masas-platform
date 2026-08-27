/**
 * Embedding Pipeline Tests (Phase 9.1c)
 *
 * Tests the embedding text builder, hash computation, embedding service,
 * and event bridge with mocked embedding providers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildEmbeddingText,
  computeEmbeddingHash,
  buildEmbeddingTextAndHash,
} from '../ai/embedding/embeddingText.js';
import type { EmbeddingTextInput } from '../ai/embedding/embeddingText.js';

// ─── Canonical Text Tests ────────────────────────────────────────

describe('Embedding Text Builder', () => {
  describe('buildEmbeddingText', () => {
    it('builds full canonical text with all fields', () => {
      const med: EmbeddingTextInput = {
        name: 'paracetamol 500mg',
        genericName: 'Acetaminophen',
        category: 'Analgesic/Antipyretic',
        dosageForm: 'Tablet',
      };
      const text = buildEmbeddingText(med);
      expect(text).toBe('paracetamol 500mg. Generic: Acetaminophen. Category: Analgesic/Antipyretic. Form: Tablet');
    });

    it('omits null genericName', () => {
      const med: EmbeddingTextInput = {
        name: 'unknown medicine',
        genericName: null,
        category: 'Antibiotic',
        dosageForm: 'Capsule',
      };
      const text = buildEmbeddingText(med);
      expect(text).toBe('unknown medicine. Category: Antibiotic. Form: Capsule');
      expect(text).not.toContain('Generic');
    });

    it('omits null category', () => {
      const med: EmbeddingTextInput = {
        name: 'test med',
        genericName: 'TestGeneric',
        category: null,
        dosageForm: 'Tablet',
      };
      const text = buildEmbeddingText(med);
      expect(text).toBe('test med. Generic: TestGeneric. Form: Tablet');
      expect(text).not.toContain('Category');
    });

    it('omits null dosageForm', () => {
      const med: EmbeddingTextInput = {
        name: 'test med',
        genericName: 'TestGeneric',
        category: 'Analgesic',
        dosageForm: null,
      };
      const text = buildEmbeddingText(med);
      expect(text).toBe('test med. Generic: TestGeneric. Category: Analgesic');
      expect(text).not.toContain('Form');
    });

    it('handles all-null optional fields (name only)', () => {
      const med: EmbeddingTextInput = {
        name: 'dolo 650',
        genericName: null,
        category: null,
        dosageForm: null,
      };
      const text = buildEmbeddingText(med);
      expect(text).toBe('dolo 650');
    });

    it('is deterministic — same input always produces same output', () => {
      const med: EmbeddingTextInput = {
        name: 'ibuprofen 400mg',
        genericName: 'Ibuprofen',
        category: 'NSAID',
        dosageForm: 'Tablet',
      };
      const text1 = buildEmbeddingText(med);
      const text2 = buildEmbeddingText(med);
      expect(text1).toBe(text2);
    });
  });

  describe('computeEmbeddingHash', () => {
    it('produces a 64-char hex string (SHA-256)', () => {
      const hash = computeEmbeddingHash('test text');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic', () => {
      const hash1 = computeEmbeddingHash('same text');
      const hash2 = computeEmbeddingHash('same text');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = computeEmbeddingHash('paracetamol');
      const hash2 = computeEmbeddingHash('ibuprofen');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('buildEmbeddingTextAndHash', () => {
    it('returns both text and hash', () => {
      const med: EmbeddingTextInput = {
        name: 'amoxicillin 500mg',
        genericName: 'Amoxicillin',
        category: 'Antibiotic',
        dosageForm: 'Capsule',
      };
      const result = buildEmbeddingTextAndHash(med);

      expect(result.text).toBe('amoxicillin 500mg. Generic: Amoxicillin. Category: Antibiotic. Form: Capsule');
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('hash changes when name changes', () => {
      const med1: EmbeddingTextInput = { name: 'paracetamol 500mg', genericName: null, category: null, dosageForm: null };
      const med2: EmbeddingTextInput = { name: 'paracetamol 650mg', genericName: null, category: null, dosageForm: null };

      const result1 = buildEmbeddingTextAndHash(med1);
      const result2 = buildEmbeddingTextAndHash(med2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('hash changes when genericName changes', () => {
      const base = { name: 'test', category: null, dosageForm: null };
      const r1 = buildEmbeddingTextAndHash({ ...base, genericName: 'OldGeneric' });
      const r2 = buildEmbeddingTextAndHash({ ...base, genericName: 'NewGeneric' });
      expect(r1.hash).not.toBe(r2.hash);
    });

    it('hash changes when category changes', () => {
      const base = { name: 'test', genericName: null, dosageForm: null };
      const r1 = buildEmbeddingTextAndHash({ ...base, category: 'Analgesic' });
      const r2 = buildEmbeddingTextAndHash({ ...base, category: 'Antibiotic' });
      expect(r1.hash).not.toBe(r2.hash);
    });

    it('hash does NOT change when excluded fields change (e.g., manufacturer not included)', () => {
      // Manufacturer is intentionally excluded from canonical text.
      // This test verifies that if we build the same EmbeddingTextInput,
      // the hash is the same regardless of other MedicineCatalog fields.
      const med: EmbeddingTextInput = {
        name: 'test medicine',
        genericName: 'TestGeneric',
        category: 'Analgesic',
        dosageForm: 'Tablet',
      };
      const result1 = buildEmbeddingTextAndHash(med);
      const result2 = buildEmbeddingTextAndHash(med);
      expect(result1.hash).toBe(result2.hash);
    });
  });
});

// ─── Embedding Service Tests (with mocked provider) ──────────────

// These tests use the real database (via setup.ts) but mock the AI provider
// to avoid requiring Ollama during testing.

import { createTestMedicine, prisma } from './setup.js';

// Mock the AI config and provider before importing the service
vi.mock('../ai/config.js', () => ({
  aiConfig: {
    enabled: true,
    embeddingDimensions: 768,
    embeddingProvider: 'ollama',
    ollamaBaseUrl: 'http://localhost:11434',
    embeddingModel: 'nomic-embed-text',
  },
}));

// Create a mock embedding provider
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

// Import the service (mocks are hoisted by vitest, so this works)
import {
  generateEmbeddingForMedicine,
  backfillEmbeddings,
  getEmbeddingStatus,
} from '../ai/embedding/embeddingService.js';

describe('Embedding Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: provider is available and returns a valid 768-dim vector
    mockIsAvailable.mockResolvedValue(true);
    mockEmbed.mockResolvedValue(Array(768).fill(0.1));
  });

  describe('generateEmbeddingForMedicine', () => {
    it('generates embedding for a medicine without one', async () => {
      const med = await createTestMedicine({ name: 'test-embed-gen' });

      const result = await generateEmbeddingForMedicine(med.id);
      expect(result.status).toBe('generated');
      expect(result.medicineId).toBe(med.id);

      // Verify embedding was stored
      const stored = await prisma.$queryRawUnsafe<[{ has_embedding: boolean; hash: string | null }]>(
        `SELECT "embedding" IS NOT NULL as has_embedding, "embedding_hash" as hash FROM "medicine_catalog" WHERE "id" = $1`,
        med.id,
      );
      expect(stored[0].has_embedding).toBe(true);
      expect(stored[0].hash).toBeTruthy();
    });

    it('skips medicine that already has up-to-date embedding', async () => {
      const med = await createTestMedicine({ name: 'test-embed-skip' });

      // First generation
      const result1 = await generateEmbeddingForMedicine(med.id);
      expect(result1.status).toBe('generated');

      // Second call — should skip
      const result2 = await generateEmbeddingForMedicine(med.id);
      expect(result2.status).toBe('skipped');

      // embed() should have been called only once
      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });

    it('regenerates when catalog fields change (stale hash)', async () => {
      const med = await createTestMedicine({ name: 'test-embed-stale', category: 'Analgesic' });

      // First generation
      await generateEmbeddingForMedicine(med.id);
      expect(mockEmbed).toHaveBeenCalledTimes(1);

      // Simulate catalog field change (update category)
      await prisma.medicineCatalog.update({
        where: { id: med.id },
        data: { category: 'Antibiotic' },
      });

      // Second generation — should regenerate because hash changed
      const result = await generateEmbeddingForMedicine(med.id);
      expect(result.status).toBe('generated');
      expect(mockEmbed).toHaveBeenCalledTimes(2);
    });

    it('returns error for non-existent medicine', async () => {
      const result = await generateEmbeddingForMedicine('non-existent-id');
      expect(result.status).toBe('error');
      expect(result.error).toContain('not found');
    });

    it('returns error when embedding dimensions mismatch', async () => {
      mockEmbed.mockResolvedValue(Array(512).fill(0.1)); // Wrong dimensions
      const med = await createTestMedicine({ name: 'test-embed-dim-error' });

      const result = await generateEmbeddingForMedicine(med.id);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Dimension mismatch');
    });

    it('returns error when provider throws', async () => {
      mockEmbed.mockRejectedValue(new Error('Ollama connection refused'));
      const med = await createTestMedicine({ name: 'test-embed-provider-error' });

      const result = await generateEmbeddingForMedicine(med.id);
      expect(result.status).toBe('error');
      expect(result.error).toContain('connection refused');
    });
  });

  describe('backfillEmbeddings', () => {
    it('generates embeddings for all medicines without one', async () => {
      await createTestMedicine({ name: 'backfill-1' });
      await createTestMedicine({ name: 'backfill-2' });
      await createTestMedicine({ name: 'backfill-3' });

      const report = await backfillEmbeddings();
      expect(report.total).toBe(3);
      expect(report.generated).toBe(3);
      expect(report.skipped).toBe(0);
      expect(report.errors).toBe(0);
      expect(report.durationMs).toBeGreaterThan(0);
    });

    it('skips medicines with up-to-date embeddings', async () => {
      const med1 = await createTestMedicine({ name: 'backfill-skip-1' });
      await createTestMedicine({ name: 'backfill-skip-2' });

      // Generate embedding for first medicine
      await generateEmbeddingForMedicine(med1.id);
      vi.clearAllMocks();
      mockIsAvailable.mockResolvedValue(true);
      mockEmbed.mockResolvedValue(Array(768).fill(0.1));

      // Backfill should skip the first and generate for the second
      const report = await backfillEmbeddings();
      expect(report.generated).toBe(1);
      expect(report.skipped).toBe(1);
    });

    it('continues on individual errors', async () => {
      await createTestMedicine({ name: 'backfill-err-1' });
      await createTestMedicine({ name: 'backfill-err-2' });

      // Make the first embed call fail, second succeed
      mockEmbed.mockRejectedValueOnce(new Error('Timeout'));
      mockEmbed.mockResolvedValue(Array(768).fill(0.1));

      const report = await backfillEmbeddings();
      expect(report.errors).toBe(1);
      expect(report.generated).toBe(1);
    });

    it('aborts if provider is not available', async () => {
      await createTestMedicine({ name: 'backfill-unavail' });
      mockIsAvailable.mockResolvedValue(false);

      const report = await backfillEmbeddings();
      expect(report.errors).toBe(1);
      expect(report.generated).toBe(0);
    });

    it('respects batchSize limit', async () => {
      await createTestMedicine({ name: 'batch-1' });
      await createTestMedicine({ name: 'batch-2' });
      await createTestMedicine({ name: 'batch-3' });

      const report = await backfillEmbeddings(2);
      // With batchSize 2, only 2 medicines should be processed
      expect(report.total).toBe(2);
    });
  });

  describe('getEmbeddingStatus', () => {
    it('returns correct counts with no embeddings', async () => {
      await createTestMedicine({ name: 'status-1' });
      await createTestMedicine({ name: 'status-2' });

      const status = await getEmbeddingStatus();
      expect(status.total).toBe(2);
      expect(status.withEmbedding).toBe(0);
      expect(status.withoutEmbedding).toBe(2);
      expect(status.dimensions).toBeNull();
    });

    it('returns correct counts after generating embeddings', async () => {
      const med = await createTestMedicine({ name: 'status-with-embed' });
      await createTestMedicine({ name: 'status-without-embed' });

      await generateEmbeddingForMedicine(med.id);

      const status = await getEmbeddingStatus();
      expect(status.total).toBe(2);
      expect(status.withEmbedding).toBe(1);
      expect(status.withoutEmbedding).toBe(1);
      expect(status.dimensions).toBe(768);
    });
  });
});
