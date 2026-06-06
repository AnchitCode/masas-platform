import type { CorsOptions } from 'cors';
import env from './env.js';

/**
 * CORS configuration.
 * In development: allows localhost frontend.
 * In production: restricts to CLIENT_URL only.
 */
const corsOptions: CorsOptions = {
  origin: env.isDev
    ? [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000']
    : env.CLIENT_URL,
  credentials: true, // Allow cookies (refresh token)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default corsOptions;
