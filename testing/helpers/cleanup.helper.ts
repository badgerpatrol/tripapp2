import { Page } from '@playwright/test';
import { HomePage } from '../page-objects';
import { LoginPage } from '../page-objects/login.page';
import { TEST_DATA_PREFIX, LEGACY_PREFIXES, isTestData } from '../config/test-data-prefix';

// Re-export for backward compatibility
export { TEST_DATA_PREFIX } from '../config/test-data-prefix';
export const TEST_DATA_PREFIX_ALT = '[E2E-TEST]';

/**
 * Test data cleanup helper
 *
 * This helper provides utilities to clean up test data created during E2E tests.
 * Since UI tests should not use direct database access, this provides UI-based
 * cleanup methods that simulate how a real user would delete data.
 *
 * Test Naming Convention:
 * - Tests MUST use generateTestName() from config/test-data-prefix.ts
 * - This creates names like "[E2E-TEST] Trip 1234567890"
 * - The [E2E-TEST] prefix is unique and won't appear in real user data
 */

/**
 * Cleanup helper for UI-based test data removal
 */
export class CleanupHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Login and prepare for cleanup operations
   */
  async loginForCleanup(): Promise<void> {
    const loginPage = new LoginPage(this.page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    const homePage = new HomePage(this.page);
    await homePage.waitForLoading();
    await homePage.waitForTripsLoaded();
  }

  /**
   * Delete all trips that match the E2E test prefix
   * Returns the number of trips deleted
   */
  async deleteTestTrips(): Promise<number> {
    const homePage = new HomePage(this.page);
    await homePage.waitForTripsLoaded();

    let deletedCount = 0;
    let foundTestTrip = true;

    // Build selector for all possible test prefixes
    const prefixSelectors = [TEST_DATA_PREFIX, ...LEGACY_PREFIXES]
      .map(p => `a:has-text("${p}")`)
      .join(', ');

    while (foundTestTrip) {
      // Find trip cards with any test prefix
      const testTripCards = this.page.locator(prefixSelectors);
      const count = await testTripCards.count();

      if (count === 0) {
        foundTestTrip = false;
        break;
      }

      // Click the first test trip to open it
      await testTripCards.first().click();
      await this.page.waitForLoadState('networkidle');

      // Try to delete the trip via settings/edit
      const deleted = await this.deleteCurrentTrip();

      if (deleted) {
        deletedCount++;
        // Wait for navigation back to home
        await homePage.waitForTripsLoaded();
      } else {
        // If we couldn't delete, break to avoid infinite loop
        foundTestTrip = false;
      }
    }

    return deletedCount;
  }

  /**
   * Delete the currently viewed trip
   * Returns true if deleted, false if delete button not found
   */
  async deleteCurrentTrip(): Promise<boolean> {
    // Look for edit/settings button
    const editButton = this.page.locator('button:has-text("Edit Trip"), button[aria-label="Edit trip"], button:has-text("Settings")');

    if (await editButton.isVisible({ timeout: 3000 })) {
      await editButton.click();
      await this.page.waitForTimeout(500);

      // Look for delete button in the edit dialog/page
      const deleteButton = this.page.locator('button:has-text("Delete Trip"), button:has-text("Delete"), button.text-red-600, button.bg-red-600');

      if (await deleteButton.isVisible({ timeout: 2000 })) {
        await deleteButton.click();

        // Handle confirmation dialog
        const confirmButton = this.page.locator('button:has-text("Delete")').last();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
          await this.page.waitForLoadState('networkidle');
          return true;
        }
      }
    }

    // Navigate back to home if we couldn't delete
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
    return false;
  }

  /**
   * Delete test spends from the current trip
   * Returns the number of spends deleted
   */
  async deleteTestSpends(): Promise<number> {
    let deletedCount = 0;

    // Look for spend cards with test prefix
    const testSpendCards = this.page.locator(`button:has-text("${TEST_DATA_PREFIX}"), button:has-text("${TEST_DATA_PREFIX_ALT}")`).filter({ has: this.page.locator('text=/£|€|\\$/') });

    const count = await testSpendCards.count();

    for (let i = 0; i < count; i++) {
      // Re-query as the DOM changes after each delete
      const spendCard = this.page.locator(`button:has-text("${TEST_DATA_PREFIX}"), button:has-text("${TEST_DATA_PREFIX_ALT}")`).filter({ has: this.page.locator('text=/£|€|\\$/') }).first();

      if (await spendCard.isVisible({ timeout: 2000 })) {
        await spendCard.click();
        await this.page.waitForTimeout(500);

        // Look for delete button in spend detail
        const deleteButton = this.page.locator('button:has-text("Delete"), button[aria-label="Delete"]');

        if (await deleteButton.isVisible({ timeout: 2000 })) {
          await deleteButton.click();

          // Handle confirmation
          const confirmButton = this.page.locator('button:has-text("Delete")').last();
          if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
            await this.page.waitForLoadState('networkidle');
            deletedCount++;
          }
        }

        // Close dialog if still open
        const closeButton = this.page.locator('button[aria-label="Close"], button:has-text("Cancel")');
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        }
      }
    }

    return deletedCount;
  }

  /**
   * Delete test menus/choices from the current trip
   * Returns the number of menus deleted
   */
  async deleteTestMenus(): Promise<number> {
    let deletedCount = 0;

    // Look for menu cards with test prefix
    const testMenuCards = this.page.locator(`[data-testid="choice-card"]:has-text("${TEST_DATA_PREFIX}"), [data-testid="menu-card"]:has-text("${TEST_DATA_PREFIX}"), button:has-text("${TEST_DATA_PREFIX}")`);

    const count = await testMenuCards.count();

    for (let i = 0; i < count; i++) {
      // Re-query as the DOM changes after each delete
      const menuCard = this.page.locator(`[data-testid="choice-card"]:has-text("${TEST_DATA_PREFIX}"), [data-testid="menu-card"]:has-text("${TEST_DATA_PREFIX}")`).first();

      if (await menuCard.isVisible({ timeout: 2000 })) {
        await menuCard.click();
        await this.page.waitForTimeout(500);

        // Look for delete button in menu detail
        const deleteButton = this.page.locator('button:has-text("Delete"), button[aria-label="Delete"]');

        if (await deleteButton.isVisible({ timeout: 2000 })) {
          await deleteButton.click();

          // Handle confirmation
          const confirmButton = this.page.locator('button:has-text("Delete")').last();
          if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
            await this.page.waitForLoadState('networkidle');
            deletedCount++;
          }
        }

        // Close dialog if still open
        const closeButton = this.page.locator('button[aria-label="Close"], button:has-text("Cancel")');
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        }
      }
    }

    return deletedCount;
  }
}

/**
 * Run cleanup for all test data
 * Can be called from afterAll or as a standalone cleanup script
 */
export async function cleanupAllTestData(page: Page): Promise<{
  trips: number;
  spends: number;
  menus: number;
}> {
  const cleanup = new CleanupHelper(page);
  await cleanup.loginForCleanup();

  const trips = await cleanup.deleteTestTrips();

  return {
    trips,
    spends: 0, // Spends are deleted with trips
    menus: 0, // Menus are deleted with trips
  };
}
