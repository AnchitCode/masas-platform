#!/usr/bin/env tsx
/**
 * MASAS Phase 9.1a — AI Model Benchmark
 *
 * Verifies that the selected embedding and LLM models:
 *   1. Load and run on M1 MacBook Air 8 GB
 *   2. Produce acceptable embedding quality for English medicine queries
 *   3. Produce acceptable embedding quality for Hinglish (Latin script) queries
 *   4. Can extract structured JSON from OCR-like text
 *   5. Run within acceptable latency bounds
 *
 * Usage: npx tsx scripts/ai-benchmark.ts
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Models pulled: `ollama pull nomic-embed-text` and `ollama pull phi3.5:3.8b-mini-instruct-q4_K_M`
 */

// ─── Configuration ──────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'nomic-embed-text';
const LLM_MODEL = process.env.AI_LLM_MODEL || 'phi3.5:3.8b-mini-instruct-q4_K_M';

// ─── Medicine Catalog (simulated MASAS entries) ─────────────────

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
  language: 'english' | 'hinglish';
  expectedMatches: string[]; // medicine names that should rank highly
  minSimilarity: number;     // minimum acceptable similarity for top match
}

const TEST_QUERIES: TestQuery[] = [
  // English queries
  { query: 'headache medicine', language: 'english', expectedMatches: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650', 'crocin advance', 'combiflam'], minSimilarity: 0.25 },
  { query: 'pain relief tablet', language: 'english', expectedMatches: ['paracetamol 500mg', 'ibuprofen 400mg', 'combiflam', 'disprin'], minSimilarity: 0.25 },
  { query: 'Paractemol', language: 'english', expectedMatches: ['paracetamol 500mg', 'dolo 650', 'crocin advance'], minSimilarity: 0.4 },
  { query: 'acetaminophen', language: 'english', expectedMatches: ['paracetamol 500mg', 'dolo 650', 'crocin advance'], minSimilarity: 0.35 },
  { query: 'fever medicine', language: 'english', expectedMatches: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650', 'crocin advance'], minSimilarity: 0.2 },
  { query: 'antibiotic', language: 'english', expectedMatches: ['amoxicillin 500mg', 'azithromycin 500mg'], minSimilarity: 0.3 },
  { query: 'stomach acid tablet', language: 'english', expectedMatches: ['omeprazole 20mg', 'pantoprazole 40mg', 'rantac 150'], minSimilarity: 0.2 },
  { query: 'allergy medicine', language: 'english', expectedMatches: ['cetirizine 10mg', 'allegra 120mg'], minSimilarity: 0.2 },

  // Hinglish queries (Latin script)
  { query: 'dard ki dawa', language: 'hinglish', expectedMatches: ['paracetamol 500mg', 'ibuprofen 400mg', 'combiflam'], minSimilarity: 0.15 },
  { query: 'sir dard ki medicine', language: 'hinglish', expectedMatches: ['paracetamol 500mg', 'ibuprofen 400mg', 'dolo 650'], minSimilarity: 0.15 },
  { query: 'bukhar ki dawa', language: 'hinglish', expectedMatches: ['paracetamol 500mg', 'dolo 650', 'crocin advance'], minSimilarity: 0.15 },
  { query: 'pet dard ki tablet', language: 'hinglish', expectedMatches: ['dicyclomine 20mg', 'omeprazole 20mg', 'pantoprazole 40mg'], minSimilarity: 0.1 },
];

// ─── Helpers ────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Embedding failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { embedding: number[] };
  return data.embedding;
}

async function generateJSON(prompt: string): Promise<{ response: string; totalDuration: number }> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Generate failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { response: string; total_duration: number };
  return { response: data.response, totalDuration: data.total_duration };
}

