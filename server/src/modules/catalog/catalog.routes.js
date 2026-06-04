const express = require('express');
const catalogController = require('./catalog.controller');
const protect = require('../../middleware/auth');

const router = express.Router();

// All catalog routes should be protected (users must be logged in to search)
router.use(protect);

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
router.get('/search', catalogController.searchMedicines);

module.exports = router;
