/**
 * Prescription Service (Phase 9.2e)
 *
 * Client-side service for uploading prescription images and
 * receiving extracted medicine names with catalog matches.
 */
import api from './api';
import type { PrescriptionExtractionResponse } from '../types';

const prescriptionService = {
  /**
   * Upload a prescription image and extract medicine names.
   *
   * @param file - The prescription image file (JPEG, PNG, or WebP, max 5 MB)
   * @returns Extraction response with OCR text, candidates, and matches
   */
  extractMedicines: async (file: File): Promise<PrescriptionExtractionResponse> => {
    const formData = new FormData();
    formData.append('prescription', file);

    const response = await api.post('/prescription/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60_000, // 60s timeout — OCR + LLM can take up to 18s
    });

    return response.data.data;
  },
};

export default prescriptionService;
