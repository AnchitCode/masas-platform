#!/usr/bin/env tsx
/**
 * Embedding Backfill Runner (Phase 9.1c)
 *
 * Runs the embedding backfill pipeline against the real database
 * using the local Ollama embedding model.
 *
 * Usage: npx tsx scripts/run-backfill.ts
 *
 * Prerequisites:
 *   - Ollama running with nomic-embed-text
 *   - AI_ENABLED=true in environment
 */

import { PrismaClient } from '@prisma/client';

// Force AI enabled for this script
process.env.AI_ENABLED = 'true';

async function main() {
  // Dynamic import after setting env
  const { backfillEmbeddings, getEmbeddingStatus } = await import('../src/ai/embedding/index.js');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS — Embedding Backfill Runner                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // Status before
  console.log('━━━ Before Backfill ━━━');
  const before = await getEmbeddingStatus();
  console.log(`Total: ${before.total} | With: ${before.withEmbedding} | Without: ${before.withoutEmbedding}`);
  console.log();

  // Run backfill
  console.log('Running backfill...');
  const report = await backfillEmbeddings();
  console.log();
  console.log('━━━ Backfill Report ━━━');
  console.log(`Total processed: ${report.total}`);
  console.log(`Generated:       ${report.generated}`);
  console.log(`Skipped:         ${report.skipped}`);
  console.log(`Errors:          ${report.errors}`);
  console.log(`Duration:        ${report.durationMs}ms`);
  console.log();

  // Log individual results
  for (const r of report.results) {
    const icon = r.status === 'generated' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
    console.log(`  ${icon} ${r.medicineId}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
  }
  console.log();

  // Status after
  console.log('━━━ After Backfill ━━━');
  const after = await getEmbeddingStatus();
  console.log(`Total: ${after.total} | With: ${after.withEmbedding} | Without: ${after.withoutEmbedding}`);
  console.log(`Dimensions: ${after.dimensions}`);
  console.log(`Stale: ${after.stale}`);
  console.log();

  // Verify stored embeddings
  const prisma = new PrismaClient();
  const samples = await prisma.$queryRawUnsafe<
    Array<{ name: string; dim: number | null; hash: string | null }>
  >(`
    SELECT name, vector_dims("embedding") as dim, "embedding_hash" as hash
    FROM "medicine_catalog"
    WHERE "embedding" IS NOT NULL
    LIMIT 5
  `);

  if (samples.length > 0) {
    console.log('━━━ Stored Embeddings ━━━');
    for (const s of samples) {
      console.log(`  ✅ ${s.name.padEnd(25)} | ${s.dim}d | hash: ${s.hash?.substring(0, 16)}...`);
    }
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
