import { FullConfig } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

/**
 * Global setup runs once before all tests
 * - Initializes test database (if configured)
 * - Seeds necessary test data
 * - Sets up authentication state
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🚀 Starting global test setup...\n');

  // Only run database setup if DATABASE_URL is configured
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      // Dynamic import to avoid issues when DB isn't configured
      const { DatabaseHelper } = await import('../helpers/database.helper.js');
      const db = await DatabaseHelper.getInstance();

      // Clean up any leftover test data from previous runs
      console.log('🧹 Cleaning test database...');
      await db.cleanTestData();

      // Seed base test data
      console.log('🌱 Seeding base test data...');
      await db.seedBaseTestData();

      console.log('✅ Database setup complete!');
    } catch (error) {
      console.warn('⚠️  Database setup skipped:', (error as Error).message);
    }
  } else {
    console.log('ℹ️  No DATABASE_URL configured, skipping database setup');
  }

  console.log('\n✅ Global setup complete!\n');
}

export default globalSetup;
