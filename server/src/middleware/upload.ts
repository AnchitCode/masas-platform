/**
 * File Upload Middleware (Phase 9.2d)
 *
 * Multer middleware configured with memory storage (no disk writes).
 * Used for prescription image uploads.
 *
 * Security:
 *   - Memory storage only — image buffer is never written to disk
 *   - MIME type whitelist: JPEG, PNG, WebP
 *   - Max file size: 5 MB
 *   - Single file per request
 */

import multer from 'multer';
import type { Request } from 'express';
import type { FileFilterCallback } from 'multer';

// ─── Configuration ──────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// ─── File Filter ────────────────────────────────────────────────

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP`));
  }
}

// ─── Multer Instance ────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(), // No disk writes
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter,
});

// ─── Exports ────────────────────────────────────────────────────

/**
 * Middleware for single prescription image upload.
 * The file is accessible via `req.file` after this middleware runs.
 * The buffer is in `req.file.buffer` — it must be discarded after processing.
 */
export const uploadPrescription = upload.single('prescription');
