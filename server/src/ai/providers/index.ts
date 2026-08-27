/**
 * AI Provider Factory (Phase 9.0)
 *
 * Returns the correct provider implementation based on configuration.
 * Business logic calls these factory functions, NEVER imports providers directly.
 *
 * Current:
 *   - 'ollama' → OllamaEmbeddingProvider / OllamaLLMProvider (local, ₹0)
 *
 * Future:
 *   - 'openai' → OpenAIEmbeddingProvider / OpenAILLMProvider (paid)
 */

import type { EmbeddingProvider, LLMProvider } from '../types.js';
import type { AIConfig } from '../config.js';
import { OllamaEmbeddingProvider } from './ollama/ollamaEmbeddingProvider.js';
import { OllamaLLMProvider } from './ollama/ollamaLLMProvider.js';

/**
 * Get the configured embedding provider.
 * @throws Error if the configured provider is not yet implemented.
 */
export function getEmbeddingProvider(config: AIConfig): EmbeddingProvider {
  switch (config.embeddingProvider) {
    case 'ollama':
      return new OllamaEmbeddingProvider(config);
    case 'openai':
      // Future: return new OpenAIEmbeddingProvider(config);
      throw new Error(
        'OpenAI embedding provider is not yet implemented. ' +
        'It is planned as a future paid provider option. ' +
        'Use AI_EMBEDDING_PROVIDER=ollama for local development.',
      );
    default:
      throw new Error(`Unknown embedding provider: ${config.embeddingProvider}`);
  }
}

/**
 * Get the configured LLM provider.
 * @throws Error if the configured provider is not yet implemented.
 */
export function getLLMProvider(config: AIConfig): LLMProvider {
  switch (config.llmProvider) {
    case 'ollama':
      return new OllamaLLMProvider(config);
    case 'openai':
      // Future: return new OpenAILLMProvider(config);
      throw new Error(
        'OpenAI LLM provider is not yet implemented. ' +
        'It is planned as a future paid provider option. ' +
        'Use AI_LLM_PROVIDER=ollama for local development.',
      );
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
