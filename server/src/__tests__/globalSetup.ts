import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { isTestDatabaseSafe } from '../utils/dbSafety.js';

export default async function globalSetup() {
  console.log('\n[globalSetup] Starting global test initialization...\n');

  // 1. Load .env.test FIRST
  const envTestPath = path.resolve(__dirname, '../../.env.test');
  dotenv.config({ path: envTestPath, override: true });

  // 2. Dynamically instantiate Prisma (using explicit datasourceUrl)
  // This ensures it uses the just-loaded test DATABASE_URL.
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in .env.test');
  }
  
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  try {
    // 3. Verify actual test DB identity BEFORE migrating
    const { safe, errors } = await isTestDatabaseSafe(prisma);
    
    if (!safe) {
      throw new Error(
        `\n🛑 Refusing global migration: database safety check failed.\n\n` +
        errors.map((e) => `  ✖ ${e}`).join('\n')
      );
    }

    console.log(`🛡️ SAFETY PASS: Verified active connection for [globalSetup — prisma migrate deploy]`);
    console.log(`   Environment: ${process.env.NODE_ENV}`);
    console.log(`   Database: ${process.env.SAFE_TEST_DATABASE_NAME}`);
    console.log(`   Host: ${process.env.SAFE_TEST_DATABASE_HOST}\n`);

    // 4. Run `prisma migrate deploy` exactly ONCE
    const serverRoot = path.resolve(__dirname, '../..');
    
    console.log('🔄 Running global database migration...');
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL,
      },
      cwd: serverRoot,
      stdio: 'inherit', // Show output directly in the console
    });
    
    console.log('✅ Global migration succeeded.\n');

  } finally {
    await prisma.$disconnect();
  }
}
