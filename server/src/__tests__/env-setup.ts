import dotenv from 'dotenv';
import path from 'path';

// THIS FILE MUST HAVE NO OTHER IMPORTS.
// It is explicitly executed first by Vitest setupFiles to guarantee
// the test environment variables are loaded BEFORE any other module
// (including Prisma) is statically imported or evaluated.

const envTestPath = path.resolve(__dirname, '../../.env.test');
dotenv.config({ path: envTestPath, override: true });

console.log('✅ [env-setup.ts] Test environment variables loaded successfully.');
