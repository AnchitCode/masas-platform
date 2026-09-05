#!/usr/bin/env tsx
/**
 * Semantic Search Evaluation Matrix
 *
 * Runs a comprehensive set of test queries against the CURRENT semantic search
 * implementation and reports detailed results. This is a diagnostic tool —
 * it does NOT change any code or data.
 *
 * Usage: npx tsx scripts/semantic-eval-matrix.ts
 *
 * Prerequisites:
 *   - Ollama running with nomic-embed-text
 *   - AI_ENABLED=true in environment
 *   - Embeddings already generated (run-backfill.ts)
 */

// Force AI enabled for this script
process.env.AI_ENABLED = 'true';

// ─── Test Query Matrix ────────────────────────────────────────────

interface TestQuery {
  query: string;
  category: string;
  expectedBehavior: string;
}

const TEST_QUERIES: TestQuery[] = [
  // ── Exact queries ──
  { query: 'paracetamol', category: 'EXACT', expectedBehavior: 'Exact match → Paracetamol' },
  { query: 'aspirin', category: 'EXACT', expectedBehavior: 'Exact match → Aspirin' },
  { query: 'vitamin d', category: 'EXACT', expectedBehavior: 'Exact match → Vitamin D' },

  // ── Typo queries ──
  { query: 'Paractemol', category: 'TYPO', expectedBehavior: 'Fuzzy → Paracetamol' },
  { query: 'paracetmol', category: 'TYPO', expectedBehavior: 'Fuzzy → Paracetamol' },
  { query: 'aspririn', category: 'TYPO', expectedBehavior: 'Fuzzy → Aspirin' },

  // ── Natural-language (Hinglish) queries ──
  { query: 'dard ki dawa', category: 'HINGLISH', expectedBehavior: 'Normalized → pain medicine → relevant results' },
  { query: 'sir dard ki medicine', category: 'HINGLISH', expectedBehavior: 'Normalized → headache medicine → relevant results' },
  { query: 'bukhar ki dawa', category: 'HINGLISH', expectedBehavior: 'Normalized → fever medicine → relevant results' },

  // ── English natural-language queries ──
  { query: 'pain medicine', category: 'NL_EN', expectedBehavior: 'Semantic → pain-related medicines' },
  { query: 'headache medicine', category: 'NL_EN', expectedBehavior: 'Semantic → headache-related medicines' },
  { query: 'fever medicine', category: 'NL_EN', expectedBehavior: 'Semantic → fever-related medicines' },

  // ── Generic / synonym queries ──
  { query: 'acetaminophen', category: 'GENERIC', expectedBehavior: 'Semantic → Paracetamol (genericName match)' },
  { query: 'pain relief tablet', category: 'GENERIC', expectedBehavior: 'Semantic → analgesic medicines' },
  { query: 'headache tablet', category: 'GENERIC', expectedBehavior: 'Semantic → headache-related medicines' },

  // ── Nonsense queries ──
  { query: 'zzzzqqqq9999medicineabc', category: 'NONSENSE', expectedBehavior: '❌ Should NOT return confident results' },
  { query: 'xyzmedicine12345', category: 'NONSENSE', expectedBehavior: '❌ Should NOT return confident results' },
  { query: 'qwertyuiop123', category: 'NONSENSE', expectedBehavior: '❌ Should NOT return confident results' },
  { query: 'asdfghjkl9999', category: 'NONSENSE', expectedBehavior: '❌ Should NOT return confident results' },
];

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const { findSemanticCandidates } = await import('../src/ai/search/index.js');
  const { normalizeQuery } = await import('../src/ai/search/queryNormalizer.js');
  const { _confidence, _config } = await import('../src/ai/search/semanticSearch.js');
  const prisma = (await import('../src/lib/prisma.js')).default;

  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS — Semantic Search Evaluation Matrix                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log();

  // ── First: show catalog info ──
  const catalogCount = await prisma.medicineCatalog.count();
  const embeddedCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "medicine_catalog" WHERE "embedding" IS NOT NULL`
  );
  console.log(`📦 Catalog: ${catalogCount} medicines, ${Number(embeddedCount[0].count)} with embeddings`);
  console.log();

  // ── List all catalog medicines for reference ──
  const allMeds = await prisma.medicineCatalog.findMany({
    select: { id: true, name: true, genericName: true, category: true },
    orderBy: { name: 'asc' },
  });
  console.log(`📋 Full catalog (${allMeds.length} medicines):`);
  for (const m of allMeds) {
    const generic = m.genericName ? ` (generic: ${m.genericName})` : '';
    const cat = m.category ? ` [${m.category}]` : '';
    console.log(`   • ${m.name}${generic}${cat}`);
  }
  console.log();

  // ── Catalog target check helper (mirrors search.service.ts logic) ──
  async function findCatalogTarget(query: string) {
    return prisma.medicineCatalog.findFirst({
      where: {
        OR: [
          { name: { equals: query, mode: 'insensitive' } },
          { genericName: { equals: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
  }

  // ── Run evaluation ──
  let currentCategory = '';

  interface ResultRow {
    category: string;
    query: string;
    normalizedQuery: string;
    catalogTarget: string | null;
    aiUsed: boolean;
    candidateCount: number;
    topResult: string | null;
    topScore: number | null;
    allScores: string;
    latencyMs: number;
    error?: string;
    expected: string;
  }

  const results: ResultRow[] = [];

  for (const test of TEST_QUERIES) {
    if (test.category !== currentCategory) {
      currentCategory = test.category;
      console.log(`\n${'═'.repeat(72)}`);
      console.log(`  ${currentCategory}`);
      console.log(`${'═'.repeat(72)}`);
    }

    const normalized = normalizeQuery(test.query);
    const catalogTarget = await findCatalogTarget(test.query);
    const result = await findSemanticCandidates(test.query);

    const row: ResultRow = {
      category: test.category,
      query: test.query,
      normalizedQuery: normalized,
      catalogTarget: catalogTarget?.name ?? null,
      aiUsed: result.aiUsed,
      candidateCount: result.candidates.length,
      topResult: result.candidates[0]?.name ?? null,
      topScore: result.candidates[0]?.score ?? null,
      allScores: result.candidates.map(c => c.score.toFixed(4)).join(', '),
      latencyMs: result.latencyMs,
      error: result.error,
      expected: test.expectedBehavior,
    };
    // ── Determine which confidence signal would fire ──
    const pharmaIntent = _confidence.hasPharmaceuticalIntent(test.query, normalized);
    const normChanged = normalized !== test.query.toLowerCase().trim();
    const hasPharmaTerms = normalized.split(/\s+/).some((t: string) => _config.KNOWN_PHARMA_TERMS.has(t));
    const highScore = (result.candidates.length > 0 || (row.topScore !== null && row.topScore >= _config.SEMANTIC_CONFIDENCE_THRESHOLD));

    let confidenceSignal = 'REJECTED';
    if (result.candidates.length > 0) {
      if (normChanged) confidenceSignal = 'normalization';
      else if (hasPharmaTerms) confidenceSignal = 'pharma-terms';
      else if (row.topScore !== null && row.topScore >= _config.SEMANTIC_CONFIDENCE_THRESHOLD) confidenceSignal = 'high-score';
      else confidenceSignal = 'unknown';
    }

    (row as any).confidenceSignal = confidenceSignal;
    results.push(row);

    // ── Console output ──
    console.log(`\n  ┌─ Query: "${test.query}"`);
    console.log(`  │  Expected: ${test.expectedBehavior}`);
    if (normalized !== test.query.toLowerCase().trim()) {
      console.log(`  │  Normalized: "${normalized}"`);
    }
    console.log(`  │  Catalog target: ${catalogTarget ? `✅ ${catalogTarget.name}` : '—'}`);
    console.log(`  │  AI used: ${result.aiUsed} | Latency: ${result.latencyMs}ms`);
    console.log(`  │  Candidates: ${result.candidates.length}`);

    if (result.candidates.length > 0) {
      for (let i = 0; i < result.candidates.length; i++) {
        const c = result.candidates[i]!;
        const generic = c.genericName ? ` (${c.genericName})` : '';
        const marker = i === 0 ? '→' : ' ';
        console.log(`  │  ${marker} ${i + 1}. ${c.name}${generic} — score: ${c.score.toFixed(4)}`);
      }
    } else {
      console.log(`  │  (no candidates)`);
    }

    // ── Confidence signal ──
    console.log(`  │  Confidence: ${(row as any).confidenceSignal}${pharmaIntent ? ' (pharma intent ✓)' : ''}`);

    if (result.error) {
      console.log(`  │  ⚠️ Error: ${result.error}`);
    }

    // ── Assessment ──
    if (test.category === 'NONSENSE' && result.candidates.length > 0) {
      console.log(`  │  🔴 FAIL: Nonsense query returned ${result.candidates.length} candidates (top: ${result.candidates[0]!.score.toFixed(4)})`);
    } else if (test.category === 'NONSENSE' && result.candidates.length === 0) {
      console.log(`  │  ✅ PASS: Nonsense query correctly returned no candidates`);
    } else if (test.category !== 'NONSENSE' && result.candidates.length > 0) {
      console.log(`  │  ✅ PASS: Legitimate query returned ${result.candidates.length} candidates`);
    } else if (test.category !== 'NONSENSE' && result.candidates.length === 0) {
      console.log(`  │  🔴 FAIL: Legitimate query returned no candidates`);
    }
    console.log(`  └${'─'.repeat(60)}`);
  }

  // ── Summary table ──
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       SUMMARY TABLE                                                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log();

  // Print as a formatted table
  const header = [
    'Category'.padEnd(10),
    'Query'.padEnd(28),
    'Normalized'.padEnd(22),
    'CatTarget'.padEnd(14),
    'AI',
    '#Cand',
    'TopResult'.padEnd(20),
    'TopScore',
    'AllScores',
  ].join(' │ ');

  console.log(header);
  console.log('─'.repeat(header.length));

  for (const r of results) {
    const line = [
      r.category.padEnd(10),
      r.query.substring(0, 28).padEnd(28),
      r.normalizedQuery.substring(0, 22).padEnd(22),
      (r.catalogTarget ?? '—').substring(0, 14).padEnd(14),
      r.aiUsed ? 'Y' : 'N',
      String(r.candidateCount).padStart(5),
      (r.topResult ?? '—').substring(0, 20).padEnd(20),
      r.topScore !== null ? r.topScore.toFixed(4) : '  —   ',
      r.allScores || '—',
    ].join(' │ ');
    console.log(line);
  }

  // ── Score distribution analysis ──
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       SCORE DISTRIBUTION ANALYSIS                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log();

  const validResults = results.filter(r => r.candidateCount > 0);
  const nonsenseResults = results.filter(r => r.category === 'NONSENSE');
  const legitimateResults = results.filter(r => r.category !== 'NONSENSE' && r.candidateCount > 0);

  console.log('── Legitimate queries (should match): ──');
  for (const r of legitimateResults) {
    console.log(`  ${r.query.padEnd(28)} → top score: ${r.topScore?.toFixed(4) ?? '—'}  (${r.allScores})`);
  }

  console.log('\n── Nonsense queries (should NOT match): ──');
  for (const r of nonsenseResults) {
    if (r.candidateCount > 0) {
      console.log(`  🔴 ${r.query.padEnd(28)} → top score: ${r.topScore?.toFixed(4) ?? '—'}  (${r.allScores})`);
    } else {
      console.log(`  ✅ ${r.query.padEnd(28)} → no candidates`);
    }
  }

  // ── Compute separation gap ──
  const nonsenseTopScores = nonsenseResults
    .filter(r => r.topScore !== null)
    .map(r => r.topScore!);
  const legitimateTopScores = legitimateResults
    .filter(r => r.topScore !== null)
    .map(r => r.topScore!);

  if (nonsenseTopScores.length > 0 && legitimateTopScores.length > 0) {
    const maxNonsense = Math.max(...nonsenseTopScores);
    const minLegitimate = Math.min(...legitimateTopScores);
    const avgNonsense = nonsenseTopScores.reduce((a, b) => a + b, 0) / nonsenseTopScores.length;
    const avgLegitimate = legitimateTopScores.reduce((a, b) => a + b, 0) / legitimateTopScores.length;

    console.log('\n── Score gap analysis: ──');
    console.log(`  Nonsense:   max=${maxNonsense.toFixed(4)}  avg=${avgNonsense.toFixed(4)}`);
    console.log(`  Legitimate: min=${minLegitimate.toFixed(4)}  avg=${avgLegitimate.toFixed(4)}`);
    console.log(`  Gap (min_legit - max_nonsense): ${(minLegitimate - maxNonsense).toFixed(4)}`);
    console.log(`  Gap (avg_legit - avg_nonsense):  ${(avgLegitimate - avgNonsense).toFixed(4)}`);

    if (maxNonsense >= minLegitimate) {
      console.log(`  🔴 OVERLAP: Nonsense max (${maxNonsense.toFixed(4)}) ≥ Legitimate min (${minLegitimate.toFixed(4)})`);
      console.log('     A simple threshold alone will NOT cleanly separate these.');
    } else {
      console.log(`  ✅ Separation exists: threshold between ${maxNonsense.toFixed(4)} and ${minLegitimate.toFixed(4)} would work.`);
      console.log(`     Recommended threshold: ${((maxNonsense + minLegitimate) / 2).toFixed(4)}`);
    }
  }

  // ── Current threshold info ──
  console.log('\n── Current configuration: ──');
  console.log(`  SIMILARITY_THRESHOLD: ${_config.SIMILARITY_THRESHOLD}`);
  console.log(`  SEMANTIC_CONFIDENCE_THRESHOLD: ${_config.SEMANTIC_CONFIDENCE_THRESHOLD}`);
  console.log(`  MAX_CANDIDATES: ${_config.MAX_CANDIDATES}`);
  console.log(`  KNOWN_PHARMA_TERMS: ${_config.KNOWN_PHARMA_TERMS.size} terms`);

  // ── Final verdict ──
  const nonsenseResults2 = results.filter(r => r.category === 'NONSENSE');
  const legitimateResults2 = results.filter(r => r.category !== 'NONSENSE');
  const nonsensePassed = nonsenseResults2.filter(r => r.candidateCount === 0).length;
  const legitimatePassed = legitimateResults2.filter(r => r.candidateCount > 0).length;

  console.log('\n── FINAL VERDICT: ──');
  console.log(`  Legitimate queries: ${legitimatePassed}/${legitimateResults2.length} PASS`);
  console.log(`  Nonsense queries:   ${nonsensePassed}/${nonsenseResults2.length} PASS`);
  if (legitimatePassed === legitimateResults2.length && nonsensePassed === nonsenseResults2.length) {
    console.log('  🎉 ALL TESTS PASSED');
  } else {
    console.log('  ❌ SOME TESTS FAILED');
  }

  // Disconnect
  await prisma.$disconnect();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
