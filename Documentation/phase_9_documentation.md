# MASAS — Phase 9 Documentation

# Intelligent Medicine Search & Prescription Scanner

> Phase 9 made MASAS **smart**. Instead of relying only on exact text matching, MASAS now understands what a user *means* — whether they type a misspelled drug name, a Hindi query in English letters, or upload a photo of a prescription. Everything runs locally on your machine using Ollama — zero cloud cost.

**Author:** Anchit Gupta  
**Phase Status:** ✅ Complete  
**Sub-phases:** 9.0 → 9.2d  
**AI Models Used:** nomic-embed-text (embeddings, 768d), phi3.5 (LLM, prescription extraction)  
**Cost:** ₹0 — everything runs locally via Ollama

---

## What Phase 9 Added — The Big Picture

Before Phase 9, search was purely keyword-based (`ILIKE '%query%'`). If you searched "Paractemol" (typo) or "sir dard ki dawa" (Hinglish for headache medicine), you got zero results.

After Phase 9:

```
User types "sir dard ki dawa"
        ↓
Hinglish Normalizer → "headache medicine"
        ↓
Embedding Model → 768-dim vector
        ↓
pgvector cosine search → top candidates
        ↓
Confidence filter → reject nonsense, keep real matches
        ↓
Hybrid SQL query combines keyword + semantic + PostGIS
        ↓
Results ranked by: relevance tier → distance
```

And a new **Prescription Scanner** lets users upload a prescription photo → OCR reads the text → LLM extracts medicine names → catalog matching finds them in the database.

---

## Phase 9.0 — AI Foundation Layer

Before building any feature, we needed a clean foundation that:
- Can be turned on/off with a single env var (`AI_ENABLED=true/false`)
- Doesn't break anything when AI is off (server starts and works normally)
- Makes it easy to swap Ollama for OpenAI later (provider abstraction)

### AI Configuration (`server/src/ai/config.ts`)

All AI settings come from environment variables with safe defaults:

| Env Variable | Default | What it does |
|---|---|---|
| `AI_ENABLED` | `false` | Master toggle — everything checks this first |
| `AI_EMBEDDING_PROVIDER` | `ollama` | Which service generates embeddings |
| `AI_LLM_PROVIDER` | `ollama` | Which service runs the LLM |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Where Ollama is running |
| `AI_EMBEDDING_MODEL` | `nomic-embed-text` | Model for vector embeddings |
| `AI_LLM_MODEL` | `phi3.5:3.8b-mini-instruct-q4_K_M` | Model for text generation |

**Key design rule:** Every AI function checks `aiConfig.enabled` first. If AI is off, functions return empty results — they never throw errors.

### Provider Abstraction (`server/src/ai/types.ts` + `server/src/ai/providers/`)

Business logic never talks to Ollama directly. Instead it uses two interfaces:

```
EmbeddingProvider                    LLMProvider
├── embed(text) → number[]          ├── generate(prompt) → string
├── embedBatch(texts) → number[][]  ├── generateJSON(prompt) → object
├── isAvailable() → boolean         ├── isAvailable() → boolean
└── getDimensions() → number        └──
```

A factory function (`getEmbeddingProvider()` / `getLLMProvider()`) returns the right implementation based on config. Right now only Ollama exists. To add OpenAI later, you just add a new class and a `case 'openai':` in the factory.

### Ollama Providers

**OllamaEmbeddingProvider** (`server/src/ai/providers/ollama/ollamaEmbeddingProvider.ts`):
- Calls `POST /api/embeddings` on Ollama's REST API
- Returns a 768-dimensional float array
- Sequential batch processing (one at a time) to respect 8 GB RAM

**OllamaLLMProvider** (`server/src/ai/providers/ollama/ollamaLLMProvider.ts`):
- Calls `POST /api/generate` on Ollama's REST API
- Has `generateJSON()` that forces Ollama to output valid JSON (`format: 'json'`)
- **Critical rule:** LLM output is ALWAYS untrusted. Every caller validates with Zod.

### Health Check (`server/src/ai/health.ts`)

`GET /api/v1/ai/health` — reports whether AI is enabled and whether Ollama is reachable. No side effects, just a status check.

---

## 9.1 — Intelligent Medicine Search

This is the core feature. It makes search understand meaning, not just exact text.

### 9.1a — Database: pgvector Extension

Added the `vector` PostgreSQL extension (via `pgvector`) to store and search embeddings.

