import { Router } from 'express';
import validate from '../../middleware/validate.js';
import { searchInventory } from './search.controller.js';
import { searchInventoryQuerySchema } from './search.validation.js';

const router = Router();

/**
 * @swagger
 * /search/inventory:
 *   get:
 *     tags: [Search]
 *     summary: Public geospatial medicine search
 *     description: Searches for medicines at verified pharmacies within a radius of the given coordinates. Uses PostGIS ST_DWithin for spatial filtering and ST_Distance for sorting.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Medicine name or generic name
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: User latitude
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: User longitude
 *       - in: query
 *         name: radiusKm
 *         schema:
 *           type: number
 *           default: 10
 *           maximum: 100
 *         description: Search radius in kilometers
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Search results sorted by distance
 *       400:
 *         description: Validation error (missing query params)
 */
router.get(
  '/inventory',
  validate(searchInventoryQuerySchema, 'query'),
  searchInventory
);

export default router;
