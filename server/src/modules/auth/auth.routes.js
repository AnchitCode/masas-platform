const { Router } = require('express');
const authController = require('./auth.controller');
const validate = require('../../middleware/validate');
const auth = require('../../middleware/auth');
const { registerSchema, loginSchema } = require('./auth.validation');

const router = Router();

// POST /api/v1/auth/register — Create a new account
router.post('/register', validate(registerSchema, 'body'), authController.register);

// POST /api/v1/auth/login — Login and receive tokens
router.post('/login', validate(loginSchema, 'body'), authController.login);

// POST /api/v1/auth/refresh — Refresh access token (uses httpOnly cookie)
router.post('/refresh', authController.refresh);

// GET /api/v1/auth/me — Get current user profile (requires auth)
router.get('/me', auth, authController.getMe);

// POST /api/v1/auth/logout — Clear refresh token cookie
router.post('/logout', authController.logout);

module.exports = router;
