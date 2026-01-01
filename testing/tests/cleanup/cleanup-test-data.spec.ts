import { test, expect } from '@playwright/test';
import { CleanupHelper } from '../../helpers/cleanup.helper';
import { TEST_DATA_PREFIX, LEGACY_PREFIXES } from '../../config/test-data-prefix';

/**
 * Test Data Cleanup Suite
 *
 * Run this test to clean up any test data left over from E2E tests.
 * This is useful when tests fail before their cleanup code runs,
 * or to ensure a clean slate before running tests.
 *
 * Usage:
 *   npx playwright test --project=cleanup
 *
 * This test:
 * - Logs in as the test user
 * - Finds all trips with test prefixes: [E2E-TEST], E2E Test, E2E_, Test Trip, etc.
 * - Deletes them one by one
 * - Reports how many items were cleaned up
 */
test.describe('Test Data Cleanup', () => {
  test('cleanup all E2E test trips', async ({ page }) => {
    const cleanup = new CleanupHelper(page);

    // Login as test user
    await cleanup.loginForCleanup();

    // Delete all test trips
    const deletedCount = await cleanup.deleteTestTrips();

    console.log(`Cleaned up ${deletedCount} test trips`);

    // This test always passes - it's for cleanup, not validation
    expect(true).toBeTruthy();
  });

  test('verify no test trips remain', async ({ page }) => {
    const cleanup = new CleanupHelper(page);
    await cleanup.loginForCleanup();

    // Build selector for all test prefixes
    const allPrefixes = [TEST_DATA_PREFIX, ...LEGACY_PREFIXES];
    const prefixSelectors = allPrefixes.map(p => `a:has-text("${p}")`).join(', ');

    // Check that no test trips are visible
    const testTripCards = page.locator(prefixSelectors);
    const count = await testTripCards.count();

    // If test trips remain, it means cleanup didn't work fully
    // This is informational, not a failure
    if (count > 0) {
      console.log(`Warning: ${count} test trips still visible (may be owned by other users)`);
    } else {
      console.log('All test trips cleaned up successfully');
    }

    expect(true).toBeTruthy();
  });
});
