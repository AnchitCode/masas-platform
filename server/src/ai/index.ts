/**
 * AI Module — Public API (Phase 9.0 + 9.1c)
 *
 * Re-exports the AI provider abstraction layer for use by MASAS modules.
 *
 * Usage:
 *   import { aiConfig, getEmbeddingProvider, getLLMProvider, getAIHealth } from '../ai/index.js';
 *
 * Consumers should:
 *   1. Check aiConfig.enabled before calling any AI provider
 *   2. Wrap provider calls in try/catch for graceful degradation
 *   3. Validate all LLM output with Zod schemas
 */

// Configuration
export { aiConfig } from './config.js';
export type { AIConfig } from './config.js';

// Types / Interfaces
export type { EmbeddingProvider, LLMProvider, LLMOptions, AIHealthStatus } from './types.js';

// Provider factory
export { getEmbeddingProvider, getLLMProvider } from './providers/index.js';

// Health check
export { getAIHealth } from './health.js';

// Embedding pipeline (Phase 9.1c)
export {
  buildEmbeddingText,
  computeEmbeddingHash,
  buildEmbeddingTextAndHash,
  generateEmbeddingForMedicine,
  backfillEmbeddings,
  getEmbeddingStatus,
} from './embedding/index.js';
export type { EmbeddingTextInput, EmbeddingResult, BackfillReport, EmbeddingStatus } from './embedding/index.js';
export { initEmbeddingBridge } from './embedding/embeddingBridge.js';

// Semantic search (Phase 9.1d)
export { normalizeQuery, findSemanticCandidates } from './search/index.js';
export type { SemanticCandidate, SemanticSearchResult } from './search/index.js';
