#!/usr/bin/env tsx
/**
 * Semantic Search Live Demo (Phase 9.1d)
 *
 * Tests the semantic search pipeline against the real production catalog
 * using the actual Ollama embedding model.
 *
 * Usage: npx tsx scripts/semantic-search-demo.ts
 *
 * Prerequisites:
 *   - Ollama running with nomic-embed-text
 *   - AI_ENABLED=true in environment
 *   - Embeddings already generated (run-backfill.ts)
 */

// Force AI enabled
process.env.AI_ENABLED = 'true';

async function main() {
  const { findSemanticCandidates } = await import('../src/ai/search/index.js');
  const { normalizeQuery } = await import('../src/ai/search/queryNormalizer.js');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS — Semantic Search Live Demo                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  const testQueries = [
    // English
    { query: 'headache medicine', type: 'English' },
    { query: 'pain relief tablet', type: 'English' },
    { query: 'fever medicine', type: 'English' },

    // Hinglish
    { query: 'dard ki dawa', type: 'Hinglish' },
    { query: 'sir dard ki medicine', type: 'Hinglish' },
    { query: 'bukhar ki dawa', type: 'Hinglish' },

    // Terminology/Typo
    { query: 'Paractemol', type: 'Typo' },
    { query: 'acetaminophen', type: 'Generic' },

    // Brand names
    { query: 'aspirin', type: 'Brand' },
    { query: 'vitamin supplement', type: 'Concept' },
  ];

  for (const { query, type } of testQueries) {
    const normalized = normalizeQuery(query);
    const result = await findSemanticCandidates(query);

    console.log(`━━━ [${type}] "${query}" ━━━`);
    if (normalized !== query.toLowerCase().trim()) {
      console.log(`  Normalized: "${normalized}"`);
    }
    console.log(`  AI Used: ${result.aiUsed} | Latency: ${result.latencyMs}ms`);

    if (result.candidates.length === 0) {
      console.log('  No candidates found');
    } else {
      const top3 = result.candidates.slice(0, 3);
      for (let i = 0; i < top3.length; i++) {
        const c = top3[i]!;
        const generic = c.genericName ? ` (${c.genericName})` : '';
        console.log(`  ${i + 1}. ${c.name}${generic} — score: ${c.score.toFixed(4)}`);
      }
    }

    if (result.error) {
      console.log(`  ⚠️ Error: ${result.error}`);
    }
    console.log();
  }

  // Disconnect Prisma
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();
  await p.$disconnect();

  console.log('Done.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