**Schema changes in `MedicineCatalog`:**

```prisma
model MedicineCatalog {
  // ... existing fields ...
  
  embedding     Unsupported("vector(768)")?   // 768-dim vector, nullable
  embeddingHash String?  @map("embedding_hash") // SHA-256 for stale detection
}
```

**Why nullable?** Medicines without embeddings still work via keyword search. The system degrades gracefully.

**HNSW Index** (created via migration):
```sql
CREATE INDEX idx_medicine_catalog_embedding_hnsw 
ON medicine_catalog 
USING hnsw (embedding vector_cosine_ops);
```
HNSW = Hierarchical Navigable Small World graph. It makes cosine similarity searches fast (sub-millisecond for small catalogs).

### 9.1b — Canonical Embedding Text (`server/src/ai/embedding/embeddingText.ts`)

Before generating an embedding, we need to decide *what text* the model sees. This matters a lot — the embedding captures whatever semantics are in the text.

**What's included and why:**

| Field | Why included |
|---|---|
| `name` | Primary search target ("paracetamol 500mg") |
| `genericName` | Users search by generic name ("acetaminophen") |
| `category` | Enables concept search ("analgesic", "antibiotic") |
| `dosageForm` | Disambiguates "tablet" vs "syrup" queries |

**What's excluded:** manufacturer (rarely searched), id, timestamps.

**Format:** Fields are joined with `. ` (period-space) — this gives the transformer model natural sentence boundaries.

Example:
```
"paracetamol 500mg. Generic: Acetaminophen. Category: Analgesic. Form: Tablet"
```

**Stale Detection:** Every embedding is paired with an `embeddingHash` — the SHA-256 of the canonical text. When you update a medicine's name or category, the hash changes, marking the embedding as stale. The next backfill run regenerates it. No need to run inference just to check freshness.

### 9.1c — Embedding Service & Background Worker

**Embedding Service** (`server/src/ai/embedding/embeddingService.ts`):

Two main functions:

1. **`generateEmbeddingForMedicine(id)`** — generates embedding for one medicine:
   - Fetch medicine → build canonical text → check hash → call Ollama → store vector + hash
   - Skips if hash matches (already up-to-date)
   - Never modifies medicine name/category/etc. — only writes embedding + hash

2. **`backfillEmbeddings(batchSize?)`** — processes ALL medicines that need embeddings:
   - "Need" = embedding is NULL or hash doesn't match
   - Sequential processing (one at a time) for 8 GB RAM safety
   - Each medicine is independent — errors skip that medicine and continue
   - Returns a report: how many generated, skipped, errored

**Embedding Event Bridge** (`server/src/ai/embedding/embeddingBridge.ts`):

Listens for `catalog.created` and `catalog.updated` events on the event bus, then queues a BullMQ job to generate/regenerate the embedding in the background. This means:
- Adding a medicine to the catalog doesn't wait for AI — it returns immediately
- The embedding is generated asynchronously by the background worker
- If Ollama is down, BullMQ retries with exponential backoff (5 attempts)

**Embedding Worker** (`server/src/jobs/embeddingWorker.ts`):

A BullMQ worker that processes embedding jobs:
- `generate-single`: one medicine (triggered by catalog events)
- `backfill`: all medicines (triggered manually by admin)
- Concurrency: 1 (sequential, for memory safety)
- Rate limit: 1 job per 500ms (prevent Ollama overload)

**Embedding Queue** (`server/src/jobs/queues.ts`):
- Queue name: `embeddings`
- Prefix: `masas` (shared Redis namespace)
- 5 retry attempts with exponential backoff (5s base)

### 9.1d — Semantic Search Pipeline

This is where the magic happens. The pipeline:

```
User query → normalizeQuery() → embed() → pgvector cosine search → confidence filter → candidates
```

#### Step 1: Hinglish Normalizer (`server/src/ai/search/queryNormalizer.ts`)

Converts Hindi-in-English-letters (Hinglish) to English before embedding.

**Strategy:**
1. Lowercase and trim
2. Try **phrase matches first** (longest match wins) — "sir dard ki dawa" → "headache medicine"
3. Replace remaining **individual words** — "bukhar" → "fever", "dawa" → "medicine"
4. Remove connectors — "ki", "ka", "ke" are dropped (no semantic value)
5. Collapse whitespace

