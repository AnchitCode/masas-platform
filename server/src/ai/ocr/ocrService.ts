/**
 * OCR Service (Phase 9.2a)
 *
 * Extracts text from prescription images using Tesseract.js.
 * Runs entirely locally — no cloud APIs, ₹0 cost.
 *
 * Design:
 *   - Single worker (M1 8 GB constraint)
 *   - Lazy initialization (no cold-start penalty on server boot)
 *   - 30-second timeout per OCR operation
 *   - In-memory only — no disk writes
 *   - Graceful shutdown on process exit
 *
 * Scope:
 *   - Printed prescriptions only (handwritten is out of scope)
 *   - English text only (Hindi Devanagari is out of scope)
 */

import { createWorker, type Worker } from 'tesseract.js';
import { aiConfig } from '../config.js';
import logger from '../../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface OCRResult {
  /** Extracted text from the image */
  text: string;
  /** OCR confidence score (0–100, higher = better) */
  confidence: number;
  /** Processing time in milliseconds */
  latencyMs: number;
  /** Error message if OCR failed */
  error?: string;
}

// ─── Worker Management ──────────────────────────────────────────

/** Singleton worker, lazily initialized */
let worker: Worker | null = null;
let workerInitializing = false;

/** OCR timeout in milliseconds */
const OCR_TIMEOUT_MS = 30_000;

/**
 * Get or create the Tesseract.js worker.
 * Thread-safe: concurrent calls wait for the same initialization.
 */
async function getWorker(): Promise<Worker> {
  if (worker) return worker;

  // Prevent multiple concurrent initializations
  if (workerInitializing) {
    // Poll until worker is ready (max 30s)
    const start = Date.now();
    while (workerInitializing && Date.now() - start < OCR_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (worker) return worker;
    throw new Error('OCR worker initialization timed out');
  }

  workerInitializing = true;
  try {
    logger.info('Initializing Tesseract.js OCR worker...');
    const start = Date.now();

    worker = await createWorker('eng');

    const elapsed = Date.now() - start;
    logger.info(`Tesseract.js OCR worker initialized in ${elapsed}ms`);

    return worker;
  } catch (err) {
    worker = null;
    throw err;
  } finally {
    workerInitializing = false;
  }
}

/**
 * Terminate the OCR worker. Called on process exit for cleanup.
 */
export async function terminateOCRWorker(): Promise<void> {
  if (worker) {
    try {
      await worker.terminate();
      logger.info('Tesseract.js OCR worker terminated');
    } catch {
      // Ignore termination errors during shutdown
    }
    worker = null;
  }
}

// Graceful shutdown
process.on('beforeExit', () => {
  void terminateOCRWorker();
});

// ─── Public API ─────────────────────────────────────────────────

/**
 * Extract text from an image buffer using Tesseract.js OCR.
 *
 * @param imageBuffer - The image data (JPEG, PNG, or WebP)
 * @returns OCRResult with extracted text, confidence, and latency
 *
 * The image buffer is NOT retained after this function returns.
 * It is used only for the duration of the OCR operation.
 */
export async function extractText(imageBuffer: Buffer): Promise<OCRResult> {
  // Check if AI is enabled
  if (!aiConfig.enabled) {
    logger.debug('OCR skipped: AI is disabled');
    return { text: '', confidence: 0, latencyMs: 0, error: 'AI is disabled' };
  }

  // Validate input
  if (!imageBuffer || imageBuffer.length === 0) {
    return { text: '', confidence: 0, latencyMs: 0, error: 'Empty image buffer' };
  }

  const start = Date.now();

  try {
    // Get or initialize the worker
    const w = await getWorker();

    // Run OCR with timeout
    const result = await Promise.race([
      w.recognize(imageBuffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS),
      ),
    ]);

    const latencyMs = Date.now() - start;
    const text = result.data.text.trim();
    const confidence = result.data.confidence;

    logger.debug('OCR complete', {
      textLength: text.length,
      confidence: Math.round(confidence),
      latencyMs,
    });

    return { text, confidence, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : 'Unknown OCR error';

    logger.error('OCR failed', { error: message, latencyMs });

    return { text: '', confidence: 0, latencyMs, error: message };
  }
}
