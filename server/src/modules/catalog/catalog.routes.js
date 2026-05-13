const express = require('express');
const catalogController = require('./catalog.controller');
const protect = require('../../middleware/auth');

const router = express.Router();

// All catalog routes should be protected (users must be logged in to search)
router.use(protect);

router.get('/search', catalogController.searchMedicines);

module.exports = router;
