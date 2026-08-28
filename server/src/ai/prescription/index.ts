/**
 * Prescription Module — Public API (Phase 9.2b + 9.2c)
 */
export { extractMedicineNames } from './prescriptionExtractor.js';
export type { ExtractedCandidate, ExtractionResult } from './prescriptionExtractor.js';

export { matchCandidates } from './catalogMatcher.js';
export type { CatalogMatch, MatchResult } from './catalogMatcher.js';
