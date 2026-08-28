/**
 * Prescription Extractor Tests (Phase 9.2b)
 *
 * Tests the LLM-based medicine name extraction from OCR text.
 * Uses mocked LLM provider to avoid Ollama dependency in CI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractMedicineNames } from '../ai/prescription/prescriptionExtractor.js';
import { aiConfig } from '../ai/config.js';

// Mock the provider factory
vi.mock('../ai/providers/index.js', () => ({
  getLLMProvider: vi.fn(() => mockLLMProvider),
  getEmbeddingProvider: vi.fn(),
}));

// Reusable mock LLM provider
const mockLLMProvider = {
  name: 'mock-llm',
  isAvailable: vi.fn().mockResolvedValue(true),
  generate: vi.fn(),
  generateJSON: vi.fn(),
};

const originalEnabled = aiConfig.enabled;

describe('Prescription Extractor (Phase 9.2b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (aiConfig as { enabled: boolean }).enabled = true;
    mockLLMProvider.isAvailable.mockResolvedValue(true);
  });

  afterEach(() => {
    (aiConfig as { enabled: boolean }).enabled = originalEnabled;
  });

  describe('successful extraction', () => {
    it('extracts medicine names from OCR text', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['Paracetamol', 'Amoxicillin', 'Omeprazole'],
      });

      const result = await extractMedicineNames(
        'Dr. Smith\nParacetamol 500mg\nAmoxicillin 250mg BD\nOmeprazole 20mg OD',
      );

      expect(result.aiUsed).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.candidates).toHaveLength(3);
      expect(result.candidates[0].name).toBe('Paracetamol');
      expect(result.candidates[1].name).toBe('Amoxicillin');
      expect(result.candidates[2].name).toBe('Omeprazole');
      expect(result.llmLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('deduplicates case-insensitive medicine names', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['Paracetamol', 'paracetamol', 'PARACETAMOL'],
      });

      const result = await extractMedicineNames('Paracetamol paracetamol PARACETAMOL');

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].name).toBe('Paracetamol');
    });

    it('normalizes whitespace in medicine names', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['  Paracetamol   500mg  '],
      });

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates[0].name).toBe('Paracetamol 500mg');
      expect(result.candidates[0].raw).toBe('  Paracetamol   500mg  ');
    });

    it('returns empty array for prescription with no medicines', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: [],
      });

      const result = await extractMedicineNames('Patient Name: John Doe\nDate: 2024-01-01');

      expect(result.aiUsed).toBe(true);
      expect(result.candidates).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    it('preserves raw LLM output in candidate.raw', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['Crocin Advance'],
      });

      const result = await extractMedicineNames('Take Crocin Advance 500mg');

      expect(result.candidates[0].raw).toBe('Crocin Advance');
      expect(result.candidates[0].name).toBe('Crocin Advance');
    });
  });

  describe('validation and edge cases', () => {
    it('rejects invalid LLM JSON output (no medicines key)', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        drugs: ['Paracetamol'],
      });

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates).toHaveLength(0);
      expect(result.aiUsed).toBe(true);
      expect(result.error).toBe('LLM output invalid');
    });

    it('rejects LLM output with too many items (>20)', async () => {
      const tooMany = Array.from({ length: 25 }, (_, i) => `Medicine${i}`);
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: tooMany,
      });

      const result = await extractMedicineNames('Many medicines');

      expect(result.candidates).toHaveLength(0);
      expect(result.error).toBe('LLM output invalid');
    });

    it('rejects medicine names that are too long (>100 chars)', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['A'.repeat(101)],
      });

      const result = await extractMedicineNames('Long name medicine');

      expect(result.candidates).toHaveLength(0);
      expect(result.error).toBe('LLM output invalid');
    });

    it('rejects empty strings in medicines array', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: [''],
      });

      const result = await extractMedicineNames('Empty medicine');

      expect(result.candidates).toHaveLength(0);
      expect(result.error).toBe('LLM output invalid');
    });

    it('filters out empty-after-trim candidates', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({
        medicines: ['Paracetamol', '   '],
      });

      // '   ' passes Zod min(1) but after trim becomes empty
      // Note: Zod min(1) checks the raw string length, so '   ' passes
      // Our normalization then filters it out
      const result = await extractMedicineNames('Paracetamol and spaces');

      // '   ' has length 3, so it passes Zod's min(1)
      // But after normalizeName it becomes '' and gets filtered
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].name).toBe('Paracetamol');
    });
  });

  describe('failure handling', () => {
    it('returns empty result when AI is disabled', async () => {
      (aiConfig as { enabled: boolean }).enabled = false;

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates).toHaveLength(0);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toBe('AI is disabled');
      expect(result.llmLatencyMs).toBe(0);
    });

    it('returns empty result for very short OCR text', async () => {
      const result = await extractMedicineNames('ab');

      expect(result.candidates).toHaveLength(0);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toBe('OCR text too short');
    });

    it('returns empty result for empty OCR text', async () => {
      const result = await extractMedicineNames('');

      expect(result.candidates).toHaveLength(0);
      expect(result.error).toBe('OCR text too short');
    });

    it('returns empty result when LLM is unavailable', async () => {
      mockLLMProvider.isAvailable.mockResolvedValue(false);

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates).toHaveLength(0);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toBe('LLM unavailable');
    });

    it('handles LLM throwing an error gracefully', async () => {
      mockLLMProvider.generateJSON.mockRejectedValue(new Error('Ollama timeout'));

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates).toHaveLength(0);
      expect(result.aiUsed).toBe(false);
      expect(result.error).toBe('Ollama timeout');
    });

    it('handles LLM returning non-JSON gracefully', async () => {
      mockLLMProvider.generateJSON.mockRejectedValue(
        new Error('Ollama returned invalid JSON: Here are the medicines...'),
      );

      const result = await extractMedicineNames('Paracetamol 500mg');

      expect(result.candidates).toHaveLength(0);
      expect(result.error).toContain('invalid JSON');
    });
  });

  describe('prompt construction', () => {
    it('calls LLM with temperature 0 for deterministic output', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({ medicines: [] });

      await extractMedicineNames('Test prescription text');

      expect(mockLLMProvider.generateJSON).toHaveBeenCalledWith(
        expect.stringContaining('medicine name extractor'),
        expect.objectContaining({ temperature: 0.0 }),
      );
    });

    it('includes the OCR text in the prompt', async () => {
      mockLLMProvider.generateJSON.mockResolvedValue({ medicines: [] });

      await extractMedicineNames('Unique prescription text 12345');

      expect(mockLLMProvider.generateJSON).toHaveBeenCalledWith(
        expect.stringContaining('Unique prescription text 12345'),
        expect.any(Object),
      );
    });
  });
});
