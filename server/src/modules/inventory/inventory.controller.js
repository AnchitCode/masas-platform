const inventoryService = require('./inventory.service');
const { createSuccessResponse } = require('../../utils/response');

const getInventory = async (req, res, next) => {
  try {
    const inventory = await inventoryService.getInventory(req.pharmacyId);
    res.status(200).json(createSuccessResponse('Inventory retrieved', { inventory }));
  } catch (error) {
    next(error);
  }
};

const addInventory = async (req, res, next) => {
  try {
    const inventoryItem = await inventoryService.addInventory(req.pharmacyId, req.body);
    res.status(201).json(createSuccessResponse('Medicine added to inventory', { inventoryItem }));
  } catch (error) {
    next(error);
  }
};

const updateInventory = async (req, res, next) => {
  try {
    const inventoryItem = await inventoryService.updateInventory(req.pharmacyId, req.params.id, req.body);
    res.status(200).json(createSuccessResponse('Inventory updated successfully', { inventoryItem }));
  } catch (error) {
    next(error);
  }
};

const deleteInventory = async (req, res, next) => {
  try {
    await inventoryService.deleteInventory(req.pharmacyId, req.params.id);
    res.status(200).json(createSuccessResponse('Inventory item removed successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  addInventory,
  updateInventory,
  deleteInventory,
};
