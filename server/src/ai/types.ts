/**
 * AI Provider Abstraction — Type Definitions (Phase 9.0)
 *
 * Defines the interfaces that all AI providers must implement.
 * Business logic depends on these interfaces, NOT on Ollama directly.
 *
 * Current implementations:
 *   - OllamaEmbeddingProvider (local, ₹0)
 *   - OllamaLLMProvider (local, ₹0)
 *
 * Future implementations:
 *   - OpenAIEmbeddingProvider (paid)
 *   - OpenAILLMProvider (paid)
 */

// ─── Embedding Provider ──────────────────────────────────────────

/**
 * Interface for text embedding providers.
 *
 * Embeddings are fixed-length numeric vectors that represent the semantic
 * meaning of text. Two texts with similar meanings produce vectors with
 * high cosine similarity.
 *
 * Used by: 9.1 Intelligent Medicine Search
 */
export interface EmbeddingProvider {
  /** Human-readable provider name (e.g., 'ollama', 'openai') */
  readonly name: string;

  /** Generate an embedding vector for a single text string. */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embedding vectors for multiple texts.
   * Default implementations may call embed() in a loop,
   * but providers can override for batch-optimized APIs.
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Check if the provider is reachable and ready. */
  isAvailable(): Promise<boolean>;

  /** Return the dimensionality of the embedding vectors (e.g., 768). */
  getDimensions(): number;
}

// ─── LLM Provider ────────────────────────────────────────────────

/**
 * Options for LLM generation calls.
 */
export interface LLMOptions {
  /** Sampling temperature (0.0 = deterministic, 1.0 = creative). Default: 0.1 */
  temperature?: number;
  /** Maximum tokens to generate. Default: provider-specific. */
  maxTokens?: number;
  /** Output format constraint. 'json' forces valid JSON output. */
  format?: 'json' | 'text';
  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number;
}

/**
 * Interface for Large Language Model providers.
 *
 * LLM providers generate text from prompts. Used for:
 *   - 9.2 Prescription extraction (OCR text → candidate medicine names)
 *   - 9.4 Medicine recommendations (medicine → alternatives)
 *
 * IMPORTANT: LLM output is ALWAYS untrusted. Every response must be
 * validated with Zod schemas and cross-checked against the MedicineCatalog
 * before being presented to users.
 */
export interface LLMProvider {
  /** Human-readable provider name (e.g., 'ollama', 'openai') */
  readonly name: string;

  /** Generate a text response from a prompt. */
  generate(prompt: string, options?: LLMOptions): Promise<string>;

  /**
   * Generate a structured JSON response from a prompt.
   * Automatically sets format: 'json' and parses the response.
   * Throws if the response is not valid JSON.
   *
   * IMPORTANT: The returned object is parsed JSON but NOT validated
   * against any schema. Callers MUST validate with Zod before use.
   */
  generateJSON<T = unknown>(prompt: string, options?: Omit<LLMOptions, 'format'>): Promise<T>;

  /** Check if the provider is reachable and ready. */
  isAvailable(): Promise<boolean>;
}

// ─── AI Health Status ────────────────────────────────────────────

/**
 * Health status of the AI subsystem, returned by GET /api/v1/ai/health
 */
export interface AIHealthStatus {
  /** Whether AI features are enabled via AI_ENABLED env var */
  aiEnabled: boolean;
  /** Whether the AI backend (e.g., Ollama) is reachable */
  providerReachable: boolean;
  /** Name of the configured embedding provider */
  embeddingProvider: string;
  /** Name of the configured embedding model */
  embeddingModel: string;
  /** Name of the configured LLM provider */
  llmProvider: string;
  /** Name of the configured LLM model */
  llmModel: string;
}
