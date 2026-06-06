import type { Request, Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service.js';
import { createSuccessResponse } from '../../utils/response.js';
import type { PharmacyRequest } from '../../types/index.js';

const getInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const inventory = await inventoryService.getInventory(pharmacyReq.pharmacyId);
    res.status(200).json(createSuccessResponse('Inventory retrieved', { inventory }));
  } catch (error) {
    next(error);
  }
};

const addInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const inventoryItem = await inventoryService.addInventory(pharmacyReq.pharmacyId, req.body);
    res.status(201).json(createSuccessResponse('Medicine added to inventory', { inventoryItem }));
  } catch (error) {
    next(error);
  }
};

const updateInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    const inventoryItem = await inventoryService.updateInventory(pharmacyReq.pharmacyId, req.params.id as string, req.body);
    res.status(200).json(createSuccessResponse('Inventory updated successfully', { inventoryItem }));
  } catch (error) {
    next(error);
  }
};

const deleteInventory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pharmacyReq = req as PharmacyRequest;
    await inventoryService.deleteInventory(pharmacyReq.pharmacyId, req.params.id as string);
    res.status(200).json(createSuccessResponse('Inventory item removed successfully'));
  } catch (error) {
    next(error);
  }
};

export {
  getInventory,
  addInventory,
  updateInventory,
  deleteInventory,
};
