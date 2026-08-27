#!/usr/bin/env tsx
/**
 * Embedding Status Inspector (Phase 9.1c)
 *
 * A lightweight script that reports the current state of medicine embeddings
 * in the database. Does NOT modify anything — read-only queries.
 *
 * Usage: npx tsx scripts/embedding-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS — Embedding Status Inspector                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // 1. Total medicines
  const total = await prisma.medicineCatalog.count();
  console.log(`Total medicines in catalog: ${total}`);

  // 2. Medicines with embeddings
  const withResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "medicine_catalog" WHERE "embedding" IS NOT NULL`,
  );
  const withEmbedding = Number(withResult[0].count);

  // 3. Medicines without embeddings
  const withoutEmbedding = total - withEmbedding;

  console.log(`With embedding:    ${withEmbedding}`);
  console.log(`Without embedding: ${withoutEmbedding}`);
  console.log(`Coverage:          ${total > 0 ? ((withEmbedding / total) * 100).toFixed(1) : 0}%`);
  console.log();

  // 4. Verify dimensions
  if (withEmbedding > 0) {
    const dimResult = await prisma.$queryRawUnsafe<[{ dim: number }]>(
      `SELECT vector_dims("embedding") as dim FROM "medicine_catalog" WHERE "embedding" IS NOT NULL LIMIT 1`,
    );
    console.log(`Embedding dimensions: ${dimResult[0].dim}`);
  } else {
    console.log('Embedding dimensions: N/A (no embeddings yet)');
  }

  // 5. Stale embeddings (have embedding but no hash — legacy or pre-hash)
  const staleResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "medicine_catalog" WHERE "embedding" IS NOT NULL AND "embedding_hash" IS NULL`,
  );
  const stale = Number(staleResult[0].count);
  console.log(`Stale (no hash):   ${stale}`);
  console.log();

  // 6. Sample records
  console.log('━━━ Sample Records ━━━');
  const samples = await prisma.$queryRawUnsafe<
    Array<{
      name: string;
      generic_name: string | null;
      category: string | null;
      has_embedding: boolean;
      embedding_hash: string | null;
      dim: number | null;
    }>
  >(`
    SELECT
      name,
      generic_name,
      category,
      "embedding" IS NOT NULL as has_embedding,
      "embedding_hash",
      CASE WHEN "embedding" IS NOT NULL THEN vector_dims("embedding") ELSE NULL END as dim
    FROM "medicine_catalog"
    ORDER BY name
    LIMIT 10
  `);

  if (samples.length === 0) {
    console.log('  (no medicines in catalog)');
  } else {
    for (const s of samples) {
      const embStatus = s.has_embedding ? `✅ ${s.dim}d` : '❌ null';
      const hashStatus = s.embedding_hash ? s.embedding_hash.substring(0, 12) + '...' : 'null';
      console.log(`  ${s.name.padEnd(30)} | embed: ${embStatus.padEnd(10)} | hash: ${hashStatus}`);
      if (s.generic_name || s.category) {
        console.log(`  ${''.padEnd(30)} | generic: ${(s.generic_name || 'null').padEnd(20)} | cat: ${s.category || 'null'}`);
      }
    }
  }

  // 7. pgvector extension check
  console.log();
  console.log('━━━ Database Extensions ━━━');
  const extensions = await prisma.$queryRawUnsafe<Array<{ extname: string; extversion: string }>>(
    `SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'postgis') ORDER BY extname`,
  );
  for (const ext of extensions) {
    console.log(`  ✅ ${ext.extname} v${ext.extversion}`);
  }

  // 8. Index check
  console.log();
  console.log('━━━ Vector Index ━━━');
  const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'medicine_catalog' AND indexname LIKE '%embedding%'`,
  );
  for (const idx of indexes) {
    console.log(`  ✅ ${idx.indexname}`);
    console.log(`     ${idx.indexdef}`);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch(async (error) => {
  console.error('Error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
