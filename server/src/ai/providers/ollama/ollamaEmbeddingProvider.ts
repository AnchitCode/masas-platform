/**
 * Ollama Embedding Provider (Phase 9.0)
 *
 * Local embedding generation via Ollama's REST API.
 * Zero-cost, runs entirely on the developer's machine.
 *
 * Default model: nomic-embed-text (768 dimensions, ~1 GB RAM)
 *
 * Architecture: Calls Ollama's /api/embeddings endpoint which loads
 * the model on-demand and unloads after idle timeout (default 5 min).
 * This means the embedding model only uses RAM when actively generating.
 */

import type { EmbeddingProvider } from '../../types.js';
import type { AIConfig } from '../../config.js';
import logger from '../../../utils/logger.js';

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimensions: number;
  private readonly timeout: number;

  constructor(config: AIConfig) {
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.embeddingModel;
    this.dimensions = config.embeddingDimensions;
    this.timeout = config.embeddingTimeout;
  }

  /**
   * Generate an embedding for a single text string.
   * Calls Ollama's /api/embeddings endpoint.
   */
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(`Ollama embedding failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { embedding: number[] };

    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new Error('Ollama returned empty or invalid embedding');
    }

    return data.embedding;
  }

  /**
   * Generate embeddings for multiple texts.
   * Processes sequentially to avoid overwhelming Ollama on 8 GB RAM.
   * A future optimization could batch these if the provider supports it.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      try {
        const embedding = await this.embed(text);
        results.push(embedding);
      } catch (error) {
        logger.error('ollama-embedding: batch item failed', {
          text: text.slice(0, 100),
          error: String(error),
        });
        throw error;
      }
    }

    return results;
  }

  /**
   * Check if Ollama is running and reachable.
   * Uses the /api/tags endpoint which lists available models.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
