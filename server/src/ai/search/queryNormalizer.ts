/**
 * Hinglish Query Normalizer (Phase 9.1d)
 *
 * Deterministic, phrase-aware preprocessing layer that normalizes
 * Hinglish (Hindi written in Latin/English characters) pharmaceutical
 * queries into English before embedding.
 *
 * Pipeline:
 *   user query → normalizeQuery() → normalized query → embedding model
 *
 * Design principles:
 *   1. Small, focused vocabulary — not a general-purpose translator
 *   2. Phrase-first matching — "sir dard" matches before "sir" or "dard"
 *   3. Deterministic — same input always produces same output
 *   4. Expandable — add terms based on actual search data later
 *   5. No external dependencies — pure string manipulation
 *
 * SCOPE:
 *   - Hinglish in Latin/English characters only
 *   - Hindi Devanagari is OUT OF SCOPE for Phase 9
 */

// ─── Phrase Map (multi-word, matched first) ──────────────────────
// Ordered longest-first for greedy matching.
// Each entry: [hinglishPhrase, englishTranslation]

const PHRASE_MAP: ReadonlyArray<readonly [string, string]> = [
  // Body part + symptom compounds
  ['sir dard', 'headache'],
  ['sar dard', 'headache'],
  ['pet dard', 'stomach pain'],
  ['kamar dard', 'back pain'],
  ['gale ki', 'throat'],
  ['gala kharab', 'sore throat'],

  // Common compound queries
  ['dard ki dawa', 'pain medicine'],
  ['bukhar ki dawa', 'fever medicine'],
  ['bukhar ki tablet', 'fever tablet'],
  ['sir dard ki medicine', 'headache medicine'],
  ['sir dard ki dawa', 'headache medicine'],
  ['sir dard ki tablet', 'headache tablet'],
  ['pet dard ki tablet', 'stomach pain tablet'],
  ['pet dard ki dawa', 'stomach pain medicine'],
  ['allergy ki medicine', 'allergy medicine'],
  ['allergy ki dawa', 'allergy medicine'],
  ['allergy ki tablet', 'allergy tablet'],
  ['infection ki dawa', 'infection medicine'],
  ['infection ki tablet', 'infection tablet'],
  ['khasi ki dawa', 'cough medicine'],
  ['khansi ki dawa', 'cough medicine'],
  ['zukam ki dawa', 'cold medicine'],
  ['gas ki tablet', 'gas tablet'],
  ['acidity ki tablet', 'acidity tablet'],
] as const;

// ─── Word Map (single-word replacements, applied after phrases) ──

const WORD_MAP: ReadonlyMap<string, string> = new Map([
  // Symptoms
  ['dard', 'pain'],
  ['bukhar', 'fever'],
  ['khasi', 'cough'],
  ['khansi', 'cough'],
  ['zukam', 'cold'],
  ['sujan', 'swelling'],
  ['jalan', 'burning'],

  // Body parts
  ['sir', 'head'],
  ['sar', 'head'],
  ['pet', 'stomach'],
  ['kamar', 'back'],
  ['gala', 'throat'],

  // Medicine-related
  ['dawa', 'medicine'],
  ['dawai', 'medicine'],
  ['goli', 'tablet'],
  ['syrup', 'syrup'],    // Already English, but included for completeness

  // Connectors (removed — they don't add semantic value for search)
  ['ki', ''],
  ['ka', ''],
  ['ke', ''],
]);

// ─── Normalizer ──────────────────────────────────────────────────

/**
 * Normalize a search query by replacing Hinglish pharmaceutical terms
 * with their English equivalents.
 *
 * Strategy:
 *   1. Lowercase and trim
 *   2. Try phrase matches first (longest match wins)
 *   3. Replace remaining individual Hinglish words
 *   4. Collapse whitespace
 *
 * If no Hinglish terms are found, the query passes through unchanged.
 *
 * @param query - Raw user search query
 * @returns Normalized English query
 *
 * @example
 *   normalizeQuery("dard ki dawa")         // → "pain medicine"
 *   normalizeQuery("sir dard ki medicine") // → "headache medicine"
 *   normalizeQuery("bukhar ki dawa")       // → "fever medicine"
 *   normalizeQuery("pet dard ki tablet")   // → "stomach pain tablet"
 *   normalizeQuery("headache medicine")    // → "headache medicine" (passthrough)
 *   normalizeQuery("Paracetamol")          // → "paracetamol" (lowercased only)
 */
export function normalizeQuery(query: string): string {
  if (!query || query.trim() === '') {
    return '';
  }

  let normalized = query.toLowerCase().trim();

  // Phase 1: Phrase matching (longest first)
  // Sort by phrase length descending for greedy matching
  const sortedPhrases = [...PHRASE_MAP].sort((a, b) => b[0].length - a[0].length);

  for (const [hinglish, english] of sortedPhrases) {
    // Use word boundary-aware replacement to avoid partial matches
    const regex = new RegExp(`\\b${escapeRegex(hinglish)}\\b`, 'gi');
    normalized = normalized.replace(regex, english);
  }

  // Phase 2: Word-level replacement for remaining Hinglish terms
  const words = normalized.split(/\s+/);
  const replaced = words.map((word) => {
    const mapped = WORD_MAP.get(word);
    if (mapped !== undefined) {
      return mapped; // Empty string for connectors like "ki"
    }
    return word;
  });

  // Phase 3: Collapse whitespace and trim
  return replaced.filter((w) => w !== '').join(' ').trim();
}

// ─── Utility ─────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Exports for Testing ─────────────────────────────────────────

/** Exposed for testing only — not part of the public API */
export const _testing = {
  PHRASE_MAP,
  WORD_MAP,
} as const;
