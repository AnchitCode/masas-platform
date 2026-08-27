#!/usr/bin/env tsx
/**
 * MASAS Phase 9.1a — Embedding Model Comparison
 *
 * Head-to-head comparison:
 *   nomic-embed-text (v1.5)  vs  nomic-embed-text-v2-moe
 *
 * Tests English, Hinglish (Latin script), and terminology/typo queries
 * against the same MASAS medicine catalog.
 *
 * Usage: npx tsx scripts/ai-model-comparison.ts
 *
 * Prerequisites:
 *   - Ollama running
 *   - Both models pulled: `ollama pull nomic-embed-text` and `ollama pull nomic-embed-text-v2-moe`
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

const MODELS = [
  'nomic-embed-text',
  'nomic-embed-text-v2-moe',
] as const;

// ─── Medicine Catalog ───────────────────────────────────────────

const MEDICINE_CATALOG = [
  { name: 'paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic/Antipyretic', dosageForm: 'Tablet' },
  { name: 'ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Analgesic/NSAID', dosageForm: 'Tablet' },
  { name: 'amoxicillin 500mg', genericName: 'Amoxicillin', category: 'Antibiotic', dosageForm: 'Capsule' },
  { name: 'cetirizine 10mg', genericName: 'Cetirizine', category: 'Antihistamine', dosageForm: 'Tablet' },
  { name: 'omeprazole 20mg', genericName: 'Omeprazole', category: 'Antacid/PPI', dosageForm: 'Capsule' },
  { name: 'metformin 500mg', genericName: 'Metformin', category: 'Antidiabetic', dosageForm: 'Tablet' },
  { name: 'azithromycin 500mg', genericName: 'Azithromycin', category: 'Antibiotic', dosageForm: 'Tablet' },
  { name: 'dicyclomine 20mg', genericName: 'Dicyclomine', category: 'Antispasmodic', dosageForm: 'Tablet' },
  { name: 'pantoprazole 40mg', genericName: 'Pantoprazole', category: 'Antacid/PPI', dosageForm: 'Tablet' },
  { name: 'dolo 650', genericName: 'Paracetamol', category: 'Analgesic/Antipyretic', dosageForm: 'Tablet' },
  { name: 'crocin advance', genericName: 'Paracetamol', category: 'Analgesic/Antipyretic', dosageForm: 'Tablet' },
  { name: 'combiflam', genericName: 'Ibuprofen + Paracetamol', category: 'Analgesic', dosageForm: 'Tablet' },
  { name: 'disprin', genericName: 'Aspirin', category: 'Analgesic/NSAID', dosageForm: 'Tablet' },
  { name: 'rantac 150', genericName: 'Ranitidine', category: 'Antacid/H2 blocker', dosageForm: 'Tablet' },
  { name: 'allegra 120mg', genericName: 'Fexofenadine', category: 'Antihistamine', dosageForm: 'Tablet' },
];

function buildEmbeddingText(med: typeof MEDICINE_CATALOG[0]): string {
  const parts = [med.name];
  if (med.genericName) parts.push(`Generic: ${med.genericName}`);
  if (med.category) parts.push(`Category: ${med.category}`);
  if (med.dosageForm) parts.push(`Form: ${med.dosageForm}`);
  return parts.join('. ');
}

// ─── Test Queries ───────────────────────────────────────────────

interface TestQuery {
  query: string;
  group: 'english' | 'hinglish' | 'terminology';
  expectedTop3: string[]; // medicine names expected in top 3
}

const TEST_QUERIES: TestQuery[] = [
  // English
  { query: 'headache medicine', group: 'english', expectedTop3: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650', 'crocin advance', 'combiflam'] },
  { query: 'pain relief tablet', group: 'english', expectedTop3: ['paracetamol 500mg', 'ibuprofen 400mg', 'combiflam', 'dolo 650', 'disprin'] },
  { query: 'fever medicine', group: 'english', expectedTop3: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650', 'crocin advance'] },
  { query: 'allergy medicine', group: 'english', expectedTop3: ['cetirizine 10mg', 'allegra 120mg'] },
  { query: 'antibiotic', group: 'english', expectedTop3: ['amoxicillin 500mg', 'azithromycin 500mg'] },
  { query: 'stomach acid tablet', group: 'english', expectedTop3: ['omeprazole 20mg', 'pantoprazole 40mg', 'rantac 150'] },

  // Hinglish (Latin script)
  { query: 'dard ki dawa', group: 'hinglish', expectedTop3: ['paracetamol 500mg', 'ibuprofen 400mg', 'combiflam', 'dolo 650', 'disprin'] },
  { query: 'sir dard ki medicine', group: 'hinglish', expectedTop3: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650', 'crocin advance', 'combiflam'] },
  { query: 'bukhar ki dawa', group: 'hinglish', expectedTop3: ['paracetamol 500mg', 'dolo 650', 'crocin advance', 'ibuprofen 400mg'] },
  { query: 'pet dard ki tablet', group: 'hinglish', expectedTop3: ['dicyclomine 20mg', 'omeprazole 20mg', 'pantoprazole 40mg', 'rantac 150'] },
  { query: 'allergy ki medicine', group: 'hinglish', expectedTop3: ['cetirizine 10mg', 'allegra 120mg'] },
  { query: 'infection ki dawa', group: 'hinglish', expectedTop3: ['amoxicillin 500mg', 'azithromycin 500mg'] },

  // Terminology / Typo
  { query: 'Paractemol', group: 'terminology', expectedTop3: ['paracetamol 500mg', 'dolo 650', 'crocin advance', 'combiflam'] },
  { query: 'acetaminophen', group: 'terminology', expectedTop3: ['paracetamol 500mg', 'dolo 650', 'crocin advance'] },
];

// ─── Helpers ────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(model: string, text: string): Promise<{ embedding: number[]; durationMs: number }> {
  const start = Date.now();
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Embedding failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { embedding: number[] };
  return { embedding: data.embedding, durationMs: Date.now() - start };
}

function formatDur(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ─── Per-Model Benchmark ────────────────────────────────────────

interface QueryResult {
  query: string;
  group: string;
  top3: { name: string; similarity: number }[];
  hitInTop3: boolean;
  latencyMs: number;
}

interface ModelReport {
  model: string;
  dimensions: number;
  catalogEmbedTimeMs: number;
  coldStartMs: number;
  results: QueryResult[];
  englishHits: number;
  englishTotal: number;
  hinglishHits: number;
  hinglishTotal: number;
  terminologyHits: number;
  terminologyTotal: number;
  avgLatencyMs: number;
}

async function benchmarkModel(model: string): Promise<ModelReport> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  MODEL: ${model}`);
  console.log(`${'═'.repeat(60)}\n`);

  // 1. Cold-start: first embedding call loads the model
  console.log('Cold-starting model (first embedding call)...');
  const coldStart = Date.now();
  const firstEmbed = await getEmbedding(model, 'test');
  const coldStartMs = Date.now() - coldStart;
  const dimensions = firstEmbed.embedding.length;
  console.log(`✅ Cold start: ${formatDur(coldStartMs)} | Dimensions: ${dimensions}\n`);

  // 2. Generate catalog embeddings
  console.log('Generating catalog embeddings...');
  const catalogStart = Date.now();
  const catalogEmbeddings: { med: typeof MEDICINE_CATALOG[0]; embedding: number[] }[] = [];

  for (const med of MEDICINE_CATALOG) {
    const text = buildEmbeddingText(med);
    const result = await getEmbedding(model, text);
    catalogEmbeddings.push({ med, embedding: result.embedding });
    process.stdout.write('.');
  }
  const catalogTime = Date.now() - catalogStart;
  console.log(`\n✅ ${catalogEmbeddings.length} embeddings in ${formatDur(catalogTime)} (${formatDur(Math.round(catalogTime / catalogEmbeddings.length))}/med)\n`);

  // 3. Run queries
  const results: QueryResult[] = [];
  let englishHits = 0, englishTotal = 0;
  let hinglishHits = 0, hinglishTotal = 0;
  let terminologyHits = 0, terminologyTotal = 0;

  for (const tq of TEST_QUERIES) {
    const qResult = await getEmbedding(model, tq.query);

    const scores = catalogEmbeddings.map(ce => ({
      name: ce.med.name,
      similarity: cosineSimilarity(qResult.embedding, ce.embedding),
    }));
    scores.sort((a, b) => b.similarity - a.similarity);
    const top3 = scores.slice(0, 3);

    const hitInTop3 = top3.some(s => tq.expectedTop3.includes(s.name));

    if (tq.group === 'english') { englishTotal++; if (hitInTop3) englishHits++; }
    if (tq.group === 'hinglish') { hinglishTotal++; if (hitInTop3) hinglishHits++; }
    if (tq.group === 'terminology') { terminologyTotal++; if (hitInTop3) terminologyHits++; }

    results.push({ query: tq.query, group: tq.group, top3, hitInTop3, latencyMs: qResult.durationMs });

    const icon = hitInTop3 ? '✅' : '❌';
    const groupLabel = tq.group.toUpperCase().padEnd(11);
    console.log(`${icon} [${groupLabel}] "${tq.query}"`);
    console.log(`   Top 3: ${top3.map(s => `${s.name}(${s.similarity.toFixed(3)})`).join(' | ')}`);
    console.log(`   Expected: ${tq.expectedTop3.slice(0, 3).join(', ')}`);
    console.log(`   Latency: ${formatDur(qResult.durationMs)}`);
    console.log();
  }

  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);

  return {
    model, dimensions, catalogEmbedTimeMs: catalogTime, coldStartMs,
    results, englishHits, englishTotal, hinglishHits, hinglishTotal,
    terminologyHits, terminologyTotal, avgLatencyMs: avgLatency,
  };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  MASAS Phase 9.1a — Embedding Model Comparison             ║');
  console.log('║  nomic-embed-text  vs  nomic-embed-text-v2-moe             ║');
  console.log('║  Hardware: M1 MacBook Air, 8 GB RAM | Budget: ₹0           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Verify Ollama
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const tags = (await r.json()) as { models: Array<{ name: string; size: number }> };
    console.log(`\n✅ Ollama running. Models: ${tags.models.map(m => m.name).join(', ')}`);
  } catch (e) {
    console.error(`❌ Cannot reach Ollama: ${e}`);
    process.exit(1);
  }

  // Unload any loaded model first (clean slate)
  console.log('\nUnloading any currently loaded models...');
  for (const m of MODELS) {
    try {
      await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m, keep_alive: 0 }),
        signal: AbortSignal.timeout(5000),
      });
    } catch { /* ignore */ }
  }
  await new Promise(r => setTimeout(r, 2000));

  // Run benchmarks
  const reports: ModelReport[] = [];

  for (const model of MODELS) {
    // Unload previous model before starting next
    for (const m of MODELS) {
      try {
        await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m, keep_alive: 0 }),
          signal: AbortSignal.timeout(5000),
        });
      } catch { /* ignore */ }
    }
    await new Promise(r => setTimeout(r, 3000));

    try {
      const report = await benchmarkModel(model);
      reports.push(report);
    } catch (error) {
      console.error(`\n❌ Model "${model}" failed: ${error}`);
      console.error('   Skipping this model.\n');
    }
  }

  if (reports.length < 2) {
    console.log('\n⚠️ Could not benchmark both models. See errors above.');
    process.exit(1);
  }

  // ── Comparison Table ──────────────────────────────────────────
  const [v1, v2] = reports;

  console.log('\n' + '═'.repeat(60));
  console.log('  HEAD-TO-HEAD COMPARISON');
  console.log('═'.repeat(60) + '\n');

  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`${'Metric'.padEnd(30)} ${'nomic-embed-text'.padEnd(20)} ${'v2-moe'.padEnd(20)}`);
  console.log(`${'─'.repeat(30)} ${'─'.repeat(20)} ${'─'.repeat(20)}`);
  console.log(`${pad('Dimensions', 30)} ${pad(String(v1.dimensions), 20)} ${pad(String(v2.dimensions), 20)}`);
  console.log(`${pad('Cold start', 30)} ${pad(formatDur(v1.coldStartMs), 20)} ${pad(formatDur(v2.coldStartMs), 20)}`);
  console.log(`${pad('Catalog embed (15 meds)', 30)} ${pad(formatDur(v1.catalogEmbedTimeMs), 20)} ${pad(formatDur(v2.catalogEmbedTimeMs), 20)}`);
  console.log(`${pad('Avg query latency', 30)} ${pad(formatDur(v1.avgLatencyMs), 20)} ${pad(formatDur(v2.avgLatencyMs), 20)}`);
  console.log(`${pad('English (top-3 hit)', 30)} ${pad(`${v1.englishHits}/${v1.englishTotal}`, 20)} ${pad(`${v2.englishHits}/${v2.englishTotal}`, 20)}`);
  console.log(`${pad('Hinglish (top-3 hit)', 30)} ${pad(`${v1.hinglishHits}/${v1.hinglishTotal}`, 20)} ${pad(`${v2.hinglishHits}/${v2.hinglishTotal}`, 20)}`);
  console.log(`${pad('Terminology (top-3 hit)', 30)} ${pad(`${v1.terminologyHits}/${v1.terminologyTotal}`, 20)} ${pad(`${v2.terminologyHits}/${v2.terminologyTotal}`, 20)}`);

  const v1Total = v1.englishHits + v1.hinglishHits + v1.terminologyHits;
  const v2Total = v2.englishHits + v2.hinglishHits + v2.terminologyHits;
  const totalQueries = v1.englishTotal + v1.hinglishTotal + v1.terminologyTotal;
  console.log(`${pad('TOTAL (top-3 hit)', 30)} ${pad(`${v1Total}/${totalQueries}`, 20)} ${pad(`${v2Total}/${totalQueries}`, 20)}`);

  // ── Query-by-query comparison ─────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('  QUERY-BY-QUERY COMPARISON');
  console.log('═'.repeat(60) + '\n');

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const tq = TEST_QUERIES[i];
    const r1 = v1.results[i];
    const r2 = v2.results[i];

    const winner = r1.hitInTop3 && !r2.hitInTop3 ? 'v1' :
                   !r1.hitInTop3 && r2.hitInTop3 ? 'v2' :
                   r1.hitInTop3 && r2.hitInTop3 ? 'tie' : 'both-miss';

    const winnerIcon = winner === 'v1' ? '◀ v1' : winner === 'v2' ? 'v2 ▶' : winner === 'tie' ? '═ tie' : '✗ miss';

    console.log(`[${tq.group.toUpperCase().padEnd(11)}] "${tq.query}"  →  ${winnerIcon}`);
    console.log(`  v1: ${r1.top3.map(s => `${s.name}(${s.similarity.toFixed(3)})`).join(' | ')}`);
    console.log(`  v2: ${r2.top3.map(s => `${s.name}(${s.similarity.toFixed(3)})`).join(' | ')}`);
    console.log();
  }

  // ── Verdict ───────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('  VERDICT');
  console.log('═'.repeat(60) + '\n');

  const hinglishDelta = v2.hinglishHits - v1.hinglishHits;

  if (hinglishDelta >= 2 && v2.avgLatencyMs < 1000) {
    console.log(`🏆 RECOMMEND: nomic-embed-text-v2-moe`);
    console.log(`   Hinglish improvement: +${hinglishDelta} queries (${v1.hinglishHits}→${v2.hinglishHits} of ${v2.hinglishTotal})`);
    console.log(`   English maintained: ${v2.englishHits}/${v2.englishTotal}`);
    console.log(`   Latency acceptable: ${formatDur(v2.avgLatencyMs)} avg`);
  } else if (hinglishDelta >= 1 && v2.avgLatencyMs < 1000) {
    console.log(`⚖️  MARGINAL: nomic-embed-text-v2-moe is slightly better for Hinglish`);
    console.log(`   Hinglish improvement: +${hinglishDelta} queries (${v1.hinglishHits}→${v2.hinglishHits} of ${v2.hinglishTotal})`);
    console.log(`   Consider whether the improvement justifies the model switch.`);
    console.log(`   A Hinglish→English synonym table may be simpler.`);
  } else if (v2.avgLatencyMs >= 1000) {
    console.log(`🐢 REJECT v2-moe: Too slow for M1 8GB (${formatDur(v2.avgLatencyMs)} avg latency)`);
    console.log(`   RECOMMEND: Stay with nomic-embed-text + Hinglish synonym table`);
  } else {
    console.log(`📌 RECOMMEND: Stay with nomic-embed-text`);
    console.log(`   v2-moe Hinglish improvement: ${hinglishDelta >= 0 ? '+' : ''}${hinglishDelta} queries — not worth the switch`);
    console.log(`   Use Hinglish→English synonym table for Hinglish coverage`);
  }

  console.log('\nComparison complete.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
