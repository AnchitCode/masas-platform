/**
 * Embedding Generation Service (Phase 9.1c)
 *
 * Orchestrates embedding generation for MedicineCatalog records.
 *
 * Properties:
 *   - Idempotent: skips medicines that already have a valid, up-to-date embedding
 *   - Resumable: processes one medicine at a time, safe to interrupt and restart
 *   - Sequential: bounded for M1 8 GB — one embedding at a time
 *   - Safe to retry: errors skip the medicine, log, and continue
 *   - Non-destructive: never modifies name/genericName/category/dosageForm
 *
 * Stale Detection:
 *   Each medicine's embedding is paired with an `embeddingHash` — the SHA-256
 *   of the canonical text at generation time. When catalog fields change, the
 *   hash mismatches, and the medicine is re-embedded on the next backfill run.
 */

import prisma from '../../lib/prisma.js';
import logger from '../../utils/logger.js';
import { aiConfig } from '../config.js';
import { getEmbeddingProvider } from '../providers/index.js';
import { buildEmbeddingTextAndHash } from './embeddingText.js';
import type { EmbeddingTextInput } from './embeddingText.js';

// ─── Types ───────────────────────────────────────────────────────

export interface EmbeddingResult {
  medicineId: string;
  status: 'generated' | 'skipped' | 'error';
  error?: string;
}

export interface BackfillReport {
  total: number;
  generated: number;
  skipped: number;
  errors: number;
  durationMs: number;
  results: EmbeddingResult[];
}

export interface EmbeddingStatus {
  total: number;
  withEmbedding: number;
  withoutEmbedding: number;
  stale: number;
  dimensions: number | null;
}

// ─── Single Medicine Embedding ───────────────────────────────────

/**
 * Generate and store an embedding for a single medicine.
 *
 * Skips if:
 *   - AI is disabled
 *   - The medicine already has an embedding with a matching hash (up-to-date)
 *
 * @param medicineId - The medicine catalog ID
 * @returns EmbeddingResult with status
 */
