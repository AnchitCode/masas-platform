const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/apiError');

/**
 * Get all inventory items for a specific pharmacy
 */
const getInventory = async (pharmacyId) => {
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
const addInventory = async (pharmacyId, data) => {
  const { medicineName, genericName, manufacturer, category, dosageForm, price, quantity, expiryDate, isAvailable } = data;
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
  return await prisma.pharmacyInventory.create({
    data: {
      pharmacyId,
      medicineId: medicine.id,
      price,
      quantity,
      expiryDate: expiryDate || null,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    },
    include: {
      medicine: true,
    },
  });
};

/**
 * Update an inventory item
 */
const updateInventory = async (pharmacyId, inventoryId, data) => {
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
    updateData.isAvailable = updateData.quantity > 0;
  }

  return await prisma.pharmacyInventory.update({
    where: { id: inventoryId },
    data: updateData,
    include: {
      medicine: true,
    },
  });
};

/**
 * Delete an inventory item
 */
const deleteInventory = async (pharmacyId, inventoryId) => {
  const existing = await prisma.pharmacyInventory.findFirst({
    where: { id: inventoryId, pharmacyId },
  });

  if (!existing) {
    throw ApiError.notFound('Inventory item not found');
  }

  return await prisma.pharmacyInventory.delete({
    where: { id: inventoryId },
  });
};

module.exports = {
  getInventory,
  addInventory,
  updateInventory,
  deleteInventory,
};