function formatMs(ns: number): string {
  return `${(ns / 1_000_000).toFixed(0)}ms`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Benchmark Runner ───────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       MASAS Phase 9.1a — AI Model Benchmark                ║');
  console.log('║       Hardware: M1 MacBook Air, 8 GB RAM                   ║');
  console.log('║       Budget: ₹0                                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();

  // ── Step 1: Check Ollama connectivity ─────────────────────────
  console.log('━━━ Step 1: Ollama Connectivity ━━━');
  try {
    const tagResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!tagResponse.ok) throw new Error(`HTTP ${tagResponse.status}`);
    const tags = (await tagResponse.json()) as { models: Array<{ name: string; size: number }> };
    console.log(`✅ Ollama is running at ${OLLAMA_BASE_URL}`);
    console.log(`   Available models: ${tags.models.map(m => m.name).join(', ') || '(none)'}`);
    console.log();
  } catch (error) {
    console.error(`❌ Cannot reach Ollama at ${OLLAMA_BASE_URL}`);
    console.error(`   Error: ${error}`);
    console.error(`   → Make sure Ollama is running: ollama serve`);
    process.exit(1);
  }

  // ── Step 2: Embedding Model Benchmark ─────────────────────────
  console.log('━━━ Step 2: Embedding Model Benchmark ━━━');
  console.log(`Model: ${EMBEDDING_MODEL}`);
  console.log();

  // 2a. Generate catalog embeddings
  console.log('Generating medicine catalog embeddings...');
  const catalogEmbeddings: { med: typeof MEDICINE_CATALOG[0]; text: string; embedding: number[] }[] = [];
  const catalogStartTime = Date.now();

  for (const med of MEDICINE_CATALOG) {
    const text = buildEmbeddingText(med);
    try {
      const embedding = await getEmbedding(text);
      catalogEmbeddings.push({ med, text, embedding });
      process.stdout.write('.');
    } catch (error) {
      console.error(`\n❌ Failed to embed "${med.name}": ${error}`);
      process.exit(1);
    }
  }

  const catalogDuration = Date.now() - catalogStartTime;
  console.log(`\n✅ ${catalogEmbeddings.length} embeddings generated in ${formatDuration(catalogDuration)}`);
  console.log(`   Dimensions: ${catalogEmbeddings[0].embedding.length}`);
  console.log(`   Avg latency: ${formatDuration(catalogDuration / catalogEmbeddings.length)} per embedding`);
  console.log();

  // 2b. Run search queries
  console.log('Running search queries...');
  console.log();

  let englishPassed = 0;
  let englishTotal = 0;
  let hinglishPassed = 0;
  let hinglishTotal = 0;

  const queryResults: Array<{
    query: string;
    language: string;
    topMatches: Array<{ name: string; similarity: number }>;
    hitExpected: boolean;
    latencyMs: number;
  }> = [];

  for (const testQuery of TEST_QUERIES) {
    const queryStart = Date.now();
    const queryEmbedding = await getEmbedding(testQuery.query);
    const queryLatency = Date.now() - queryStart;

    // Score all catalog entries
    const scores = catalogEmbeddings.map(ce => ({
      name: ce.med.name,
      similarity: cosineSimilarity(queryEmbedding, ce.embedding),
    }));
    scores.sort((a, b) => b.similarity - a.similarity);

    const top5 = scores.slice(0, 5);
    const topMatch = top5[0];

    // Check if any expected match is in top 5
    const hitExpected = top5.some(s =>
      testQuery.expectedMatches.includes(s.name) && s.similarity >= testQuery.minSimilarity
    );

    if (testQuery.language === 'english') {
      englishTotal++;
      if (hitExpected) englishPassed++;
    } else {
      hinglishTotal++;
      if (hitExpected) hinglishPassed++;
    }

    queryResults.push({
      query: testQuery.query,
      language: testQuery.language,
      topMatches: top5,
      hitExpected,
      latencyMs: queryLatency,
    });

    const status = hitExpected ? '✅' : '❌';
    console.log(`${status} [${testQuery.language.toUpperCase().padEnd(8)}] "${testQuery.query}"`);
    console.log(`   Top match: ${topMatch.name} (similarity: ${topMatch.similarity.toFixed(4)})`);
    console.log(`   Top 3: ${top5.slice(0, 3).map(s => `${s.name}(${s.similarity.toFixed(3)})`).join(', ')}`);
    console.log(`   Expected: ${testQuery.expectedMatches.slice(0, 3).join(', ')} (min: ${testQuery.minSimilarity})`);
    console.log(`   Latency: ${formatDuration(queryLatency)}`);
    console.log();
  }

  // 2c. Embedding summary
  console.log('━━━ Embedding Benchmark Summary ━━━');
  console.log(`English:  ${englishPassed}/${englishTotal} queries matched expected medicines`);
  console.log(`Hinglish: ${hinglishPassed}/${hinglishTotal} queries matched expected medicines`);
  console.log();

  const avgLatency = queryResults.reduce((sum, r) => sum + r.latencyMs, 0) / queryResults.length;
  console.log(`Avg query embedding latency: ${formatDuration(avgLatency)}`);
  console.log(`Catalog embedding latency:   ${formatDuration(catalogDuration / catalogEmbeddings.length)} per medicine`);
  console.log();

  // ── Step 3: LLM JSON Extraction Benchmark ────────────────────
  console.log('━━━ Step 3: LLM Structured JSON Extraction ━━━');
  console.log(`Model: ${LLM_MODEL}`);
  console.log();

  const sampleOCRText = `
Dr. Sharma Clinic
Patient: Rahul Kumar
Date: 15/08/2026

Rx:
1. Tab Amoxicillin 500mg — 1 tab 3 times daily x 5 days
2. Tab Paracetamol 650mg — 1 tab as needed for fever
3. Cap Omeprazole 20mg — 1 cap before breakfast x 7 days
4. Syp Cetirizine 5ml — at bedtime for 3 days
`;

  const extractionPrompt = `You are a text extraction assistant. Extract candidate medicine names, dosages, and quantities from the following OCR text.

Rules:
1. Only extract what looks like medicine names. Ignore patient names, dates, doctor details.
2. If a dosage is mentioned, include it.
3. If quantity is mentioned, include it.
4. If you are unsure about a name, include it with a lower confidence score.
5. Return valid JSON only.
6. Your output is a list of CANDIDATES that will be verified downstream. Do not assume accuracy.

OCR Text:
---
${sampleOCRText}
---

Return a JSON object with a "medicines" array:
{"medicines": [{"name": "...", "dosage": "...", "quantity": null, "confidence": 0.9}]}`;

  console.log('Sending prescription OCR text to LLM...');
  const llmStart = Date.now();

  try {
    const result = await generateJSON(extractionPrompt);
    const llmLatency = Date.now() - llmStart;

    console.log(`✅ LLM responded in ${formatDuration(llmLatency)}`);
    console.log(`   Ollama total_duration: ${formatMs(result.totalDuration)}`);
    console.log();

    // Try to parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.response);
      console.log('✅ Response is valid JSON');
    } catch {
      console.log('❌ Response is NOT valid JSON');
      console.log(`   Raw: ${result.response.slice(0, 500)}`);
      parsed = null;
    }

    if (parsed && typeof parsed === 'object') {
      const medicines = (parsed as Record<string, unknown>).medicines;
      if (Array.isArray(medicines)) {
        console.log(`✅ Extracted ${medicines.length} medicine candidates:`);
        for (const med of medicines) {
          const m = med as Record<string, unknown>;
          console.log(`   - ${m.name} | dosage: ${m.dosage || 'N/A'} | confidence: ${m.confidence || 'N/A'}`);
        }

        // Check if expected medicines were found
        const extractedNames = medicines.map((m: Record<string, unknown>) =>
          String(m.name || '').toLowerCase()
        );
        const expectedNames = ['amoxicillin', 'paracetamol', 'omeprazole', 'cetirizine'];
        const found = expectedNames.filter(exp =>
          extractedNames.some(ext => ext.includes(exp))
        );
        console.log();
        console.log(`   Expected medicines found: ${found.length}/${expectedNames.length} (${found.join(', ')})`);
      } else {
        console.log('⚠️ Response JSON does not contain "medicines" array');
        console.log(`   Keys: ${Object.keys(parsed as Record<string, unknown>).join(', ')}`);
        console.log(`   Raw: ${result.response.slice(0, 500)}`);
      }
    }
    console.log();
  } catch (error) {
    const llmLatency = Date.now() - llmStart;
    console.error(`❌ LLM extraction failed after ${formatDuration(llmLatency)}: ${error}`);
    console.log();
  }

  // ── Step 4: Performance Summary ───────────────────────────────
  console.log('━━━ Step 4: Performance Summary ━━━');
  console.log();
  console.log(`Embedding Model: ${EMBEDDING_MODEL}`);
  console.log(`  Dimensions:     ${catalogEmbeddings[0].embedding.length}`);
  console.log(`  Catalog embed:  ${formatDuration(catalogDuration)} for ${catalogEmbeddings.length} medicines`);
  console.log(`  Query latency:  ${formatDuration(avgLatency)} avg per query`);
  console.log(`  English:        ${englishPassed}/${englishTotal} passed`);
  console.log(`  Hinglish:       ${hinglishPassed}/${hinglishTotal} passed`);
  console.log();
  console.log(`LLM Model: ${LLM_MODEL}`);
  console.log(`  JSON extraction tested above`);
  console.log();

  // ── Final Verdict ─────────────────────────────────────────────
  console.log('━━━ Final Verdict ━━━');

  const embeddingOk = englishPassed >= Math.ceil(englishTotal * 0.6); // at least 60% English pass
  const hinglishOk = hinglishPassed >= 1; // at least 1 Hinglish query works

  if (embeddingOk && hinglishOk) {
    console.log(`✅ EMBEDDING MODEL APPROVED: ${EMBEDDING_MODEL}`);
    console.log(`   English: ${englishPassed}/${englishTotal} — sufficient`);
    console.log(`   Hinglish: ${hinglishPassed}/${hinglishTotal} — ${hinglishPassed >= Math.ceil(hinglishTotal * 0.5) ? 'good' : 'limited but functional'}`);
  } else if (embeddingOk && !hinglishOk) {
    console.log(`⚠️ EMBEDDING MODEL PARTIAL: ${EMBEDDING_MODEL}`);
    console.log(`   English: ${englishPassed}/${englishTotal} — sufficient`);
    console.log(`   Hinglish: ${hinglishPassed}/${hinglishTotal} — FAILED`);
    console.log('   → Consider nomic-embed-text-v2-moe or Hinglish→English synonym mapping');
  } else {
    console.log(`❌ EMBEDDING MODEL REJECTED: ${EMBEDDING_MODEL}`);
    console.log(`   English: ${englishPassed}/${englishTotal}`);
    console.log(`   Hinglish: ${hinglishPassed}/${hinglishTotal}`);
    console.log('   → Try a different embedding model');
  }

  console.log();
  console.log('Benchmark complete.');

  // Exit with appropriate code
  process.exit(embeddingOk ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal benchmark error:', error);
  process.exit(1);
});
