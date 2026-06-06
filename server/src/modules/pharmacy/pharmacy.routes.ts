import { Router } from 'express';
import pharmacyController from './pharmacy.controller.js';
import validate from '../../middleware/validate.js';
import auth from '../../middleware/auth.js';
import authorize from '../../middleware/authorize.js';
import { createPharmacySchema, updatePharmacySchema } from './pharmacy.validation.js';

const router = Router();

// ---- Authenticated routes (Pharmacy owners) ----

/**
 * @swagger
 * /pharmacy/profile:
 *   post:
 *     tags: [Pharmacy]
 *     summary: Create pharmacy profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePharmacyRequest'
 *     responses:
 *       201:
 *         description: Profile created (status defaults to PENDING)
 *       400:
 *         description: Validation error
 *       409:
 *         description: Profile or license already exists
 */
router.post(
  '/profile',
  auth,
  authorize('PHARMACY'),
  validate(createPharmacySchema, 'body'),
  pharmacyController.createProfile
);

/**
 * @swagger
 * /pharmacy/profile:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get own pharmacy profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *       404:
 *         description: Profile not found
 */
router.get(
  '/profile',
  auth,
  authorize('PHARMACY'),
  pharmacyController.getOwnProfile
);

/**
 * @swagger
 * /pharmacy/profile:
 *   put:
 *     tags: [Pharmacy]
 *     summary: Update own pharmacy profile
 *     description: If pharmacy is REJECTED, updating auto-transitions status to PENDING for re-review.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePharmacyRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 *       404:
 *         description: Profile not found
 */
router.put(
  '/profile',
  auth,
  authorize('PHARMACY'),
  validate(updatePharmacySchema, 'body'),
  pharmacyController.updateProfile
);

// ---- Public routes ----

/**
 * @swagger
 * /pharmacy/{id}:
 *   get:
 *     tags: [Pharmacy]
 *     summary: Get pharmacy public details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pharmacy details
 *       404:
 *         description: Pharmacy not found
 */
router.get('/:id', pharmacyController.getPublicProfile);

export default router;
