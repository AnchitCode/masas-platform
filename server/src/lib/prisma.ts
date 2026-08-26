import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 * Prevents multiple instances in development (hot-reload).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    'CRITICAL: DATABASE_URL is not set in the environment. ' +
    'PrismaClient instantiation is aborted to prevent implicit fallback to local .env.'
  );
}

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
