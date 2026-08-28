/**
 * Prescription Controller (Phase 9.2d)
 *
 * Orchestrates the prescription scanning pipeline:
 *   1. Receive uploaded image
 *   2. OCR extraction (Tesseract.js)
 *   3. LLM medicine name extraction (phi3.5)
 *   4. Catalog matching (exact → fuzzy → semantic)
 *   5. Return results for user review
 *
 * Privacy: The image buffer is discarded after OCR. No image is ever
 * written to disk, stored in the database, or logged.
 *
 * The endpoint NEVER returns 500 for AI failures — it always returns 200
 * with degraded results and an appropriate error message.
 */

import type { Request, Response, NextFunction } from 'express';
import { extractText } from '../../ai/ocr/ocrService.js';
import { extractMedicineNames } from '../../ai/prescription/prescriptionExtractor.js';
import { matchCandidates } from '../../ai/prescription/catalogMatcher.js';
import type { MatchResult } from '../../ai/prescription/catalogMatcher.js';
import ApiError from '../../utils/apiError.js';
import logger from '../../utils/logger.js';

/**
 * POST /api/v1/prescription/extract
 *
 * Accepts a prescription image, extracts medicine names, and matches
 * them against the catalog.
 */
export const extractPrescription = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const totalStart = Date.now();

  try {
    // ── Validate uploaded file ──────────────────────────────
    const file = req.file;
    if (!file) {
      throw ApiError.badRequest('No prescription image uploaded. Use field name "prescription".');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw ApiError.badRequest('Uploaded file is empty.');
    }

    // ── Step 1: OCR ─────────────────────────────────────────
    const ocrResult = await extractText(file.buffer);

    // Discard the image buffer immediately after OCR
    // (The buffer is part of req.file which will be GC'd, but we null it explicitly)
    (file as { buffer: Buffer | null }).buffer = null;

    // If OCR produced no text, return early with helpful message
    if (!ocrResult.text && ocrResult.error) {
      res.status(200).json({
        success: true,
        message: 'Could not read the prescription',
        data: {
          ocrText: '',
          ocrConfidence: 0,
          candidates: [],
          meta: {
            ocrLatencyMs: ocrResult.latencyMs,
            llmLatencyMs: 0,
            matchLatencyMs: 0,
            totalLatencyMs: Date.now() - totalStart,
            aiUsed: false,
          },
          error: ocrResult.error,
        },
      });
      return;
    }

    // ── Step 2: LLM Extraction ──────────────────────────────
    const extractionResult = await extractMedicineNames(ocrResult.text);

    // ── Step 3: Catalog Matching ────────────────────────────
    const matchStart = Date.now();
    let matchResults: MatchResult[];

    if (extractionResult.candidates.length > 0) {
      const candidateNames = extractionResult.candidates.map((c) => c.name);
      matchResults = await matchCandidates(candidateNames);
    } else {
      matchResults = [];
    }
    const matchLatencyMs = Date.now() - matchStart;

    // ── Build Response ──────────────────────────────────────
    const totalLatencyMs = Date.now() - totalStart;
    const lowConfidence = ocrResult.confidence > 0 && ocrResult.confidence < 30;

    res.status(200).json({
      success: true,
      message: lowConfidence
        ? 'Low quality scan. Results may be inaccurate.'
        : 'Prescription processed',
      data: {
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        candidates: matchResults.map((mr) => ({
          extractedName: mr.extractedName,
          matches: mr.matches,
        })),
        meta: {
          ocrLatencyMs: ocrResult.latencyMs,
          llmLatencyMs: extractionResult.llmLatencyMs,
          matchLatencyMs,
          totalLatencyMs,
          aiUsed: extractionResult.aiUsed,
        },
        ...(extractionResult.error ? { error: extractionResult.error } : {}),
      },
    });
  } catch (err) {
    // Let ApiErrors (400, 401) pass through to the error handler
    if (err instanceof ApiError) {
      next(err);
      return;
    }

    // Any other error is unexpected — log it but return 200 with degraded results
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Prescription extraction unexpected error', { error: message });

    res.status(200).json({
      success: true,
      message: 'Could not process the prescription',
      data: {
        ocrText: '',
        ocrConfidence: 0,
        candidates: [],
        meta: {
          ocrLatencyMs: 0,
          llmLatencyMs: 0,
          matchLatencyMs: 0,
          totalLatencyMs: Date.now() - totalStart,
          aiUsed: false,
        },
        error: 'An unexpected error occurred. Please try again.',
      },
    });
  }
};
