/**
 * Embedding Module — Re-exports (Phase 9.1c)
 */

export { buildEmbeddingText, computeEmbeddingHash, buildEmbeddingTextAndHash } from './embeddingText.js';
export type { EmbeddingTextInput } from './embeddingText.js';

export {
  generateEmbeddingForMedicine,
  backfillEmbeddings,
  getEmbeddingStatus,
} from './embeddingService.js';
export type { EmbeddingResult, BackfillReport, EmbeddingStatus } from './embeddingService.js';
