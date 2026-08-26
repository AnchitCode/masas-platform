import { Router } from 'express';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import * as controller from './savedSearch.controller.js';
import { 
  createSavedSearchSchema, 
  updateSavedSearchSchema, 
  savedSearchIdSchema 
} from './savedSearch.validation.js';

const router = Router();

// Apply auth and CUSTOMER role authorization to all saved-search routes
router.use(auth, authorize('CUSTOMER'));

/**
 * @swagger
 * tags:
 *   name: SavedSearches
 *   description: Saved searches management for CUSTOMER users
 */

/**
 * @swagger
 * /api/v1/saved-searches:
 *   post:
 *     summary: Create a new saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *               - latitude
 *               - longitude
 *             properties:
 *               query:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               radiusKm:
 *                 type: number
 *                 default: 5
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Saved search created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not a CUSTOMER)
 */
router.post('/', validate(createSavedSearchSchema), controller.createSavedSearch);

/**
 * @swagger
 * /api/v1/saved-searches:
 *   get:
 *     summary: List all saved searches for the authenticated user
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved searches
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', controller.listSavedSearches);

/**
 * @swagger
 * /api/v1/saved-searches/{id}:
 *   get:
 *     summary: Get a specific saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Saved search retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Saved search not found
 */
router.get('/:id', validate(savedSearchIdSchema, 'params'), controller.getSavedSearch);

/**
 * @swagger
 * /api/v1/saved-searches/{id}:
 *   patch:
 *     summary: Update a saved search (e.g. toggle isActive)
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               radiusKm:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Saved search updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Saved search not found
 */
router.patch('/:id', validate(savedSearchIdSchema, 'params'), validate(updateSavedSearchSchema), controller.updateSavedSearch);

/**
 * @swagger
 * /api/v1/saved-searches/{id}:
 *   delete:
 *     summary: Delete a saved search
 *     tags: [SavedSearches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Saved search deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Saved search not found
 */
router.delete('/:id', validate(savedSearchIdSchema, 'params'), controller.deleteSavedSearch);

export default router;
