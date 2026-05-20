const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/apiError');
const logger = require('../../utils/logger');

/**
 * Admin service — business logic for platform administration.
 */
const adminService = {
  /**
   * Platform-wide statistics for the admin dashboard.
   * @returns {object} Aggregated counts and recent activity
   */
  async getStats() {
    const [
      totalUsers,
      totalPharmacies,
      pendingPharmacies,
      verifiedPharmacies,
      rejectedPharmacies,
      totalMedicines,
      totalInventoryItems,
      recentPharmacies,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.pharmacy.count(),
      prisma.pharmacy.count({ where: { status: 'PENDING' } }),
      prisma.pharmacy.count({ where: { status: 'VERIFIED' } }),
      prisma.pharmacy.count({ where: { status: 'REJECTED' } }),
      prisma.medicineCatalog.count(),
      prisma.pharmacyInventory.count(),
      prisma.pharmacy.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          status: true,
          createdAt: true,
          user: { select: { email: true } },
          _count: { select: { inventory: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      totalPharmacies,
      pendingPharmacies,
      verifiedPharmacies,
      rejectedPharmacies,
      totalMedicines,
      totalInventoryItems,
      recentPharmacies,
    };
  },

  /**
   * Paginated pharmacy list with optional status filter.
   * @param {{ status?: string, page: number, limit: number }} params
   * @returns {{ pharmacies: object[], total: number, page: number, limit: number }}
   */
  async listPharmacies({ status, page, limit }) {
    const where = status ? { status } : {};
    const offset = (page - 1) * limit;

    const [pharmacies, total] = await Promise.all([
      prisma.pharmacy.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          address: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { email: true } },
          _count: { select: { inventory: true } },
        },
      }),
      prisma.pharmacy.count({ where }),
    ]);

    return { pharmacies, total, page, limit };
  },

  /**
   * Full pharmacy detail for admin review.
   * @param {string} pharmacyId
   * @returns {object} Complete pharmacy record with user and inventory count
   */
  async getPharmacyDetail(pharmacyId) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
        _count: { select: { inventory: true } },
      },
    });

    if (!pharmacy) {
      throw ApiError.notFound('Pharmacy not found');
    }

    return pharmacy;
  },

  /**
   * Update pharmacy verification status.
   * Valid transitions:
   *   PENDING  → VERIFIED ✅
   *   PENDING  → REJECTED ✅
   *   REJECTED → VERIFIED ✅ (admin re-verifies)
   *   VERIFIED → REJECTED ✅ (admin revokes)
   *
   * @param {string} pharmacyId
   * @param {{ status: string, rejectionReason?: string }} data
   * @returns {object} Updated pharmacy record
   */
  async updatePharmacyStatus(pharmacyId, { status, rejectionReason }) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
    });

    if (!pharmacy) {
      throw ApiError.notFound('Pharmacy not found');
    }

    // Prevent no-op transitions
    if (pharmacy.status === status) {
      throw ApiError.badRequest(
        `Pharmacy is already ${status}. No status change needed.`
      );
    }

    // Log the transition (and optional reason) for audit trail
    logger.info('admin pharmacy status change', {
      pharmacyId,
      from: pharmacy.status,
      to: status,
      rejectionReason: rejectionReason || null,
    });

    const updated = await prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { status },
      select: {
        id: true,
        name: true,
        licenseNumber: true,
        status: true,
        updatedAt: true,
        user: { select: { email: true } },
      },
    });

    return updated;
  },
};

module.exports = adminService;
