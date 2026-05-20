const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

/**
 * Seed script — creates a default admin account.
 * Idempotent: safe to run multiple times (uses upsert).
 *
 * Usage:
 *   npm run seed
 *   node prisma/seed.js
 *
 * Environment variables (optional — falls back to dev defaults):
 *   ADMIN_EMAIL    — admin account email
 *   ADMIN_PASSWORD — admin account password
 */
async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@masas.com';
  const password = process.env.ADMIN_PASSWORD || 'admin12345';

  console.log(`\n🌱 Seeding admin account: ${email}`);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user ready — id: ${user.id}, email: ${user.email}, role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
