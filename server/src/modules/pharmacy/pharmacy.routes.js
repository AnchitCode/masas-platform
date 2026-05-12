const { Router } = require('express');
const pharmacyController = require('./pharmacy.controller');
const validate = require('../../middleware/validate');
const auth = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const {
  createPharmacySchema,
  updatePharmacySchema,
} = require('./pharmacy.validation');

const router = Router();

// ---- Authenticated routes (Pharmacy owners) ----

// POST /api/v1/pharmacy/profile — Create pharmacy profile
router.post(
  '/profile',
  auth,
  authorize('PHARMACY'),
  validate(createPharmacySchema, 'body'),
  pharmacyController.createProfile
);

// GET /api/v1/pharmacy/profile — Get own pharmacy profile
router.get(
  '/profile',
  auth,
  authorize('PHARMACY'),
  pharmacyController.getOwnProfile
);

// PUT /api/v1/pharmacy/profile — Update own pharmacy profile
router.put(
  '/profile',
  auth,
  authorize('PHARMACY'),
  validate(updatePharmacySchema, 'body'),
  pharmacyController.updateProfile
);

// ---- Public routes ----

// GET /api/v1/pharmacy/:id — Get pharmacy public details
router.get('/:id', pharmacyController.getPublicProfile);

module.exports = router;
