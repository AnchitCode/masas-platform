const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const ApiError = require('../../utils/apiError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../utils/jwt');

const SALT_ROUNDS = 12;

/**
 * Auth service — business logic for authentication.
 */
const authService = {
  /**
   * Register a new user.
   * @param {{ email: string, password: string, role: string }} data
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async register({ email, password, role }) {
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: { email, passwordHash, role },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    return { user, accessToken, refreshToken };
  },

  /**
   * Login an existing user.
   * @param {{ email: string, password: string }} data
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async login({ email, password }) {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    return { user: safeUser, accessToken, refreshToken };
  },

  /**
   * Refresh the access token using a valid refresh token.
   * @param {string} refreshToken
   * @returns {{ accessToken: string, refreshToken: string }}
   */
  async refresh(refreshToken) {
    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token is required');
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Ensure user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  /**
   * Get the current authenticated user's profile.
   * @param {string} userId
   * @returns {object} user profile with pharmacy info if applicable
   */
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  },
};

module.exports = authService;
