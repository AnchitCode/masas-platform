const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const corsOptions = require('./config/cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --------------- Global Middleware ---------------

// Security headers
app.use(helmet());

// CORS
app.use(cors(corsOptions));

// Request logging: 'dev' format in development, 'combined' in production
app.use(morgan(env.isDev ? 'dev' : 'combined'));

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

// --------------- API Routes (v1) ---------------

// Health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MASAS API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Auth routes
const authRoutes = require('./modules/auth/auth.routes');
app.use('/api/v1/auth', authRoutes);

// Pharmacy routes
const pharmacyRoutes = require('./modules/pharmacy/pharmacy.routes');
app.use('/api/v1/pharmacy', pharmacyRoutes);

// TODO: Phase 3 — Catalog & Inventory routes
// TODO: Phase 5 — Admin routes

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

module.exports = app;
