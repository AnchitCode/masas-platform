import { Router } from 'express';
import adminController from './admin.controller.js';
import validate from '../../middleware/validate.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { listPharmaciesSchema, updatePharmacyStatusSchema } from './admin.validation.js';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(auth);
router.use(authorize('ADMIN'));

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Platform-wide statistics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregated counts and recent activity
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 */
router.get('/stats', adminController.getStats);

/**
 * @swagger
 * /admin/pharmacies:
 *   get:
 *     tags: [Admin]
 *     summary: List pharmacies (filterable by status)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, VERIFIED, REJECTED]
 *         description: Filter by verification status
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
 *         description: Paginated pharmacy list
 */
router.get(
  '/pharmacies',
  validate(listPharmaciesSchema, 'query'),
  adminController.listPharmacies
);

/**
 * @swagger
 * /admin/pharmacies/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Full pharmacy detail for admin review
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
 *         description: Pharmacy detail with user info and inventory count
 *       404:
 *         description: Pharmacy not found
 */
router.get('/pharmacies/:id', adminController.getPharmacyDetail);

/**
 * @swagger
 * /admin/pharmacies/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Verify or reject pharmacy
 *     description: "State machine: PENDING→VERIFIED, PENDING→REJECTED, REJECTED→VERIFIED, VERIFIED→REJECTED. Same-status transitions are blocked."
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
 *             $ref: '#/components/schemas/UpdatePharmacyStatusRequest'
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Same-status transition (no-op)
 *       404:
 *         description: Pharmacy not found
 */
router.patch(
  '/pharmacies/:id/status',
  validate(updatePharmacyStatusSchema, 'body'),
  adminController.updatePharmacyStatus
);

export default router;
