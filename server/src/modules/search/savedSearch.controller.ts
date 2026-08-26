import type { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '../../utils/response.js';
import * as savedSearchService from './savedSearch.service.js';
import type { CreateSavedSearchInput, UpdateSavedSearchInput } from './savedSearch.validation.js';
import type { AuthenticatedRequest } from '../../types/index.js';

export const createSavedSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = req.body as CreateSavedSearchInput;
    
    const savedSearch = await savedSearchService.createSavedSearch(authReq.user!.userId, data);
    
    res.status(201).json(
      createSuccessResponse('Saved search created successfully', savedSearch)
    );
  } catch (error) {
    next(error);
  }
};

export const listSavedSearches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    const savedSearches = await savedSearchService.getSavedSearchesByUser(authReq.user!.userId);
    
    res.status(200).json(
      createSuccessResponse('Saved searches retrieved successfully', savedSearches)
    );
  } catch (error) {
    next(error);
  }
};

export const getSavedSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;
    
    const savedSearch = await savedSearchService.getSavedSearchById(id, authReq.user!.userId);
    
    res.status(200).json(
      createSuccessResponse('Saved search retrieved successfully', savedSearch)
    );
  } catch (error) {
    next(error);
  }
};

export const updateSavedSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const data = req.body as UpdateSavedSearchInput;
    
    const savedSearch = await savedSearchService.updateSavedSearch(id, authReq.user!.userId, data);
    
    res.status(200).json(
      createSuccessResponse('Saved search updated successfully', savedSearch)
    );
  } catch (error) {
    next(error);
  }
};

export const deleteSavedSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const id = req.params.id as string;
    
    await savedSearchService.deleteSavedSearch(id, authReq.user!.userId);
    
    res.status(200).json(
      createSuccessResponse('Saved search deleted successfully')
    );
  } catch (error) {
    next(error);
  }
};
