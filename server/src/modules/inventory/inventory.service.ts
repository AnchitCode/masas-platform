import prisma from '../../lib/prisma.js';
import ApiError from '../../utils/apiError.js';
import { eventBus } from '../../lib/eventBus.js';
import type { AddInventoryInput } from './inventory.validation.js';

/**
 * Get all inventory items for a specific pharmacy
 */
const getInventory = async (pharmacyId: string) => {
  return await prisma.pharmacyInventory.findMany({
    where: { pharmacyId },
    include: {
      medicine: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
};

/**
 * Add an item to the pharmacy's inventory.
 * Checks if medicine exists in catalog; if not, creates it.
 */
const addInventory = async (pharmacyId: string, data: AddInventoryInput) => {
  const { medicineName, genericName, manufacturer, category, dosageForm, price, quantity, expiryDate, isAvailable, lowStockThreshold } = data;
  const nameLower = medicineName.toLowerCase().trim();

  // 1. Find or Create Medicine in Catalog
  let medicine = await prisma.medicineCatalog.findFirst({
    where: { name: nameLower },
  });

  if (!medicine) {
    medicine = await prisma.medicineCatalog.create({
      data: {
        name: nameLower,
        genericName,
        manufacturer,
        category,
        dosageForm,
      },
    });

    // Phase 9.1c: Trigger background embedding generation for the new medicine
    eventBus.emit('catalog.created', {
      medicineId: medicine.id,
      name: medicine.name,
    });
  }

  // 2. Check if pharmacy already has this medicine in inventory
  const existingInventory = await prisma.pharmacyInventory.findUnique({
    where: {
      pharmacyId_medicineId: {
        pharmacyId,
        medicineId: medicine.id,
      },
    },
  });

  if (existingInventory) {
    throw ApiError.conflict('This medicine is already in your inventory. Update the existing entry instead.');
  }

  // 3. Create Pharmacy Inventory Record
  const created = await prisma.pharmacyInventory.create({
    data: {
      pharmacyId,
      medicineId: medicine.id,
      price,
      quantity,
      expiryDate: expiryDate || null,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      lowStockThreshold: lowStockThreshold ?? 10,
    },
    include: {
      medicine: true,
    },
  });

  // Emit event — listeners (Socket.io, notifications) handle side effects
  eventBus.emit('inventory.created', {
    inventoryId: created.id,
    pharmacyId,
    medicineId: created.medicineId,
    medicineName: created.medicine.name,
    quantity: created.quantity,
    lowStockThreshold: created.lowStockThreshold,
  });

  return created;
};

/**
 * Update an inventory item
 */
const updateInventory = async (pharmacyId: string, inventoryId: string, data: Record<string, unknown>) => {
  // Ensure the inventory item exists and belongs to the pharmacy
  const existing = await prisma.pharmacyInventory.findFirst({
    where: { id: inventoryId, pharmacyId },
  });

  if (!existing) {
    throw ApiError.notFound('Inventory item not found');
  }

  // Auto-update availability based on quantity if not explicitly provided
  const updateData = { ...data };
  if (updateData.expiryDate === '') {
    updateData.expiryDate = null;
  }
  if (updateData.quantity !== undefined && data.isAvailable === undefined) {
    updateData.isAvailable = (updateData.quantity as number) > 0;
  }

  const updated = await prisma.pharmacyInventory.update({
    where: { id: inventoryId },
    data: updateData,
    include: {
      medicine: true,
    },
  });

  // Emit event — previousQuantity from existing (base fields), medicineName from updated (includes medicine)
  eventBus.emit('inventory.updated', {
    inventoryId: updated.id,
    pharmacyId,
    medicineId: updated.medicineId,
    medicineName: updated.medicine.name,
    quantity: updated.quantity,
    previousQuantity: existing.quantity,
    lowStockThreshold: updated.lowStockThreshold,
  });

  return updated;
};

/**
 * Delete an inventory item
 */
const deleteInventory = async (pharmacyId: string, inventoryId: string) => {
  const existing = await prisma.pharmacyInventory.findFirst({
    where: { id: inventoryId, pharmacyId },
  });

  if (!existing) {
    throw ApiError.notFound('Inventory item not found');
  }

  const deleted = await prisma.pharmacyInventory.delete({
    where: { id: inventoryId },
  });

  // Emit event — only base fields from existing (no include, so no medicineName)
  eventBus.emit('inventory.deleted', {
    inventoryId: existing.id,
    pharmacyId,
    medicineId: existing.medicineId,
  });

  return deleted;
};

export {
  getInventory,
  addInventory,
  updateInventory,
  deleteInventory,
};
