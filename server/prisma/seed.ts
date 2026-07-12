import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

/**
 * Seed script — creates a default admin account.
 * Idempotent: safe to run multiple times (uses upsert).
 * Usage:
 *   npm run seed
 *   tsx prisma/seed.ts
 *
 * Environment variables (optional — falls back to dev defaults):
 *   ADMIN_EMAIL    — admin account email
 *   ADMIN_PASSWORD — admin account password
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL || 'admin@masas.com';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';

  console.log(`\n🌱 Seeding admin account: ${email}`);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  console.log(`✅ Admin user ready — id: ${user.id}, email: ${user.email}, role: ${user.role}`);
}

main()
  .catch((error: Error) => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
