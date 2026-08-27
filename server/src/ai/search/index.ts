/**
 * AI Search Module — Re-exports (Phase 9.1d)
 */

export { normalizeQuery, _testing as _normalizerTesting } from './queryNormalizer.js';
export { findSemanticCandidates, _config as _searchConfig } from './semanticSearch.js';
export type { SemanticCandidate, SemanticSearchResult } from './semanticSearch.js';
