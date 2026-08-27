/**
 * Hinglish Query Normalizer Tests (Phase 9.1d)
 */

import { describe, it, expect } from 'vitest';
import { normalizeQuery, _testing } from '../ai/search/queryNormalizer.js';

describe('Query Normalizer', () => {
  // ─── Required Hinglish Examples ────────────────────────────────

  describe('Hinglish phrase normalization', () => {
    it('normalizes "dard ki dawa" → "pain medicine"', () => {
      expect(normalizeQuery('dard ki dawa')).toBe('pain medicine');
    });

    it('normalizes "sir dard ki medicine" → "headache medicine"', () => {
      expect(normalizeQuery('sir dard ki medicine')).toBe('headache medicine');
    });

    it('normalizes "bukhar ki dawa" → "fever medicine"', () => {
      expect(normalizeQuery('bukhar ki dawa')).toBe('fever medicine');
    });

    it('normalizes "pet dard ki tablet" → "stomach pain tablet"', () => {
      expect(normalizeQuery('pet dard ki tablet')).toBe('stomach pain tablet');
    });
  });

  // ─── Additional Hinglish Variants ──────────────────────────────

  describe('additional Hinglish phrases', () => {
    it('normalizes "sir dard ki dawa" → "headache medicine"', () => {
      expect(normalizeQuery('sir dard ki dawa')).toBe('headache medicine');
    });

    it('normalizes "allergy ki medicine" → "allergy medicine"', () => {
      expect(normalizeQuery('allergy ki medicine')).toBe('allergy medicine');
    });

    it('normalizes "infection ki dawa" → "infection medicine"', () => {
      expect(normalizeQuery('infection ki dawa')).toBe('infection medicine');
    });

    it('normalizes "khasi ki dawa" → "cough medicine"', () => {
      expect(normalizeQuery('khasi ki dawa')).toBe('cough medicine');
    });

    it('normalizes "pet dard ki dawa" → "stomach pain medicine"', () => {
      expect(normalizeQuery('pet dard ki dawa')).toBe('stomach pain medicine');
    });
  });

  // ─── English Passthrough ───────────────────────────────────────

  describe('English passthrough', () => {
    it('passes through normal English query unchanged', () => {
      expect(normalizeQuery('headache medicine')).toBe('headache medicine');
    });

    it('passes through brand name unchanged (lowercased)', () => {
      expect(normalizeQuery('Paracetamol')).toBe('paracetamol');
    });

    it('passes through generic name unchanged', () => {
      expect(normalizeQuery('acetaminophen')).toBe('acetaminophen');
    });

    it('passes through compound English query', () => {
      expect(normalizeQuery('pain relief tablet')).toBe('pain relief tablet');
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty string for empty query', () => {
      expect(normalizeQuery('')).toBe('');
    });

    it('returns empty string for whitespace-only query', () => {
      expect(normalizeQuery('   ')).toBe('');
    });

    it('is case-insensitive', () => {
      expect(normalizeQuery('DARD KI DAWA')).toBe('pain medicine');
      expect(normalizeQuery('Bukhar Ki Dawa')).toBe('fever medicine');
    });

    it('handles extra whitespace', () => {
      expect(normalizeQuery('  dard  ki  dawa  ')).toBe('pain medicine');
    });

    it('handles unknown Hinglish terms as passthrough', () => {
      // "namak" is not in the vocabulary — passes through
      expect(normalizeQuery('namak ki tablet')).toBe('namak tablet');
    });

    it('handles mixed Hinglish/English', () => {
      // "bukhar" is known, "antibiotic" is English
      expect(normalizeQuery('bukhar antibiotic')).toBe('fever antibiotic');
    });

    it('removes Hindi connectors (ki/ka/ke)', () => {
      expect(normalizeQuery('test ki result')).toBe('test result');
    });
  });

  // ─── Phrase vs Word Priority ───────────────────────────────────

  describe('phrase-first matching', () => {
    it('matches "sir dard" as a phrase (headache), not "sir" + "dard"', () => {
      const result = normalizeQuery('sir dard');
      expect(result).toBe('headache');
      // If word-level matched: "head pain" — which is wrong for the compound
    });

    it('matches "pet dard" as a phrase (stomach pain)', () => {
      const result = normalizeQuery('pet dard');
      expect(result).toBe('stomach pain');
    });

    it('matches word-level "dard" alone as "pain"', () => {
      expect(normalizeQuery('dard')).toBe('pain');
    });
  });

  // ─── Vocabulary Structure ──────────────────────────────────────

  describe('vocabulary structure', () => {
    it('has phrase map with entries', () => {
      expect(_testing.PHRASE_MAP.length).toBeGreaterThan(0);
    });

    it('has word map with entries', () => {
      expect(_testing.WORD_MAP.size).toBeGreaterThan(0);
    });

    it('phrase map entries are lowercase', () => {
      for (const [hinglish] of _testing.PHRASE_MAP) {
        expect(hinglish).toBe(hinglish.toLowerCase());
      }
    });
  });
});
