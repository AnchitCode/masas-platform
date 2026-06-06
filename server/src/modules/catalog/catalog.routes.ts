import { Router } from 'express';
import { searchMedicines } from './catalog.controller.js';
import auth from '../../middleware/auth.js';

const router = Router();

// All catalog routes should be protected (users must be logged in to search)
router.use(auth);

/**
 * @swagger
 * /catalog/search:
 *   get:
 *     tags: [Catalog]
 *     summary: Search medicine catalog (autocomplete)
 *     description: Case-insensitive search across medicine name and generic name. Limited to 10 results.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (e.g. "paracetamol")
 *     responses:
 *       200:
 *         description: Matching medicines
 *       401:
 *         description: Unauthorized
 */
router.get('/search', searchMedicines);

export default router;
