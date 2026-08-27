#!/usr/bin/env tsx
/**
 * Phase 9.1g — Latency Benchmark
 */
process.env.AI_ENABLED = 'true';

async function bench() {
  const { findSemanticCandidates } = await import('../src/ai/search/semanticSearch.js');

  console.log('=== Latency Benchmark (Phase 9.1g) ===\n');

  // Cold start
  const t0 = Date.now();
  const r0 = await findSemanticCandidates('paracetamol');
  const cold = Date.now() - t0;
  console.log(`Cold start:      ${cold}ms (${r0.candidates.length} candidates, top: ${r0.candidates[0]?.score?.toFixed(4) ?? 'N/A'})`);

  // Warm queries
  const queries = ['headache medicine', 'fever medicine', 'pain relief tablet', 'acetaminophen', 'dard ki dawa'];
  for (const q of queries) {
    const t = Date.now();
    const r = await findSemanticCandidates(q);
    const ms = Date.now() - t;
    console.log(`Warm [${q.padEnd(22)}]: ${String(ms).padStart(4)}ms (${r.candidates.length} candidates, norm: "${r.normalizedQuery}")`);
  }

  // AI disabled fallback
  process.env.AI_ENABLED = 'false';
  const { findSemanticCandidates: findDisabled } = await import('../src/ai/search/semanticSearch.js');
  const t1 = Date.now();
  const r1 = await findDisabled('paracetamol');
  console.log(`\nAI disabled:     ${Date.now() - t1}ms (aiUsed: ${r1.aiUsed})`);

  // Memory
  const mem = process.memoryUsage();
  console.log(`\nMemory RSS:      ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Memory Heap:     ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  process.exit(0);
}
bench();
