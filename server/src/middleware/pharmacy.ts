import type { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import ApiError from '../utils/apiError.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Middleware to ensure the authenticated user is a VERIFIED pharmacy.
 * Must be used AFTER auth and authorize('PHARMACY').
 * Attaches req.pharmacyId for downstream controllers.
 */
const requireVerifiedPharmacy = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || authReq.user.role !== 'PHARMACY') {
      throw ApiError.forbidden('Only pharmacies can perform this action');
    }

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { userId: authReq.user.userId },
    });

    if (!pharmacy) {
      throw ApiError.forbidden('Pharmacy profile not found. Please complete your profile first.');
    }

    if (pharmacy.status !== 'VERIFIED') {
      throw ApiError.forbidden(`Your pharmacy profile is currently ${pharmacy.status}. Only VERIFIED pharmacies can manage inventory.`);
    }

    // Attach pharmacy ID to request for convenience in downstream controllers
    (req as unknown as Record<string, unknown>).pharmacyId = pharmacy.id;
    next();
  } catch (error) {
    next(error);
  }
};

export {
  requireVerifiedPharmacy,
};
