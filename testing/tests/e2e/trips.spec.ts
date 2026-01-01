import { test, expect } from '@playwright/test';
import { HomePage, CreateTripPage, TripDetailPage } from '../../page-objects';
import { LoginPage } from '../../page-objects/login.page';
import { generateTestName } from '../../config/test-data-prefix';

/**
 * Trip management E2E tests
 * Tests the real app flow for creating, viewing, and managing trips
 *
 * Trip wizard steps:
 * 1. Basics - Name, start/end dates, description
 * 2. Details - Location, base currency
 * 3. Invite Options - Allow named people, allow signup
 * 4. Invite Selection - Select users to invite
 * 5. Share - Share link (conditional)
 * 6. Choices - Add menus/choices
 * 7. Cover Image - Upload header image
 */
test.describe('Trip Management', () => {
  // Clean up created trips after tests
  const createdTripIds: string[] = [];

  test.afterEach(async ({ page }) => {
    // We don't have direct DB access in UI tests, so trips are cleaned up
    // via the API tests or manually. This is acceptable for E2E tests.
  });

  test.describe('Trip Creation @critical', () => {
    test('can navigate to trip wizard from home page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();

      const canCreate = await homePage.canCreateTrip();
      if (canCreate) {
        await homePage.startCreateTrip();
        await expect(page).toHaveURL('/trips/new-v2');

        // Wizard should show step 1
        await expect(page.locator('h1:has-text("Create Trip")')).toBeVisible();
        await expect(page.locator('text=Step 1')).toBeVisible();
      }
    });

    test('wizard step 1 shows required fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();

      // Navigate through FAB to wizard
      const canCreate = await homePage.canCreateTrip();
      expect(canCreate).toBeTruthy();

      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Step 1 should show name, dates, description fields
      await expect(createTripPage.tripNameInput).toBeVisible();
      await expect(createTripPage.startDateInput).toBeVisible();
      await expect(createTripPage.endDateInput).toBeVisible();
      await expect(createTripPage.descriptionInput).toBeVisible();
    });

    test('validates trip name is required', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Fill dates but leave name empty
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.startDateInput.fill(startDate);
      await createTripPage.endDateInput.fill(endDate);

      // Create button should be disabled or show error when clicked
      const createButton = createTripPage.createButton;
      const isDisabled = await createButton.isDisabled();

      if (!isDisabled) {
        await createButton.click();
        // Should show error or stay on step 1
        const hasError = await createTripPage.hasError();
        const currentStep = await createTripPage.getCurrentStep();
        expect(hasError || currentStep === 1).toBeTruthy();
      } else {
        expect(isDisabled).toBeTruthy();
      }
    });

    test('can create a trip with basic info', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Fill step 1 basics
      const tripName = generateTestName('Trip');
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.fillBasics({
        name: tripName,
        startDate,
        endDate,
        description: 'Created by E2E test',
      });

      // Click Create to create the trip and move to step 2
      await createTripPage.createButton.click();
      await page.waitForLoadState('networkidle');

      // Should move to step 2
      await expect(page).toHaveURL(/step=2/);
    });

    test('can complete full trip creation wizard', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Complete the wizard
      const tripName = generateTestName('FullTrip');
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.createTrip({
        name: tripName,
        startDate,
        endDate,
        description: 'Full wizard E2E test',
        location: 'London, UK',
        currency: 'GBP',
      });

      // Should be on trip detail page after completion
      await expect(page).toHaveURL(/\/trips\/[a-z0-9-]+$/);

      // Trip name should be visible
      const tripDetail = new TripDetailPage(page);
      const displayedName = await tripDetail.getTripName();
      expect(displayedName).toContain(tripName);
    });

    test('cancel button is visible on step 1', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Cancel button should be visible on step 1
      await expect(createTripPage.cancelButton).toBeVisible();

      // The button should be enabled and clickable
      const isDisabled = await createTripPage.cancelButton.isDisabled();
      expect(isDisabled).toBeFalsy();
    });
  });

  test.describe('Trip List', () => {
    test('displays user trips on home page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.waitForTripsLoaded();

      // Should show trips or empty state
      const tripCount = await homePage.getTripCount();
      const isEmptyState = await homePage.isEmptyStateVisible();

      expect(tripCount > 0 || isEmptyState).toBeTruthy();
    });

    test('can open a trip from the list', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.waitForTripsLoaded();

      const tripCount = await homePage.getTripCount();

      if (tripCount > 0) {
        // Click first trip
        await homePage.openFirstTrip();

        // Should navigate to trip detail
        await expect(page).toHaveURL(/\/trips\/.+/);

        // Trip detail should be visible
        const tripDetail = new TripDetailPage(page);
        const isDisplayed = await tripDetail.isDisplayed();
        expect(isDisplayed).toBeTruthy();
      }
    });
  });

  test.describe('Trip Details', () => {
    test('displays trip information correctly', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.waitForTripsLoaded();

      const tripCount = await homePage.getTripCount();

      if (tripCount > 0) {
        await homePage.openFirstTrip();

        const tripDetail = new TripDetailPage(page);

        // Should display trip name
        const tripName = await tripDetail.getTripName();
        expect(tripName.length).toBeGreaterThan(0);

        // Should show organizer
        const organizerText = await tripDetail.organizerName.textContent();
        expect(organizerText).toContain('Organized by');
      }
    });

    test('non-existent trip shows password prompt or error', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      // Navigate to a non-existent trip
      await page.goto('/trips/00000000-0000-0000-0000-000000000000');
      await page.waitForLoadState('networkidle');

      // App shows either:
      // 1. "Trip not found" message
      // 2. Password prompt for public trip view
      // 3. Error message
      // 4. Redirect to home
      const tripNotFound = await page.locator('text=Trip not found').isVisible({ timeout: 5000 }).catch(() => false);
      const passwordPrompt = await page.locator('text=Trip Password').isVisible({ timeout: 1000 }).catch(() => false);
      const viewTripHeading = await page.locator('h1:has-text("View Trip")').isVisible({ timeout: 1000 }).catch(() => false);
      const errorMessage = await page.locator('.text-red-600, .text-red-400, .bg-red-50').isVisible({ timeout: 1000 }).catch(() => false);
      const redirectedHome = page.url().endsWith('/');

      // Any of these is acceptable behavior for non-existent trip
      expect(tripNotFound || passwordPrompt || viewTripHeading || errorMessage || redirectedHome).toBeTruthy();
    });

    test('can navigate to different sections', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.waitForTripsLoaded();

      const tripCount = await homePage.getTripCount();

      if (tripCount > 0) {
        await homePage.openFirstTrip();

        const tripDetail = new TripDetailPage(page);
        await tripDetail.isDisplayed();

        // Check if sections are available
        const hasSpendSection = await tripDetail.spendSection.isVisible({ timeout: 3000 }).catch(() => false);
        const hasTimelineSection = await tripDetail.hasTimeline();

        // At least some sections should be visible
        expect(hasSpendSection || hasTimelineSection).toBeTruthy();
      }
    });
  });

  test.describe('Trip Wizard Steps', () => {
    test('step 2 shows location and currency fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Complete step 1 to get to step 2
      const tripName = generateTestName('Step2Test');
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.fillBasics({
        name: tripName,
        startDate,
        endDate,
      });

      await createTripPage.createButton.click();
      await createTripPage.waitForStep(2);

      // Step 2 should show location and currency
      await expect(createTripPage.locationInput).toBeVisible();
      await expect(createTripPage.currencySelect).toBeVisible();
    });

    test('can navigate back from step 2 to step 1', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Complete step 1 to get to step 2
      const tripName = generateTestName('BackNav');
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.fillBasics({
        name: tripName,
        startDate,
        endDate,
      });

      await createTripPage.createButton.click();
      await createTripPage.waitForStep(2);

      // Verify we're on step 2
      await expect(page).toHaveURL(/step=2/);

      // Go back to step 1
      await createTripPage.backButton.click();

      // Wait for the trip name input to be visible (step 1 indicator)
      await expect(createTripPage.tripNameInput).toBeVisible({ timeout: 10000 });

      // Verify step 1 fields are visible
      await expect(createTripPage.startDateInput).toBeVisible();
    });

    test('delete button appears after trip is created', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.loginAsTestUser();

      const homePage = new HomePage(page);
      await homePage.waitForLoading();
      await homePage.startCreateTrip();

      const createTripPage = new CreateTripPage(page);

      // Before creating, cancel button should be visible
      await expect(createTripPage.cancelButton).toBeVisible();

      // Complete step 1 to create the trip
      const tripName = generateTestName('DeleteBtn');
      const now = new Date();
      const startDate = now.toISOString().slice(0, 16);
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

      await createTripPage.fillBasics({
        name: tripName,
        startDate,
        endDate,
      });

      await createTripPage.createButton.click();
      await createTripPage.waitForStep(2);

      // After creating, delete button should appear
      await expect(createTripPage.deleteButton).toBeVisible();
    });
  });
});
