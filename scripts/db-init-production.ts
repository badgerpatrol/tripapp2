#!/usr/bin/env tsx
/**
 * Production Database Initialization Script
 *
 * Initializes the production database schema on Render.
 * This script should be run:
 *   1. Initially when setting up the production database
 *   2. After any schema changes to sync the production database
 *
 * Usage:
 *   DATABASE_URL="your_render_database_url" tsx scripts/db-init-production.ts
 *   DATABASE_URL="your_render_database_url" tsx scripts/db-init-production.ts --seed
 *
 * Environment Variables Required:
 *   DATABASE_URL - The production database connection string
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

async function main() {
  console.log('🚀 Production Database Initialization\n');

  // Verify DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('\nUsage:');
    console.error('  DATABASE_URL="postgresql://..." tsx scripts/db-init-production.ts');
    process.exit(1);
  }

  // Safety check - ensure this is not accidentally run on local database
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    console.error('❌ ERROR: DATABASE_URL appears to be a local database');
    console.error('This script is for production databases only.');
    console.error('Use `pnpm db:init` for local development instead.');
    process.exit(1);
  }

  console.log('Database:', dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
  console.log('');

  console.log('This will:');
  console.log('  1. Push schema to production database');
  console.log('  2. Generate Prisma Client');
  if (shouldSeed) {
    console.log('  3. Seed default data\n');
  } else {
    console.log('\n');
  }

  try {
    console.log('📋 Step 1: Pushing schema to database...');
    console.log('(This creates new tables/columns but preserves existing data)\n');

    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: { ...process.env },
    });

    console.log('\n📦 Step 2: Generating Prisma Client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      env: { ...process.env },
    });

    if (shouldSeed) {
      console.log('\n🌱 Step 3: Seeding database...');
      execSync('tsx scripts/db-seed.ts', {
        stdio: 'inherit',
        env: { ...process.env },
      });
    }

    console.log('\n✅ Production database initialization complete!');
    console.log('\nNext steps:');
    console.log('  1. Set DATABASE_URL in Vercel environment variables');
    console.log('  2. Deploy your application to Vercel');
    console.log('  3. Run this script again after any schema changes');
  } catch (error) {
    console.error('\n❌ Error during production database initialization:', error);
    process.exit(1);
  }
}

main();
