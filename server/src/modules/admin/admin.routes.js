const { Router } = require('express');
const adminController = require('./admin.controller');
const validate = require('../../middleware/validate');
const auth = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const {
  listPharmaciesSchema,
  updatePharmacyStatusSchema,
} = require('./admin.validation');

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(auth);
router.use(authorize('ADMIN'));

// GET /api/v1/admin/stats — Platform statistics
router.get('/stats', adminController.getStats);

// GET /api/v1/admin/pharmacies — List pharmacies (filterable by status)
router.get(
  '/pharmacies',
  validate(listPharmaciesSchema, 'query'),
  adminController.listPharmacies
);

// GET /api/v1/admin/pharmacies/:id — Pharmacy detail for admin review
router.get('/pharmacies/:id', adminController.getPharmacyDetail);

// PATCH /api/v1/admin/pharmacies/:id/status — Verify or reject pharmacy
router.patch(
  '/pharmacies/:id/status',
  validate(updatePharmacyStatusSchema, 'body'),
  adminController.updatePharmacyStatus
);

module.exports = router;
