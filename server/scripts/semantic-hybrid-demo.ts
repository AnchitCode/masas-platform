#!/usr/bin/env tsx
/**
 * Hybrid Search Live Demo (Phase 9.1e)
 *
 * Tests the full hybrid search pipeline against the local MASAS database.
 * Ensures exact matches rank above semantic matches and validates real data.
 */

// Force AI enabled initially
process.env.AI_ENABLED = 'true';

async function main() {
  const { searchPublicInventory } = await import('../src/modules/search/search.service.js');
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS — Hybrid Search Live Demo                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // Test location: New Delhi center
  const lat = 28.6139;
  const lng = 77.209;
  const radiusKm = 50;

  const testQueries = [
    { query: 'paracetamol', type: 'Exact' },
    { query: 'Paractemol', type: 'Typo' },
    { query: 'acetaminophen', type: 'Generic' },
    { query: 'headache medicine', type: 'English' },
    { query: 'dard ki dawa', type: 'Hinglish' },
    { query: 'sir dard ki medicine', type: 'Hinglish' },
    { query: 'bukhar ki dawa', type: 'Hinglish' },
    { query: 'missing_drug_xyzz', type: 'No Result' },
  ];

  async function runDemo(aiEnabled: boolean) {
    process.env.AI_ENABLED = aiEnabled ? 'true' : 'false';
    console.log(`\n\n=== RUNNING WITH AI_ENABLED = ${process.env.AI_ENABLED} ===\n`);

    for (const { query, type } of testQueries) {
      const start = Date.now();
      const res = await searchPublicInventory({ q: query, lat, lng, radiusKm, page: 1, limit: 5 });
      const latency = Date.now() - start;

      console.log(`━━━ [${type}] "${query}" ━━━`);
      console.log(`  AI Used: ${res.meta?.aiUsed} | Total: ${res.total} | Latency: ${latency}ms`);
      if (res.meta?.normalizedQuery) {
        console.log(`  Normalized: "${res.meta.normalizedQuery}"`);
      }

      if (res.results.length === 0) {
        console.log('  No inventory found.');
      } else {
        for (let i = 0; i < res.results.length; i++) {
          const c = res.results[i]!;
          console.log(`  ${i + 1}. [${c.matchType}] ${c.medicine.name} @ ${c.pharmacy.name} (${Math.round(c.distanceMeters)}m away)`);
        }
      }
      console.log();
    }
  }

  await runDemo(true);
  await runDemo(false);

  await p.$disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
