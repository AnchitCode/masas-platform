/**
 * AI Health Check (Phase 9.0)
 *
 * Reports the status of the AI subsystem without side effects.
 * Used by:
 *   - GET /api/v1/ai/health endpoint
 *   - Internal checks before AI operations
 */

import type { AIHealthStatus } from './types.js';
import { aiConfig } from './config.js';
import { getEmbeddingProvider, getLLMProvider } from './providers/index.js';
import logger from '../utils/logger.js';

/**
 * Check the health of the AI subsystem.
 *
 * If AI is disabled (AI_ENABLED=false), returns a status object
 * indicating that AI is disabled — no provider connectivity is checked.
 *
 * If AI is enabled, checks whether the configured providers are reachable.
 */
export async function getAIHealth(): Promise<AIHealthStatus> {
  const status: AIHealthStatus = {
    aiEnabled: aiConfig.enabled,
    providerReachable: false,
    embeddingProvider: aiConfig.embeddingProvider,
    embeddingModel: aiConfig.embeddingModel,
    llmProvider: aiConfig.llmProvider,
    llmModel: aiConfig.llmModel,
  };

  if (!aiConfig.enabled) {
    return status;
  }

  // Check embedding provider reachability
  try {
    const embeddingProvider = getEmbeddingProvider(aiConfig);
    status.providerReachable = await embeddingProvider.isAvailable();
  } catch (error) {
    logger.warn('ai-health: embedding provider check failed', {
      error: String(error),
    });
    status.providerReachable = false;
  }

  // If the embedding provider is reachable and we use the same backend for LLM,
  // we can assume LLM is reachable too (same Ollama instance).
  // If they're different backends, we'd check separately.
  if (!status.providerReachable && aiConfig.llmProvider !== aiConfig.embeddingProvider) {
    try {
      const llmProvider = getLLMProvider(aiConfig);
      // For health check, just verify reachability
      const llmAvailable = await llmProvider.isAvailable();
      // providerReachable reflects the overall AI system readiness
      status.providerReachable = llmAvailable;
    } catch (error) {
      logger.warn('ai-health: LLM provider check failed', {
        error: String(error),
      });
    }
  }

  return status;
}
