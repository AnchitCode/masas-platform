import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import corsOptions from './config/cors.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// --------------- Global Middleware ---------------

// Security headers
app.use(helmet());

// Disable caching for API responses
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// CORS
app.use(cors(corsOptions));

// Request logging: skip in test, 'dev' format in development, 'combined' in production
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(env.isDev ? 'dev' : 'combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cookie parsing (for refresh tokens)
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// --------------- API Documentation ---------------

if (!env.isProd) {
  // Wrap in IIFE since top-level await is not available in CommonJS
  void (async () => {
    const swaggerUi = await import('swagger-ui-express');
    const swaggerSpec = (await import('./config/swagger.js')).default;
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'MASAS API Documentation',
    }));
  })();
}

// --------------- API Routes (v1) ---------------

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Server health check
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get('/api/v1/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'MASAS API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Auth routes
import authRoutes from './modules/auth/auth.routes.js';
app.use('/api/v1/auth', authRoutes);

// Pharmacy routes
import pharmacyRoutes from './modules/pharmacy/pharmacy.routes.js';
app.use('/api/v1/pharmacy', pharmacyRoutes);

// Catalog routes
import catalogRoutes from './modules/catalog/catalog.routes.js';
app.use('/api/v1/catalog', catalogRoutes);

// Inventory routes
import inventoryRoutes from './modules/inventory/inventory.routes.js';
app.use('/api/v1/inventory', inventoryRoutes);

// Public search (medicine availability near a location)
import searchRoutes from './modules/search/search.routes.js';
app.use('/api/v1/search', searchRoutes);

// Admin routes (Phase 5)
import adminRoutes from './modules/admin/admin.routes.js';
app.use('/api/v1/admin', adminRoutes);

// --------------- Error Handling ---------------

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
