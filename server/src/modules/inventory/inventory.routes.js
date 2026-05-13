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

router.get('/', inventoryController.getInventory);

router.post(
  '/',
  logInventoryBody,
  validate(addInventorySchema, 'body'),
  inventoryController.addInventory
);

router.patch(
  '/:id',
  logInventoryBody,
  validate(updateInventorySchema, 'body'),
  inventoryController.updateInventory
);

router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;
