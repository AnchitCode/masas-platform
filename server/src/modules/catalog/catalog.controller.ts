import type { Request, Response, NextFunction } from 'express';
import { searchMedicines } from './catalog.service.js';
import { createSuccessResponse } from '../../utils/response.js';

/**
 * Handle GET /search
 */
const searchMedicinesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(200).json(
        createSuccessResponse('Empty query', { medicines: [] })
      );
    }

    const medicines = await searchMedicines(q as string);

    res.status(200).json(
      createSuccessResponse('Medicines retrieved', { medicines })
    );
  } catch (error) {
    next(error);
  }
};

export { searchMedicinesController as searchMedicines };
