#!/usr/bin/env tsx
/**
 * Phase 9.1 — Final End-to-End Verification (9.1g)
 *
 * Exercises the COMPLETE pipeline:
 *   Search query → Hinglish normalization → Ollama embedding
 *   → pgvector cosine search → hybrid SQL ranking → PostGIS filtering
 *   → verified pharmacy filtering → availability check → pagination
 *
 * Runs with AI_ENABLED=true (real Ollama) and AI_ENABLED=false (keyword only).
 */

process.env.AI_ENABLED = 'true';

interface VerificationResult {
  query: string;
  type: string;
  aiEnabled: boolean;
  aiUsed: boolean;
  normalizedQuery?: string;
  total: number;
  latencyMs: number;
  topResults: Array<{
    name: string;
    matchType: string;
    distanceM: number;
    price: number;
    qty: number;
  }>;
  meta?: Record<string, unknown>;
  error?: string;
}

async function main() {
  const { searchPublicInventory } = await import('../src/modules/search/search.service.js');
  const { normalizeQuery } = await import('../src/ai/search/queryNormalizer.js');
  const { findSemanticCandidates } = await import('../src/ai/search/semanticSearch.js');
  const { PrismaClient } = await import('@prisma/client');
  const p = new PrismaClient();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   Phase 9.1 — Final E2E Verification Report                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ─── 1. Verify Ollama is running ──────────────────────────────
  console.log('─── 1. Ollama Status ───');
  let ollamaAvailable = false;
  try {
    const resp = await fetch('http://localhost:11434/api/tags');
    if (resp.ok) {
      const data = await resp.json() as any;
      const models = data.models?.map((m: any) => m.name) ?? [];
      console.log(`  ✅ Ollama is running. Models: ${models.join(', ')}`);
      ollamaAvailable = true;
    }
  } catch {
    console.log('  ⚠️  Ollama is NOT running.');
  }

  // ─── 2. Verify no paid APIs ───────────────────────────────────
  console.log('\n─── 2. Paid API Check ───');
  const envVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_KEY', 'COHERE_API_KEY'];
  let paidApiFound = false;
  for (const key of envVars) {
    if (process.env[key]) {
      console.log(`  ❌ ${key} is set — potential paid API usage!`);
      paidApiFound = true;
    }
  }
  if (!paidApiFound) console.log('  ✅ No paid API keys detected. ₹0 constraint honored.');

  // ─── 3. Hinglish Normalization Verification ───────────────────
  console.log('\n─── 3. Hinglish Normalization ───');
  const normTests = [
    ['dard ki dawa', 'pain medicine'],
    ['sir dard ki medicine', 'headache medicine'],
    ['bukhar ki dawa', 'fever medicine'],
    ['pet dard ki tablet', 'stomach pain tablet'],
    ['paracetamol', 'paracetamol'],
    ['headache medicine', 'headache medicine'],
  ];
  let normPass = 0;
  for (const [input, expected] of normTests) {
    const result = normalizeQuery(input!);
    const ok = result === expected;
    console.log(`  ${ok ? '✅' : '❌'} "${input}" → "${result}" ${ok ? '' : `(expected: "${expected}")`}`);
    if (ok) normPass++;
  }
  console.log(`  ${normPass}/${normTests.length} normalization checks passed.`);

  // ─── 4. Semantic Candidate Search (isolated) ──────────────────
  console.log('\n─── 4. Semantic Candidate Search (pgvector) ───');
  if (ollamaAvailable) {
    const semTests = ['pain medicine', 'headache medicine', 'fever medicine', 'paracetamol'];
    for (const q of semTests) {
      const start = Date.now();
      const res = await findSemanticCandidates(q, 5);
      const ms = Date.now() - start;
      const topName = res.candidates[0]?.name ?? '(none)';
      const topScore = res.candidates[0]?.score?.toFixed(4) ?? 'N/A';
      console.log(`  "${q}" → ${res.candidates.length} candidates, top: ${topName} (${topScore}), ${ms}ms`);
    }
  } else {
    console.log('  ⏭️  Skipped — Ollama unavailable');
  }

  // ─── 5. Full Hybrid Search (AI enabled + disabled) ────────────
  const lat = 28.6139;
  const lng = 77.209;
  const radiusKm = 50;

  const testQueries = [
    { query: 'paracetamol', type: 'Exact name' },
    { query: 'Paractemol', type: 'Typo' },
    { query: 'acetaminophen', type: 'Generic name' },
    { query: 'headache medicine', type: 'English concept' },
    { query: 'pain relief tablet', type: 'English concept' },
    { query: 'dard ki dawa', type: 'Hinglish' },
    { query: 'sir dard ki medicine', type: 'Hinglish' },
    { query: 'bukhar ki dawa', type: 'Hinglish' },
    { query: 'zzz_no_match_xyz_000', type: 'No result' },
    { query: 'paracetamol', type: 'Radius test' },  // will use small radius
  ];

  for (const aiEnabled of [true, false]) {
    process.env.AI_ENABLED = aiEnabled ? 'true' : 'false';
    console.log(`\n─── 5${aiEnabled ? 'a' : 'b'}. Hybrid Search (AI_ENABLED=${aiEnabled}) ───`);

    for (const { query, type } of testQueries) {
      const isRadiusTest = type === 'Radius test';
      const r = isRadiusTest ? 0.001 : radiusKm; // 1 meter for radius test
      const start = Date.now();
      try {
        const res = await searchPublicInventory({
          q: query, lat, lng, radiusKm: r, page: 1, limit: 5,
        });
        const ms = Date.now() - start;

        const topResults = (res.results || []).slice(0, 3).map((row: any) => ({
          name: row.medicine?.name,
          matchType: row.matchType,
          distanceM: Math.round(row.distanceMeters),
          price: row.inventory?.price,
          qty: row.inventory?.quantity,
        }));

        console.log(`  [${type}] "${query}" → ${res.total} results, ${ms}ms, AI: ${res.meta?.aiUsed ?? 'N/A'}`);
        if (res.meta?.normalizedQuery) {
          console.log(`    Normalized: "${res.meta.normalizedQuery}"`);
        }
        for (const r of topResults) {
          console.log(`    ${r.matchType?.padEnd(8)} ${r.name} (${r.distanceM}m, ₹${r.price}, qty:${r.qty})`);
        }

        // ─── Verification assertions ─────────────────────
        if (type === 'No result') {
          if (res.total !== 0) console.log(`    ⚠️  Expected 0 results for junk query, got ${res.total}`);
          else console.log('    ✅ Correctly returned 0 results.');
        }
        if (type === 'Radius test' && isRadiusTest) {
          if (res.total === 0) console.log('    ✅ Radius filtering working (0.001km = no results).');
          else console.log(`    ⚠️  Expected 0 results for tiny radius, got ${res.total}`);
        }

        // Check no embedding vectors leaked
        for (const row of (res.results || [])) {
          if ((row as any).embedding || (row.medicine as any)?.embedding) {
            console.log('    ❌ EMBEDDING VECTOR LEAKED in API response!');
          }
        }
      } catch (err: any) {
        console.log(`  [${type}] "${query}" → ERROR: ${err.message} (${Date.now() - start}ms)`);
      }
    }
  }

  // ─── 6. Pagination Verification ───────────────────────────────
  console.log('\n─── 6. Pagination ───');
  process.env.AI_ENABLED = 'false'; // Use keyword for determinism
  try {
    const page1 = await searchPublicInventory({ q: '%', lat, lng, radiusKm, page: 1, limit: 2 });
    const page2 = await searchPublicInventory({ q: '%', lat, lng, radiusKm, page: 2, limit: 2 });
    console.log(`  Page 1: ${page1.results.length} results (total: ${page1.total})`);
    console.log(`  Page 2: ${page2.results.length} results (total: ${page2.total})`);
    if (page1.total === page2.total) console.log('  ✅ Total count consistent across pages.');
    else console.log('  ⚠️  Total count mismatch between pages!');
  } catch (err: any) {
    console.log(`  ⚠️  Pagination test error: ${err.message}`);
  }

  // ─── 7. Memory/Performance Summary ────────────────────────────
  console.log('\n─── 7. Performance Summary ───');
  const mem = process.memoryUsage();
  console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);

  await p.$disconnect();
  console.log('\n═══ Verification Complete ═══\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
