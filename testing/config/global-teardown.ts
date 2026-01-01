import { FullConfig } from '@playwright/test';

/**
 * Global teardown runs once after all tests
 * - Cleans up test data
 * - Disconnects database connections
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n🧹 Starting global test teardown...\n');

  // Only run database teardown if DATABASE_URL is configured
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      // Dynamic import to avoid issues when DB isn't configured
      const { DatabaseHelper } = await import('../helpers/database.helper.js');
      const db = await DatabaseHelper.getInstance();

      // Clean up test data if not in CI (keep for debugging locally)
      if (!process.env.CI && process.env.KEEP_TEST_DATA !== 'true') {
        console.log('🗑️  Cleaning up test data...');
        await db.cleanTestData();
      }

      // Disconnect from database
      await db.disconnect();

      console.log('✅ Database teardown complete!');
    } catch (error) {
      console.warn('⚠️  Database teardown skipped:', (error as Error).message);
    }
  } else {
    console.log('ℹ️  No DATABASE_URL configured, skipping database teardown');
  }

  console.log('\n✅ Global teardown complete!\n');
}

export default globalTeardown;
