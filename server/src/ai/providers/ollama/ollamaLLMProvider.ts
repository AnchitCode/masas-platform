/**
 * Ollama LLM Provider (Phase 9.0)
 *
 * Local text generation via Ollama's REST API.
 * Zero-cost, runs entirely on the developer's machine.
 *
 * Default model: phi3.5:3.8b-mini-instruct-q4_K_M (~2.5 GB RAM)
 *
 * IMPORTANT: LLM output is ALWAYS untrusted. This provider parses JSON
 * but does NOT validate it against any schema. Callers MUST validate
 * with Zod before using the output for any purpose.
 *
 * The LLM does NOT provide medical advice, medical corrections, or
 * authoritative pharmaceutical information. It produces candidates
 * that must be verified against the MedicineCatalog.
 */

import type { LLMProvider, LLMOptions } from '../../types.js';
import type { AIConfig } from '../../config.js';

export class OllamaLLMProvider implements LLMProvider {
  readonly name = 'ollama';
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly defaultTimeout: number;

  constructor(config: AIConfig) {
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.llmModel;
    this.defaultTimeout = config.llmTimeout;
  }

  /**
   * Generate a text response from a prompt.
   * Calls Ollama's /api/generate endpoint.
   */
  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    const timeout = options?.timeout ?? this.defaultTimeout;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.1,
          ...(options?.maxTokens ? { num_predict: options.maxTokens } : {}),
        },
        ...(options?.format === 'json' ? { format: 'json' } : {}),
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      throw new Error(`Ollama generate failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { response: string };

    if (typeof data.response !== 'string') {
      throw new Error('Ollama returned invalid response format');
    }

    return data.response;
  }

  /**
   * Generate a structured JSON response from a prompt.
   *
   * Sets Ollama's format: 'json' to constrain output to valid JSON.
   * Parses the response but does NOT validate against any schema.
   *
   * Callers MUST validate the returned object with Zod.
   */
  async generateJSON<T = unknown>(
    prompt: string,
    options?: Omit<LLMOptions, 'format'>,
  ): Promise<T> {
    const text = await this.generate(prompt, { ...options, format: 'json' });

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Ollama returned invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  /**
   * Check if Ollama is running and reachable.
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
}
