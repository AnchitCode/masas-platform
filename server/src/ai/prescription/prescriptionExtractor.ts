/**
 * Prescription Extractor (Phase 9.2b)
 *
 * Given raw OCR text from a prescription image, uses the local LLM (phi3.5)
 * to extract candidate medicine names.
 *
 * IMPORTANT:
 *   - LLM output is ALWAYS untrusted and validated with Zod before use.
 *   - The extractor does NOT provide medical advice, corrections, or substitutions.
 *   - It produces candidate names that must be verified by the user.
 *   - It does NOT extract dosage, frequency, or diagnosis.
 */

import { z } from 'zod';
import { aiConfig } from '../config.js';
import { getLLMProvider } from '../providers/index.js';
import type { LLMProvider } from '../types.js';
import logger from '../../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface ExtractedCandidate {
  /** Normalized medicine name (trimmed, title-cased) */
  name: string;
  /** Raw string as returned by the LLM */
  raw: string;
}

export interface ExtractionResult {
  /** Extracted medicine name candidates */
  candidates: ExtractedCandidate[];
  /** LLM processing time in milliseconds */
  llmLatencyMs: number;
  /** Whether the LLM was actually used */
  aiUsed: boolean;
  /** Error message if extraction failed */
  error?: string;
}

// ─── Zod Schema for LLM Output Validation ───────────────────────

/**
 * Schema that the LLM JSON output must match.
 * Any response that doesn't match is treated as a failure.
 */
const ExtractionSchema = z.object({
  medicines: z
    .array(
      z.string().min(1).max(100),
    )
    .max(20),
});

// ─── Prompt ─────────────────────────────────────────────────────

/**
 * Build the extraction prompt for the LLM.
 * Carefully constrained to prevent medical advice.
 */
function buildExtractionPrompt(ocrText: string): string {
  return `You are a medicine name extractor. Given the following text from an OCR scan of a medical prescription, extract ONLY the medicine/drug names.

Rules:
- Return ONLY medicine names, nothing else
- Do NOT include dosage amounts (e.g., 500mg, 10ml)
- Do NOT include frequency (e.g., twice daily, BD, TDS)
- Do NOT include diagnosis or symptoms
- Do NOT interpret, correct, or substitute medicine names
- Do NOT provide medical advice
- Preserve the medicine name spelling exactly as it appears
- If you cannot identify any medicine names, return an empty array
- Return valid JSON only

Return format: { "medicines": ["name1", "name2", ...] }

OCR Text:
---
${ocrText}
---`;
}

// ─── LLM Provider (lazy singleton) ──────────────────────────────

let llmProvider: LLMProvider | null = null;

function getLLM(): LLMProvider {
  if (!llmProvider) {
    llmProvider = getLLMProvider(aiConfig);
  }
  return llmProvider;
}

// ─── Normalization ──────────────────────────────────────────────

/**
 * Normalize a medicine name: trim whitespace, collapse spaces.
 * Does NOT correct spelling — that's the user's job.
 */
function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Extract medicine name candidates from OCR text using the local LLM.
 *
 * @param ocrText - Raw text extracted from a prescription image by OCR
 * @returns ExtractionResult with candidate medicine names
 *
 * The function NEVER throws. On any failure it returns an empty candidates
 * array with an error message.
 */
export async function extractMedicineNames(ocrText: string): Promise<ExtractionResult> {
  // Guard: AI disabled
  if (!aiConfig.enabled) {
    return { candidates: [], llmLatencyMs: 0, aiUsed: false, error: 'AI is disabled' };
  }

  // Guard: empty or very short OCR text (nothing to extract)
  const trimmed = ocrText.trim();
  if (trimmed.length < 3) {
    return { candidates: [], llmLatencyMs: 0, aiUsed: false, error: 'OCR text too short' };
  }

  const start = Date.now();

  try {
    const llm = getLLM();

    // Check LLM availability
    const available = await llm.isAvailable();
    if (!available) {
      return { candidates: [], llmLatencyMs: Date.now() - start, aiUsed: false, error: 'LLM unavailable' };
    }

    // Call the LLM with deterministic temperature
    const prompt = buildExtractionPrompt(trimmed);
    const rawResponse = await llm.generateJSON<unknown>(prompt, {
      temperature: 0.0,
      maxTokens: 500,
      timeout: 30_000,
    });

    const llmLatencyMs = Date.now() - start;

    // Validate with Zod
    const parsed = ExtractionSchema.safeParse(rawResponse);
    if (!parsed.success) {
      logger.warn('LLM extraction output failed Zod validation', {
        error: parsed.error.message,
        llmLatencyMs,
      });
      return { candidates: [], llmLatencyMs, aiUsed: true, error: 'LLM output invalid' };
    }

    // Map to ExtractedCandidate objects
    const candidates: ExtractedCandidate[] = parsed.data.medicines
      .map((raw) => ({
        name: normalizeName(raw),
        raw,
      }))
      .filter((c) => c.name.length > 0);

    // Deduplicate by normalized name (case-insensitive)
    const seen = new Set<string>();
    const deduplicated = candidates.filter((c) => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    logger.debug('LLM extraction complete', {
      candidateCount: deduplicated.length,
      llmLatencyMs,
    });

    return { candidates: deduplicated, llmLatencyMs, aiUsed: true };
  } catch (err) {
    const llmLatencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown extraction error';

    logger.error('LLM extraction failed', { error: message, llmLatencyMs });

    return { candidates: [], llmLatencyMs, aiUsed: false, error: message };
  }
}
