const express = require('express');
const validate = require('../../middleware/validate');
const searchController = require('./search.controller');
const { searchInventoryQuerySchema } = require('./search.validation');

const router = express.Router();

router.get(
  '/inventory',
  validate(searchInventoryQuerySchema, 'query'),
  searchController.searchInventory
);

module.exports = router;