export async function generateEmbeddingForMedicine(medicineId: string): Promise<EmbeddingResult> {
  if (!aiConfig.enabled) {
    return { medicineId, status: 'skipped', error: 'AI is disabled' };
  }

  try {
    // 1. Fetch the medicine
    const medicine = await prisma.medicineCatalog.findUnique({
      where: { id: medicineId },
      select: { id: true, name: true, genericName: true, category: true, dosageForm: true, embeddingHash: true },
    });

    if (!medicine) {
      return { medicineId, status: 'error', error: 'Medicine not found' };
    }

    // 2. Build canonical text and hash
    const input: EmbeddingTextInput = {
      name: medicine.name,
      genericName: medicine.genericName,
      category: medicine.category,
      dosageForm: medicine.dosageForm,
    };
    const { text, hash } = buildEmbeddingTextAndHash(input);

    // 3. Skip if embedding is already up-to-date
    if (medicine.embeddingHash === hash) {
      return { medicineId, status: 'skipped' };
    }

    // 4. Generate embedding via the provider
    const provider = getEmbeddingProvider(aiConfig);
    const vector = await provider.embed(text);

    // 5. Validate dimensions
    if (vector.length !== aiConfig.embeddingDimensions) {
      return {
        medicineId,
        status: 'error',
        error: `Dimension mismatch: got ${vector.length}, expected ${aiConfig.embeddingDimensions}`,
      };
    }

    // 6. Store embedding + hash via raw SQL (Prisma doesn't support vector type natively)
    const vectorStr = `[${vector.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE "medicine_catalog" SET "embedding" = $1::vector, "embedding_hash" = $2 WHERE "id" = $3`,
      vectorStr,
      hash,
      medicineId,
    );

    logger.debug(`Embedding generated for medicine ${medicineId}`, { name: medicine.name });
    return { medicineId, status: 'generated' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Embedding generation failed for medicine ${medicineId}`, { error: message });
    return { medicineId, status: 'error', error: message };
  }
}

// ─── Backfill Pipeline ───────────────────────────────────────────

/**
 * Backfill embeddings for all medicines that need them.
 *
 * "Need" means:
 *   - embedding IS NULL (never generated), OR
 *   - embeddingHash doesn't match the current canonical text hash (stale)
 *
 * Processes medicines sequentially, one at a time, to stay within
 * M1 8 GB memory bounds. Each medicine is independent — errors skip
 * that medicine and continue.
 *
 * @param batchSize - How many medicines to process per run. Default: all.
 * @returns BackfillReport with counts and per-medicine results
 */
export async function backfillEmbeddings(batchSize?: number): Promise<BackfillReport> {
  const startTime = Date.now();
  const results: EmbeddingResult[] = [];
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  if (!aiConfig.enabled) {
    logger.warn('Embedding backfill skipped: AI is disabled');
    return { total: 0, generated: 0, skipped: 0, errors: 0, durationMs: 0, results: [] };
  }

  // Fetch all medicines (only the fields we need)
  const medicines = await prisma.medicineCatalog.findMany({
    select: {
      id: true,
      name: true,
      genericName: true,
      category: true,
      dosageForm: true,
      embeddingHash: true,
    },
    orderBy: { name: 'asc' },
    ...(batchSize ? { take: batchSize } : {}),
  });

  const total = medicines.length;
  logger.info(`Embedding backfill started: ${total} medicines to check`);

  // Check provider availability once before starting
  const provider = getEmbeddingProvider(aiConfig);
  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    logger.error('Embedding backfill aborted: embedding provider is not available');
    return { total, generated: 0, skipped: 0, errors: total, durationMs: Date.now() - startTime, results: [] };
  }

  for (const medicine of medicines) {
    // Build canonical text and check if embedding is already current
    const input: EmbeddingTextInput = {
      name: medicine.name,
      genericName: medicine.genericName,
      category: medicine.category,
      dosageForm: medicine.dosageForm,
    };
    const { text, hash } = buildEmbeddingTextAndHash(input);

    // Skip if already up-to-date
    if (medicine.embeddingHash === hash) {
      results.push({ medicineId: medicine.id, status: 'skipped' });
      skipped++;
      continue;
    }

    // Generate embedding
    try {
      const vector = await provider.embed(text);

      if (vector.length !== aiConfig.embeddingDimensions) {
        results.push({
          medicineId: medicine.id,
          status: 'error',
          error: `Dimension mismatch: ${vector.length} vs ${aiConfig.embeddingDimensions}`,
        });
        errors++;
        continue;
      }

      const vectorStr = `[${vector.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "medicine_catalog" SET "embedding" = $1::vector, "embedding_hash" = $2 WHERE "id" = $3`,
        vectorStr,
        hash,
        medicine.id,
      );

      results.push({ medicineId: medicine.id, status: 'generated' });
      generated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Backfill embedding failed for ${medicine.name}`, { error: message });
      results.push({ medicineId: medicine.id, status: 'error', error: message });
      errors++;
    }
  }

  const durationMs = Date.now() - startTime;
  logger.info(`Embedding backfill complete: ${generated} generated, ${skipped} skipped, ${errors} errors in ${durationMs}ms`);

  return { total, generated, skipped, errors, durationMs, results };
}

// ─── Embedding Status ────────────────────────────────────────────

/**
 * Get the current embedding status for the medicine catalog.
 * Non-destructive read-only query.
 */
export async function getEmbeddingStatus(): Promise<EmbeddingStatus> {
  const total = await prisma.medicineCatalog.count();

  // Count medicines with non-null embedding via raw SQL (Prisma can't query Unsupported fields)
  const withResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "medicine_catalog" WHERE "embedding" IS NOT NULL`,
  );
  const withEmbedding = Number(withResult[0].count);

  // Count stale embeddings (hash mismatch or missing hash but has embedding)
  // We need to check each medicine's current hash vs stored hash
  // For efficiency, we just count those without embedding or without hash
  const withoutEmbedding = total - withEmbedding;

  // Sample dimensions from first medicine with an embedding
  let dimensions: number | null = null;
  const dimResult = await prisma.$queryRawUnsafe<[{ dim: number }] | []>(
    `SELECT vector_dims("embedding") as dim FROM "medicine_catalog" WHERE "embedding" IS NOT NULL LIMIT 1`,
  );
  if (dimResult.length > 0 && dimResult[0]) {
    dimensions = dimResult[0].dim;
  }

  // Count stale: has embedding but hash is null or doesn't match current
  // For a full stale count, we'd need to recompute all hashes in JS.
  // Instead, count medicines where embeddingHash is null but embedding is not
  const staleResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "medicine_catalog" WHERE "embedding" IS NOT NULL AND "embedding_hash" IS NULL`,
  );
  const stale = Number(staleResult[0].count);

  return { total, withEmbedding, withoutEmbedding, stale, dimensions };
}
