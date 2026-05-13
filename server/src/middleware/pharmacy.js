const prisma = require('../lib/prisma');
const ApiError = require('../utils/apiError');

/**
 * Middleware to ensure the authenticated user is a VERIFIED pharmacy.
 * Must be used AFTER auth and authorize('PHARMACY').
 * Attaches req.pharmacyId for downstream controllers.
 */
const requireVerifiedPharmacy = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'PHARMACY') {
      throw ApiError.forbidden('Only pharmacies can perform this action');
    }

    const pharmacy = await prisma.pharmacy.findUnique({
      where: { userId: req.user.userId },
    });

    if (!pharmacy) {
      throw ApiError.forbidden('Pharmacy profile not found. Please complete your profile first.');
    }

    if (pharmacy.status !== 'VERIFIED') {
      throw ApiError.forbidden(`Your pharmacy profile is currently ${pharmacy.status}. Only VERIFIED pharmacies can manage inventory.`);
    }

    // Attach pharmacy ID to request for convenience in downstream controllers
    req.pharmacyId = pharmacy.id;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  requireVerifiedPharmacy,
};
