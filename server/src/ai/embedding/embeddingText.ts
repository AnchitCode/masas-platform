/**
 * Canonical Embedding Text Builder (Phase 9.1c)
 *
 * Converts a MedicineCatalog record into a deterministic text representation
 * used for embedding generation. This text is what the embedding model
 * "sees" — it must capture the searchable semantics of the medicine.
 *
 * CANONICAL TEXT DESIGN:
 *   Fields included (and why):
 *     - name:        Primary search target. Users search by brand/trade name.
 *     - genericName: Users often search by generic (e.g., "acetaminophen").
 *                    Also enables cross-brand matching (Dolo 650 ↔ Paracetamol).
 *     - category:    Enables concept search (e.g., "antibiotic", "pain relief").
 *     - dosageForm:  Disambiguates "tablet" vs "syrup" vs "injection" queries.
 *
 *   Fields excluded (and why):
 *     - manufacturer: Rarely searched by patients. Adds noise to embeddings.
 *     - id:          Not semantically meaningful.
 *     - createdAt/updatedAt: Not semantically meaningful.
 *     - embedding:   The output — not input.
 *
 * STALE EMBEDDING DETECTION:
 *   The same function produces a deterministic text for any given set of fields.
 *   An `embeddingHash` (SHA-256 of the canonical text) is stored alongside
 *   the embedding. When catalog fields change, the hash changes, marking
 *   the embedding as stale without needing to re-run inference to check.
 *
 * FORMAT:
 *   Fields are joined with ". " (period-space) separators — this gives
 *   transformer models natural sentence boundaries for better attention.
 */

import { createHash } from 'crypto';

// ─── Input Type ──────────────────────────────────────────────────
// Only the fields that contribute to the embedding text.
// This is intentionally NOT the full MedicineCatalog — we depend only
// on the fields we use, not the entire model.

export interface EmbeddingTextInput {
  name: string;
  genericName: string | null;
  category: string | null;
  dosageForm: string | null;
}

// ─── Build Canonical Text ────────────────────────────────────────

/**
 * Build the canonical text representation of a medicine for embedding.
 *
 * @param med - Medicine catalog fields relevant to search
 * @returns The canonical text string that will be passed to the embedding model
 *
 * @example
 *   buildEmbeddingText({ name: 'paracetamol 500mg', genericName: 'Acetaminophen', category: 'Analgesic', dosageForm: 'Tablet' })
 *   // => "paracetamol 500mg. Generic: Acetaminophen. Category: Analgesic. Form: Tablet"
 */
export function buildEmbeddingText(med: EmbeddingTextInput): string {
  const parts: string[] = [med.name];

  if (med.genericName) {
    parts.push(`Generic: ${med.genericName}`);
  }
  if (med.category) {
    parts.push(`Category: ${med.category}`);
  }
  if (med.dosageForm) {
    parts.push(`Form: ${med.dosageForm}`);
  }

  return parts.join('. ');
}

// ─── Embedding Hash ──────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of the canonical text.
 *
 * This hash is stored in the database alongside the embedding vector.
 * When catalog fields change, the hash of the new canonical text will
 * differ from the stored hash — indicating the embedding is stale.
 *
 * @param text - The canonical text (from buildEmbeddingText)
 * @returns Hex-encoded SHA-256 hash
 */
export function computeEmbeddingHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Convenience: build canonical text AND compute its hash in one call.
 *
 * @param med - Medicine catalog fields
 * @returns { text, hash } — the canonical text and its SHA-256 hash
 */
export function buildEmbeddingTextAndHash(med: EmbeddingTextInput): { text: string; hash: string } {
  const text = buildEmbeddingText(med);
  const hash = computeEmbeddingHash(text);
  return { text, hash };
}
