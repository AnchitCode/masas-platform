/**
 * Prescription Routes (Phase 9.2d)
 *
 * POST /api/v1/prescription/extract
 *   - Requires authentication (JWT)
 *   - Accepts multipart/form-data with a 'prescription' image field
 *   - Returns extracted medicine names with catalog matches
 */

import { Router } from 'express';
import auth from '../../middleware/auth.js';
import { uploadPrescription } from '../../middleware/upload.js';
import { extractPrescription } from './prescription.controller.js';
import type { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

const router = Router();

/**
 * Error handler for Multer-specific errors (file too large, wrong type, etc.)
 * Converts Multer errors to user-friendly 400 responses.
 */
function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5 MB.',
      });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        message: 'Unexpected file field. Use "prescription" as the field name.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
    return;
  }

  // Handle file filter errors (invalid MIME type)
  if (err.message && err.message.startsWith('Invalid file type:')) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  next(err);
}

// POST /api/v1/prescription/extract
router.post(
  '/extract',
  auth,
  uploadPrescription,
  handleMulterError,
  extractPrescription,
);

export default router;
