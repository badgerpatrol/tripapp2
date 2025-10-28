#!/usr/bin/env tsx
/**
 * Database Migration Script
 *
 * Creates and applies migrations safely.
 *
 * Usage:
 *   pnpm db:migrate         # Create and apply migration (dev)
 *   pnpm db:migrate:deploy  # Apply pending migrations (production)
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const isDeploy = args.includes('--deploy');

async function main() {
  try {
    if (isDeploy) {
      console.log('🚀 Deploying pending migrations...\n');
      execSync('pnpm prisma migrate deploy', {
        stdio: 'inherit',
      });
    } else {
      console.log('📝 Creating and applying migration...\n');
      console.log('Enter migration name when prompted.\n');

      execSync('pnpm prisma migrate dev', {
        stdio: 'inherit',
      });
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