**Examples:**
| Input | Output |
|---|---|
| `dard ki dawa` | `pain medicine` |
| `sir dard ki medicine` | `headache medicine` |
| `bukhar ki dawa` | `fever medicine` |
| `pet dard ki tablet` | `stomach pain tablet` |
| `Paracetamol` | `paracetamol` (just lowercased) |
| `headache medicine` | `headache medicine` (English passthrough) |

**Design:** This is deterministic (no AI needed), phrase-first (multi-word matches beat single-word), and expandable (add new terms as you see real search data).

**Scope:** Only Hinglish in Latin/English characters. Hindi Devanagari script is out of scope for Phase 9.

#### Step 2: Semantic Search (`server/src/ai/search/semanticSearch.ts`)

`findSemanticCandidates(query, limit)` — the main function:

1. Normalize query (Hinglish → English)
2. Check if Ollama is available
3. Generate query embedding (768-dim vector)
4. Run pgvector cosine similarity search:
   ```sql
   SELECT id, name, generic_name, category, dosage_form,
          1 - (embedding <=> $query_vector) AS similarity
   FROM medicine_catalog
   WHERE embedding IS NOT NULL
     AND 1 - (embedding <=> $query_vector) >= 0.40
   ORDER BY embedding <=> $query_vector
   LIMIT 10
   ```
   (`<=>` is pgvector's cosine distance operator)
5. Apply confidence filter
6. Return candidates with scores

**Thresholds:**
| Name | Value | Purpose |
|---|---|---|
| `SIMILARITY_THRESHOLD` | 0.40 | Minimum score at DB level — below this, not even considered |
| `SEMANTIC_CONFIDENCE_THRESHOLD` | 0.57 | Minimum score to trust results when there's no other signal |
| `MAX_CANDIDATES` | 10 | Maximum results returned |

#### Step 3: Confidence Filter (Quality Gate)

This is the most important quality mechanism. Raw cosine similarity *always* returns something — even for "zzzzqqqq9999" there's a closest vector. The confidence filter decides if results are meaningful.

**Three signals (accept if ANY fires):**

1. **Hinglish normalization changed the query** — the normalizer recognized Hindi terms, so this is a medical query
2. **Query contains known pharmaceutical terms** — words like "tablet", "fever", "antibiotic" (whole-word match only, not substrings)
3. **Top score ≥ 0.57** — strong embedding match even without lexical signals (handles drug name typos)

**If NONE fire → reject all candidates.** This prevents nonsense queries from returning random medicines.

**Why 0.57?** From the evaluation matrix:
- Closest legitimate query relying on this signal: "aspririn" scored 0.5780
- Closest nonsense query: "zzzzqqqq9999medicineabc" scored 0.5524
- Gap: 0.0256. Threshold 0.57 sits safely in this gap.

#### Failure Behavior

On ANY error (Ollama down, dimension mismatch, timeout, etc.):
- Returns `{ candidates: [], aiUsed: false }`
- Never throws — the caller falls back to keyword-only search transparently
- Error is logged for debugging

### 9.1e — Hybrid Search (Keyword + Semantic + Geo)

The main search endpoint (`server/src/modules/search/search.service.ts`) combines everything:

```
User query
    ↓
┌───┴──────────────┐
│  Catalog pre-check │ → Does query exactly match a medicine name?
└───┬──────────────┘
    ↓
┌───┴──────────────┐
│  Semantic search   │ → Get AI candidates with scores
└───┬──────────────┘
    ↓
┌───┴──────────────┐
│  Typo/Synonym      │ → If no exact match, is it a typo or synonym?
│  Resolution        │   (edit distance first, then embedding score)
└───┬──────────────┘
    ↓
┌───┴──────────────┐
│  Candidate Filter  │ → Filter candidates based on query type
└───┬──────────────┘
    ↓
┌───┴──────────────┐
│  Hybrid SQL Query  │ → Combine keyword ILIKE + semantic scores + PostGIS
└───┬──────────────┘
    ↓
Results ordered by: relevance_score DESC, distance_meters ASC
```

#### Query Classification & Resolution

The search service figures out what the user is actually looking for:

**Case 1: Exact match** — query matches a catalog medicine by name or generic name.
- Example: "Aspirin" matches `medicine_catalog.name`
- Target is set. Semantic candidates provide OOS alternatives.

**Case 2: Typo** — query is close to a medicine name by edit distance (≤ 3).
- Example: "Paractemol" → edit distance 1 from "paracetamol"
- Uses Levenshtein distance, NOT embedding score (more reliable for typos)
- Why: embedding might rank "crocin" higher than "paracetamol" for the typo "Paractemol" because both are analgesics, but the user clearly meant paracetamol

**Case 3: Synonym** — query is a different name for the same drug (edit distance > 3 but semantic score ≥ 0.65).
- Example: "acetaminophen" → score 0.66 → resolves to "paracetamol"
- Higher threshold (0.65) than general confidence (0.57) because we're committing to a single target

**Case 4: NL/Concept query** — query has pharmaceutical intent but doesn't match any specific medicine.
- Example: "headache medicine", "fever tablet", "dard ki dawa"
- No target is set. Semantic candidates are filtered by therapeutic category.
- Category detection: "headache" → Analgesic, "allergy" → Antihistamine, etc.
- If no category matches, fallback to score ratio filter (keep candidates within 90% of top score)

**Case 5: Unrecognized** — no pharma intent, no typo match, no synonym match.
- Example: "zzzzqqqq", "hello world"
- Returns zero results.

#### Relevance Scoring in SQL

Each result gets a relevance score based on how it matched:

| Match Type | Score | How |
|---|---|---|
| Exact name match | 100 | `name ILIKE 'aspirin'` |
| Partial name match | 80 | `name ILIKE '%aspir%'` |
| Generic name match | 70 | `generic_name ILIKE '%aspir%'` |
| Semantic match | 0–60 | `cosine_similarity × 60` |

Results are ordered by `relevance_score DESC, distance_meters ASC` — best match first, closest pharmacy for ties.

#### Target-Aware Post-Filtering

After the SQL query returns, the service applies smart filtering:

- **Target is available:** Suppress all semantic results (you found what you were looking for)
- **Target is out of stock:** Keep semantic results but filter by category (show similar alternatives, not random medicines)
- **Response includes `target` metadata:** `{ id, name, isAvailable }` so the frontend can show "Aspirin is out of stock near you" with alternatives

---

## 9.2 — Prescription Scanner

A 4-step pipeline that turns a prescription photo into matched medicines.

```
Prescription Image
        ↓
  ┌─────┴─────┐
  │  1. OCR    │ → Tesseract.js extracts text from image
  └─────┬─────┘
        ↓
  ┌─────┴──────────┐
  │  2. LLM Extract │ → Phi-3.5 picks out medicine names from OCR text
  └─────┬──────────┘
        ↓
  ┌─────┴──────────────┐
  │  3. Catalog Match    │ → Exact → Fuzzy → Semantic matching
  └─────┬──────────────┘
        ↓
  Results for user review
```

### 9.2a — OCR Service (`server/src/ai/ocr/ocrService.ts`)

Uses **Tesseract.js** to extract text from prescription images. Runs 100% locally.

**Key design decisions:**
- **Single worker:** Only one Tesseract worker at a time (8 GB RAM constraint)
- **Lazy init:** Worker is created on first use, not on server boot (no cold-start penalty)
- **30-second timeout:** If OCR takes longer, it's probably stuck
- **In-memory only:** Image buffer never touches disk
- **Graceful shutdown:** Worker is terminated on process exit

**How it works:**
```typescript
const result = await extractText(imageBuffer);
// result = { text: "Tab Paracetamol 500mg...", confidence: 85, latencyMs: 1200 }
```

**Scope:** Printed prescriptions only. Handwritten prescriptions are out of scope (OCR accuracy is too low). English text only.

### 9.2b — Prescription Extractor (`server/src/ai/prescription/prescriptionExtractor.ts`)

Given raw OCR text, uses the **Phi-3.5 LLM** (via Ollama) to extract medicine names.

**The prompt is carefully constrained:**
- Extract ONLY medicine/drug names
- Do NOT include dosage (500mg), frequency (twice daily), diagnosis
- Do NOT interpret, correct, or substitute names
- Do NOT provide medical advice
- Preserve spelling exactly as it appears
- Return JSON: `{ "medicines": ["name1", "name2", ...] }`

**Safety measures:**
- Temperature 0.0 (deterministic — same input always gives same output)
- Max 500 tokens, 30-second timeout
- LLM output is validated with **Zod schema** — if it doesn't match `{ medicines: string[] }`, it's rejected
- Each medicine name max 100 chars, max 20 medicines per prescription
- Names are deduplicated (case-insensitive)
- Function NEVER throws — returns empty candidates with error message on failure

**Example flow:**
```
OCR text: "Tab Paracetamol 500mg BD\nCap Amoxicillin 250mg TDS\nSyp Cetirizine 5ml OD"
    ↓
LLM extracts: { "medicines": ["Paracetamol", "Amoxicillin", "Cetirizine"] }
    ↓
Zod validates ✓
    ↓
Candidates: [
  { name: "Paracetamol", raw: "Paracetamol" },
  { name: "Amoxicillin", raw: "Amoxicillin" },
  { name: "Cetirizine", raw: "Cetirizine" }
]
```

### 9.2c — Catalog Matcher (`server/src/ai/prescription/catalogMatcher.ts`)

Takes the extracted medicine names and finds them in the MASAS catalog using a 3-tier matching strategy:

**For each extracted name:**

1. **Exact match** — `WHERE name ILIKE 'Paracetamol'` (case-insensitive exact)
   - Confidence: 1.0
2. **Fuzzy match** — `WHERE name ILIKE '%Paracetamol%' OR generic_name ILIKE '%Paracetamol%'`
   - Confidence: 0.7
   - Excludes IDs already found by exact match
3. **Semantic match** — reuses the Phase 9.1d `findSemanticCandidates()` vector search
   - Confidence: cosine similarity score
   - Excludes IDs already found by exact/fuzzy
   - Only runs if AI is enabled

Max 3 matches per extracted name. Processing is sequential (memory safety).

### 9.2d — Prescription Endpoint (`server/src/modules/prescription/`)

**Route:** `POST /api/v1/prescription/extract`
- Requires JWT authentication
- Accepts `multipart/form-data` with field name `prescription`
- Max file size: 5 MB
- Accepted types: JPEG, PNG, WebP

**Controller orchestration:**
1. Validate uploaded file exists and is non-empty
2. Run OCR → get text
3. **Discard image buffer immediately** (privacy — image is never stored)
4. Run LLM extraction → get medicine names
5. Run catalog matching → get matches
6. Return response

**Response shape:**
```json
{
  "success": true,
  "message": "Prescription processed",
  "data": {
    "ocrText": "Tab Paracetamol 500mg...",
    "ocrConfidence": 85,
    "candidates": [
      {
        "extractedName": "Paracetamol",
        "matches": [
          { "id": "...", "name": "paracetamol 500mg", "genericName": "Acetaminophen", "matchType": "exact", "confidence": 1.0 }
        ]
      }
    ],
    "meta": {
      "ocrLatencyMs": 1200,
      "llmLatencyMs": 3500,
      "matchLatencyMs": 150,
      "totalLatencyMs": 4850,
      "aiUsed": true
    }
  }
}
```

**Error handling philosophy:** The endpoint NEVER returns 500 for AI failures. It always returns 200 with degraded results. If OCR fails → empty text. If LLM fails → empty candidates. If matching fails → empty matches. The user always gets a response.

Low confidence OCR (< 30%) triggers a warning message: "Low quality scan. Results may be inaccurate."

---

## Architecture Overview

### File Structure

```
server/src/ai/
├── config.ts                    # AI configuration (env vars)
├── health.ts                    # GET /api/v1/ai/health
├── index.ts                     # Public API (re-exports)
├── types.ts                     # EmbeddingProvider & LLMProvider interfaces
├── providers/
│   ├── index.ts                 # Provider factory
│   └── ollama/
│       ├── ollamaEmbeddingProvider.ts   # Ollama embedding calls
│       └── ollamaLLMProvider.ts         # Ollama LLM calls
├── embedding/
│   ├── embeddingText.ts         # Canonical text builder + SHA-256 hash
│   ├── embeddingService.ts      # Generate/backfill embeddings
│   ├── embeddingBridge.ts       # Event bus → BullMQ bridge
│   └── index.ts
├── search/
│   ├── queryNormalizer.ts       # Hinglish → English normalizer
│   ├── semanticSearch.ts        # pgvector cosine similarity search
│   └── index.ts
├── ocr/
│   ├── ocrService.ts            # Tesseract.js OCR
│   └── index.ts
└── prescription/
    ├── prescriptionExtractor.ts # LLM medicine name extraction
    ├── catalogMatcher.ts        # Exact → Fuzzy → Semantic matching
    └── index.ts

server/src/modules/
├── search/
│   └── search.service.ts        # Hybrid search (keyword + semantic + geo)
└── prescription/
    ├── prescription.controller.ts  # Prescription scanning endpoint
    └── prescription.routes.ts      # POST /api/v1/prescription/extract

server/src/jobs/
├── embeddingWorker.ts           # BullMQ worker for background embeddings
└── queues.ts                    # Embedding queue definition
```

### Data Flow Diagrams

**Medicine added to catalog → embedding generated:**
```
Admin adds medicine → catalog.service → eventBus.emit('catalog.created')
                                              ↓
                                    embeddingBridge listens
                                              ↓
                                    embeddingQueue.add('generate-single')
                                              ↓
                                    embeddingWorker processes job
                                              ↓
                                    embeddingService.generateEmbeddingForMedicine()
                                              ↓
                                    buildEmbeddingText() → embed() via Ollama
                                              ↓
                                    Store vector + hash in DB
```

**User searches for medicine:**
```
GET /api/v1/search?q=sir+dard+ki+dawa&lat=...&lng=...&radiusKm=5
        ↓
search.service.searchPublicInventory()
        ↓
    ┌───┴──────────────┐
    │ findCatalogTarget │ → No exact match for "sir dard ki dawa"
    └───┬──────────────┘
        ↓
    ┌───┴────────────────────┐
    │ findSemanticCandidates  │
    │   normalizeQuery()     │ → "headache medicine"
    │   embed()              │ → 768-dim vector
    │   pgvector search      │ → [paracetamol: 0.72, aspirin: 0.68, ...]
    │   confidence filter    │ → accepted (pharma intent detected)
    └───┬────────────────────┘
        ↓
    ┌───┴──────────────────┐
    │ resolveTypoTarget     │ → skipped (has pharma intent)
    └───┬──────────────────┘
        ↓
    ┌───┴──────────────────────────┐
    │ filterCandidatesForQuery      │
    │   detectQueryCategory()      │ → "headache" → Analgesic
    │   filter by category         │ → keep only Analgesic medicines
    └───┬──────────────────────────┘
        ↓
    ┌───┴──────────────────┐
    │ Hybrid SQL query      │ → keyword ILIKE + semantic join + PostGIS
    └───┬──────────────────┘
        ↓
    Results: analgesics available near user
```

---

## Database Changes Summary

### New Columns on `medicine_catalog`

| Column | Type | Purpose |
|---|---|---|
| `embedding` | `vector(768)` | Nullable. The 768-dim embedding vector |
| `embedding_hash` | `text` | Nullable. SHA-256 of the canonical text used to generate the embedding |

### New Index

```sql
CREATE INDEX idx_medicine_catalog_embedding_hnsw 
ON medicine_catalog USING hnsw (embedding vector_cosine_ops);
```

### PostgreSQL Extensions

Added `vector` extension alongside existing `postgis`:
```prisma
extensions = [postgis, vector]
```

---

## Key Thresholds & Constants

These are the numbers you'll want to know if you're tuning search quality:

| Constant | Value | Location | What it does |
|---|---|---|---|
| `SIMILARITY_THRESHOLD` | 0.40 | `semanticSearch.ts` | Minimum cosine score at DB level |
| `SEMANTIC_CONFIDENCE_THRESHOLD` | 0.57 | `semanticSearch.ts` | Minimum score to trust without lexical signals |
| `MAX_CANDIDATES` | 10 | `semanticSearch.ts` | Max semantic candidates returned |
| `MAX_EDIT_DISTANCE` | 3 | `search.service.ts` | Max Levenshtein distance for typo detection |
| `SYNONYM_THRESHOLD` | 0.65 | `search.service.ts` | Minimum score to resolve as drug synonym |
| `RELEVANCE_RATIO` | 0.90 | `search.service.ts` | Min ratio to top score for NL query fallback |
| `MAX_MATCHES_PER_CANDIDATE` | 3 | `catalogMatcher.ts` | Max catalog matches per prescription medicine |
| `OCR_TIMEOUT_MS` | 30,000 | `ocrService.ts` | Max time for OCR operation |

---

## Testing

Phase 9 added comprehensive tests across all new modules:

### Unit Tests

| Test File | What it covers |
|---|---|
| `queryNormalizer.test.ts` | Hinglish → English normalization (phrases, words, passthrough, edge cases) |
| `embedding.test.ts` | Embedding text builder, hash computation, service logic, backfill |
| `semanticSearch.test.ts` | pgvector search, confidence filter, pharmaceutical intent detection |
| `ocr.test.ts` | Tesseract.js wrapper, timeout handling, empty input |
| `prescriptionExtractor.test.ts` | LLM extraction, Zod validation, error handling |
| `catalogMatcher.test.ts` | Exact/fuzzy/semantic matching tiers, deduplication |
| `search.test.ts` | Full hybrid search integration (keyword + semantic + geo) |

### Evaluation & Benchmarking Scripts

| Script | What it does |
|---|---|
| `scripts/semantic-eval-matrix.ts` | Runs a matrix of test queries against the catalog and reports scores, categories, and confidence decisions. Used to derive threshold values. |
| `scripts/semantic-hybrid-demo.ts` | Demo of the full hybrid search pipeline with sample queries |
| `scripts/ai-benchmark.ts` | Performance benchmarking of AI operations |
| `scripts/ai-model-comparison.ts` | Compare different embedding models |
| `scripts/embedding-status.ts` | Check how many medicines have embeddings, stale count |
| `scripts/run-backfill.ts` | Manually trigger embedding backfill |
| `scripts/phase91-e2e-verify.ts` | End-to-end verification of Phase 9.1 |
| `scripts/phase91-latency-bench.ts` | Latency benchmarking for search |

---

## Important Design Decisions & Why

### 1. Why Ollama instead of OpenAI?
- **₹0 cost** — runs on your own machine
- **Privacy** — no patient data sent to external APIs
- **No internet needed** — works offline
- **Swappable** — provider abstraction means you can add OpenAI later with one new class

### 2. Why Levenshtein for typos instead of just embeddings?
Embeddings are about *meaning*, not *spelling*. "Paractemol" (typo of paracetamol) might get a higher embedding score for "crocin" (same therapeutic use) than for "paracetamol" (same drug, different spelling). Edit distance catches typos reliably — if the query is within 3 edits of a catalog name, that's what the user meant.

### 3. Why the confidence filter?
Cosine similarity always returns results — there's always a "closest" vector. Without the confidence filter, searching "pizza" would return random medicines. The filter requires at least one signal (pharma language, Hinglish normalization, or high score) to accept results.

### 4. Why category-aware filtering for NL queries?
Without it, "headache medicine" returns all medicines sorted by embedding similarity — including antacids, antibiotics, etc. that are semantically "close" to the word "medicine". Category filtering ensures "headache medicine" → only Analgesics.

### 5. Why is the prescription image never stored?
Privacy. The image buffer is explicitly nulled right after OCR. No disk writes, no database storage, no logging. The extracted text and matched medicines are returned in the response — that's it.

### 6. Why does the prescription endpoint return 200 on AI failure?
Because partial results are better than no results. If OCR works but LLM fails, you still get the raw OCR text. If everything fails, you get an error message. The frontend can always render something useful.

### 7. Why sequential processing everywhere?
The target machine has 8 GB RAM. Ollama needs RAM for the model. Tesseract needs RAM for OCR. Running them in parallel would cause OOM. Sequential processing with concurrency=1 keeps memory predictable.

### 8. Why SHA-256 for stale embedding detection?
Re-running inference to check if an embedding is current would be wasteful. Instead, hash the input text → compare with stored hash → if different, re-embed. O(1) check instead of O(inference_time).

---

## Environment Variables Added in Phase 9

```env
# AI Master Toggle
AI_ENABLED=true

# Provider Selection
AI_EMBEDDING_PROVIDER=ollama
AI_LLM_PROVIDER=ollama

# Ollama Connection
OLLAMA_BASE_URL=http://localhost:11434

# Model Names
AI_EMBEDDING_MODEL=nomic-embed-text
AI_LLM_MODEL=phi3.5:3.8b-mini-instruct-q4_K_M
```

---

## How to Set Up Phase 9 From Scratch

1. **Install Ollama:** `brew install ollama` (macOS)
2. **Pull models:**
   ```bash
   ollama pull nomic-embed-text
   ollama pull phi3.5:3.8b-mini-instruct-q4_K_M
   ```
3. **Enable AI in `.env`:** `AI_ENABLED=true`
4. **Run migrations:** `npx prisma migrate deploy` (adds vector column + HNSW index)
5. **Backfill embeddings:** The server will auto-generate embeddings for new medicines. For existing ones, run: `npx tsx scripts/run-backfill.ts`
6. **Verify:** `GET /api/v1/ai/health` should show `aiEnabled: true, providerReachable: true`
