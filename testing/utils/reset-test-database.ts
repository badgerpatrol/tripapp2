import { DatabaseHelper } from '../helpers/database.helper';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

/**
 * Script to reset the test database
 * Removes all test data and prepares for fresh test run
 */
async function resetTestDatabase() {
  console.log('🗑️  Resetting test database...\n');

  try {
    const db = await DatabaseHelper.getInstance();

    console.log('Cleaning up test data...');
    await db.cleanTestData();

    console.log('\n✅ Test database reset complete!');

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reset test database:', error);
    process.exit(1);
  }
}

resetTestDatabase();
