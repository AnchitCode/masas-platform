const express = require('express');
const inventoryController = require('./inventory.controller');
const { addInventorySchema, updateInventorySchema } = require('./inventory.validation');
const validate = require('../../middleware/validate');
const protect = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const { requireVerifiedPharmacy } = require('../../middleware/pharmacy');
const logger = require('../../utils/logger');

const router = express.Router();

/** Temporary: log raw body before Zod (controller runs only after validation). */
const logInventoryBody = (req, _res, next) => {
  logger.debug('inventory route incoming body', {
    method: req.method,
    path: req.path,
    body: req.body,
  });
  next();
};

// Apply global middlewares to all inventory routes
router.use(protect);
router.use(authorize('PHARMACY'));
router.use(requireVerifiedPharmacy);

/**
 * @swagger
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Get own pharmacy inventory
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Inventory list with medicine details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not a verified pharmacy
 */
router.get('/', inventoryController.getInventory);

/**
 * @swagger
 * /inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Add medicine to inventory
 *     description: Find-or-create pattern — creates medicine in catalog if not exists.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddInventoryRequest'
 *     responses:
 *       201:
 *         description: Medicine added to inventory
 *       400:
 *         description: Validation error
 *       409:
 *         description: Medicine already in inventory
 */
router.post(
  '/',
  logInventoryBody,
  validate(addInventorySchema, 'body'),
  inventoryController.addInventory
);

/**
 * @swagger
 * /inventory/{id}:
 *   patch:
 *     tags: [Inventory]
 *     summary: Update inventory entry
 *     description: Smart availability toggle — setting quantity to 0 auto-disables availability.
 *     security:
 *       - BearerAuth: []
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
 *             $ref: '#/components/schemas/UpdateInventoryRequest'
 *     responses:
 *       200:
 *         description: Inventory updated
 *       404:
 *         description: Item not found or not owned
 */
router.patch(
  '/:id',
  logInventoryBody,
  validate(updateInventorySchema, 'body'),
  inventoryController.updateInventory
);

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     tags: [Inventory]
 *     summary: Remove inventory entry
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Item removed
 *       404:
 *         description: Item not found or not owned
 */
router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;
