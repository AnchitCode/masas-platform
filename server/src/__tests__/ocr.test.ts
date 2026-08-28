/**
 * OCR Service Tests (Phase 9.2a)
 *
 * Tests the Tesseract.js OCR service that extracts text from prescription images.
 * Uses synthetic test images to avoid depending on external files.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCanvas } from 'canvas';
import { extractText, terminateOCRWorker } from '../ai/ocr/ocrService.js';
import { aiConfig } from '../ai/config.js';

/**
 * Generate a synthetic prescription image (PNG buffer) with printed text.
 * Uses node-canvas to render text onto a white background.
 */
function generateTestPrescriptionImage(lines: string[]): Buffer {
  const width = 600;
  const lineHeight = 30;
  const padding = 40;
  const height = padding * 2 + lines.length * lineHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Black text
  ctx.fillStyle = '#000000';
  ctx.font = '20px Arial';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, padding + i * lineHeight + 20);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate a blank white image.
 */
function generateBlankImage(): Buffer {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 200, 200);
  return canvas.toBuffer('image/png');
}

// Save original AI config state
const originalEnabled = aiConfig.enabled;

describe('OCR Service (Phase 9.2a)', () => {
  afterAll(async () => {
    // Restore original state and clean up worker
    (aiConfig as { enabled: boolean }).enabled = originalEnabled;
    await terminateOCRWorker();
  });

  describe('with AI enabled', () => {
    beforeAll(() => {
      (aiConfig as { enabled: boolean }).enabled = true;
    });

    it('extracts text from a clear printed prescription image', async () => {
      const image = generateTestPrescriptionImage([
        'Dr. Smith Medical Clinic',
        'Patient: John Doe',
        'Paracetamol 500mg',
        'Amoxicillin 250mg',
        'Omeprazole 20mg',
      ]);

      const result = await extractText(image);

      expect(result.error).toBeUndefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);

      // Check that at least some medicine names were recognized
      // (Tesseract OCR on canvas-rendered text may not be perfect, but should get some)
      const textLower = result.text.toLowerCase();
      const hasAnyMedicine =
        textLower.includes('paracetamol') ||
        textLower.includes('amoxicillin') ||
        textLower.includes('omeprazole');
      expect(hasAnyMedicine).toBe(true);
    }, 60_000); // 60s timeout for cold start + OCR

    it('returns empty text for a blank image without crashing', async () => {
      const blankImage = generateBlankImage();
      const result = await extractText(blankImage);

      // Should not throw, should return a result
      expect(result).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      // Text may be empty or contain only whitespace
      expect(result.text.trim().length).toBeLessThan(10);
    }, 30_000);

    it('returns error for empty buffer', async () => {
      const result = await extractText(Buffer.alloc(0));

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.error).toBe('Empty image buffer');
    });

    it('returns result with correct shape', async () => {
      const image = generateTestPrescriptionImage(['Test Medicine']);
      const result = await extractText(image);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('latencyMs');
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.latencyMs).toBe('number');
    }, 30_000);
  });

  describe('with AI disabled', () => {
    it('returns empty result immediately when AI is disabled', async () => {
      (aiConfig as { enabled: boolean }).enabled = false;

      const image = generateTestPrescriptionImage(['Paracetamol']);
      const result = await extractText(image);

      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.latencyMs).toBe(0);
      expect(result.error).toBe('AI is disabled');
    });
  });
});
