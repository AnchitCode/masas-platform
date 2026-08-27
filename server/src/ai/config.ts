/**
 * AI Configuration (Phase 9.0)
 *
 * Centralizes all AI-related configuration. All values have safe defaults
 * so the server starts and runs normally without Ollama installed.
 *
 * AI features are disabled by default (AI_ENABLED=false).
 */

import env from '../config/env.js';

// ─── AI Configuration Interface ──────────────────────────────────

export interface AIConfig {
  /** Master toggle for all AI features. Default: false */
  enabled: boolean;

  /** Embedding provider: 'ollama' (local, ₹0) or 'openai' (future, paid) */
  embeddingProvider: 'ollama' | 'openai';

  /** LLM provider: 'ollama' (local, ₹0) or 'openai' (future, paid) */
  llmProvider: 'ollama' | 'openai';

  /** Base URL for the Ollama API */
  ollamaBaseUrl: string;

  /** Embedding model name (e.g., 'nomic-embed-text') */
  embeddingModel: string;

  /** LLM model name (e.g., 'phi3.5:3.8b-mini-instruct-q4_K_M') */
  llmModel: string;

  /** Timeout for embedding requests in ms */
  embeddingTimeout: number;

  /** Timeout for LLM requests in ms */
  llmTimeout: number;

  /** Embedding vector dimensions (must match the model) */
  embeddingDimensions: number;

  /** Minimum cosine similarity threshold for semantic search candidates */
  semanticScoreThreshold: number;
}

// ─── Load from Environment ───────────────────────────────────────

/**
 * Build AI configuration from environment variables.
 * All AI env vars are optional with safe defaults.
 */
function loadAIConfig(): AIConfig {
  return {
    enabled: env.AI_ENABLED,
    embeddingProvider: (env.AI_EMBEDDING_PROVIDER as 'ollama' | 'openai') || 'ollama',
    llmProvider: (env.AI_LLM_PROVIDER as 'ollama' | 'openai') || 'ollama',
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    embeddingModel: env.AI_EMBEDDING_MODEL,
    llmModel: env.AI_LLM_MODEL,
    embeddingTimeout: 10_000,
    llmTimeout: 30_000,
    embeddingDimensions: 768, // nomic-embed-text default; updated if model changes
    semanticScoreThreshold: 0.3,
  };
}

// ─── Singleton Export ────────────────────────────────────────────

export const aiConfig = loadAIConfig();
