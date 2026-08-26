import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock_all()`);
  console.log("Locks released");
}
main().catch(console.error).finally(() => prisma.$disconnect());
