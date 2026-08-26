import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/apiError.js';
import type { CreateSavedSearchInput, UpdateSavedSearchInput } from './savedSearch.validation.js';

export const createSavedSearch = async (
  userId: string,
  data: CreateSavedSearchInput
) => {
  const savedSearch = await prisma.savedSearch.create({
    data: {
      userId,
      query: data.query,
      latitude: data.latitude,
      longitude: data.longitude,
      radiusKm: data.radiusKm,
      isActive: data.isActive,
    },
  });

  return savedSearch;
};

export const getSavedSearchesByUser = async (userId: string) => {
  const savedSearches = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return savedSearches;
};

export const getSavedSearchById = async (id: string, userId: string) => {
  const savedSearch = await prisma.savedSearch.findFirst({
    where: { id, userId },
  });

  if (!savedSearch) {
    throw ApiError.notFound('Saved search not found');
  }

  return savedSearch;
};

export const updateSavedSearch = async (
  id: string,
  userId: string,
  data: UpdateSavedSearchInput
) => {
  // First, verify ownership via findFirst
  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw ApiError.notFound('Saved search not found');
  }

  const updatedSearch = await prisma.savedSearch.update({
    where: { id },
    data,
  });

  return updatedSearch;
};

export const deleteSavedSearch = async (id: string, userId: string) => {
  // Verify ownership via findFirst
  const existing = await prisma.savedSearch.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw ApiError.notFound('Saved search not found');
  }

  await prisma.savedSearch.delete({
    where: { id },
  });

  return true;
};
