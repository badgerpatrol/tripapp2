#!/usr/bin/env tsx
/**
 * Database Initialization Script
 *
 * Safely creates or updates the database schema for tripplanner.
 * Does NOT delete or affect other databases or tables.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   pnpm db:init        # Create/update schema only
 *   pnpm db:init --seed # Also run seed data after init
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const shouldSeed = args.includes('--seed');

async function main() {
  console.log('🗄️  Database Initialization Script\n');
  console.log('This will SAFELY:');
  console.log('  1. Create/update schema in the tripplanner database');
  console.log('  2. Generate Prisma Client');
  if (shouldSeed) {
    console.log('  3. Run seed data (if not already seeded)\n');
  } else {
    console.log('\n');
  }

  console.log('✅ This script does NOT delete data or affect other databases.\n');

  try {
    console.log('📋 Step 1/2: Pushing schema to database...');
    console.log('(This creates new tables/columns but preserves existing data)\n');

    execSync('pnpm prisma db push --skip-generate', {
      stdio: 'inherit',
    });

    console.log('\n📦 Step 2/2: Generating Prisma Client...');
    execSync('pnpm prisma generate', {
      stdio: 'inherit',
    });

    if (shouldSeed) {
      console.log('\n🌱 Step 3/3: Seeding database...');
      execSync('pnpm db:seed', {
        stdio: 'inherit',
      });
    }

    console.log('\n✅ Database initialization complete!');
    console.log('\nNext steps:');
    console.log('  - View your database: pnpm db:studio');
    console.log('  - Run seed data: pnpm db:seed');
    console.log('  - Start dev server: pnpm dev');
  } catch (error) {
    console.error('\n❌ Error during database initialization:', error);
    process.exit(1);
  }
}

main();
