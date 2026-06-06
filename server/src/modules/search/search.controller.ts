import type { Request, Response, NextFunction } from 'express';
import { searchPublicInventory } from './search.service.js';
import { createSuccessResponse } from '../../utils/response.js';

/**
 * GET /inventory — public location-based inventory search
 */
const searchInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = await searchPublicInventory(req.query as Record<string, unknown> as Parameters<typeof searchPublicInventory>[0]);
    res.status(200).json(
      createSuccessResponse('Search completed', payload)
    );
  } catch (error) {
    next(error);
  }
};

export {
  searchInventory,
};
