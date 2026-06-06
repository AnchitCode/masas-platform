import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/apiError.js';
import type { CreatePharmacyInput, UpdatePharmacyInput } from './pharmacy.validation.js';

/**
 * Pharmacy service — business logic for pharmacy profile management.
 */
const pharmacyService = {
  /**
   * Create a new pharmacy profile for the authenticated user.
   * A user can only have one pharmacy.
   */
  async createProfile(userId: string, data: CreatePharmacyInput) {
    // Check if user already has a pharmacy
    const existing = await prisma.pharmacy.findUnique({
      where: { userId },
    });

    if (existing) {
      throw ApiError.conflict('You already have a pharmacy profile');
    }

    // Check if license number is already taken
    const licenseExists = await prisma.pharmacy.findUnique({
      where: { licenseNumber: data.licenseNumber },
    });

    if (licenseExists) {
      throw ApiError.conflict('A pharmacy with this license number already exists');
    }

    const pharmacy = await prisma.pharmacy.create({
      data: {
        userId,
        name: data.name,
        licenseNumber: data.licenseNumber,
        address: data.address,
        phone: data.phone,
        latitude: data.latitude,
        longitude: data.longitude,
        // status defaults to PENDING
      },
    });

    return pharmacy;
  },

  /**
   * Get the authenticated user's pharmacy profile.
   */
  async getOwnProfile(userId: string) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { userId },
      include: {
        _count: {
          select: { inventory: true },
        },
      },
    });

    if (!pharmacy) {
      throw ApiError.notFound('Pharmacy profile not found. Please create one first.');
    }

    return pharmacy;
  },

  /**
   * Update the authenticated user's pharmacy profile.
   * Cannot change licenseNumber after creation.
   */
  async updateProfile(userId: string, data: UpdatePharmacyInput) {
    // Ensure pharmacy exists and belongs to user
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { userId },
    });

    if (!pharmacy) {
      throw ApiError.notFound('Pharmacy profile not found');
    }

    // Re-verification: if a rejected pharmacy updates their profile,
    // automatically transition status back to PENDING for admin review.
    const updateData: Record<string, unknown> = { ...data };
    if (pharmacy.status === 'REJECTED') {
      updateData.status = 'PENDING';
    }

    const updated = await prisma.pharmacy.update({
      where: { id: pharmacy.id },
      data: updateData,
    });

    return updated;
  },

  /**
   * Get a pharmacy's public profile by ID.
   * Only returns verified pharmacies to the public.
   */
  async getPublicProfile(pharmacyId: string) {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: pharmacyId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,
        _count: {
          select: { inventory: true },
        },
      },
    });

    if (!pharmacy) {
      throw ApiError.notFound('Pharmacy not found');
    }

    return pharmacy;
  },
};

export default pharmacyService;
