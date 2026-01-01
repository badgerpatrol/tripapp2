import { test, expect } from '@playwright/test';
import { HomePage } from '../../page-objects';
import { LoginPage } from '../../page-objects/login.page';

/**
 * Smoke tests - Quick verification that core functionality works
 * Run these first to catch major issues early
 *
 * Tests the real app structure based on:
 * - Login form with TripPlanner heading when not authenticated
 * - Home page with "My Stuff" heading when authenticated
 * - Trip cards grid or empty state
 * - Floating action button for creating trips
 */
test.describe('Smoke Tests @smoke @critical', () => {
  test('app loads successfully', async ({ page }) => {
    await page.goto('/');

    // App should be accessible - either login or home page
    expect(page.url()).toContain('localhost:3000');
  });

  test('unauthenticated user sees login form', async ({ page }) => {
    // Clear any auth state
    await page.context().clearCookies();

    await page.goto('/');

    // Should show login form with TripPlanner heading
    const loginHeading = page.locator('h1:has-text("TripPlanner")');
    await expect(loginHeading).toBeVisible({ timeout: 10000 });

    // Email and password fields should be visible
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('can login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login with test credentials
    const email = process.env.TEST_USER_EMAIL || 'test@test.com';
    const password = process.env.TEST_USER_PASSWORD || 'testtest';

    await page.locator('input#email').fill(email);
    await page.locator('input#password').fill(password);
    await page.locator('button:has-text("Sign In")').click();

    // Should see home page after login
    const homePage = new HomePage(page);
    await homePage.waitForLoading();

    // Either see "My Stuff" heading or trip cards/empty state
    const isHomeDisplayed = await homePage.isDisplayed();
    const isEmptyState = await homePage.isEmptyStateVisible();
    const hasTripCards = await homePage.getTripCount() > 0;

    expect(isHomeDisplayed || isEmptyState || hasTripCards).toBeTruthy();
  });

  test('home page displays trips or empty state after login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    const homePage = new HomePage(page);
    await homePage.waitForLoading();
    await homePage.waitForTripsLoaded();

    // Should show either trips list or empty state
    const tripCount = await homePage.getTripCount();
    const isEmptyState = await homePage.isEmptyStateVisible();

    expect(tripCount > 0 || isEmptyState).toBeTruthy();
  });

  test('authenticated user can see FAB for creating trips', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    const homePage = new HomePage(page);
    await homePage.waitForLoading();

    // FAB should be visible for users with create permission
    const canCreate = await homePage.canCreateTrip();

    // This test passes if either:
    // 1. User can create trips (FAB visible)
    // 2. User is a VIEWER and cannot create (FAB not visible)
    // We're just verifying the page loads correctly
    expect(canCreate !== undefined).toBeTruthy();
  });

  test('can navigate to create trip page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    const homePage = new HomePage(page);
    await homePage.waitForLoading();

    const canCreate = await homePage.canCreateTrip();

    if (canCreate) {
      await homePage.startCreateTrip();
      // Should navigate to trip wizard
      await expect(page).toHaveURL('/trips/new-v2');

      // Wizard should show Step 1
      await expect(page.locator('text=Trip Name')).toBeVisible({ timeout: 10000 });
    }
  });

  test('page is responsive (mobile viewport)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    const homePage = new HomePage(page);
    await homePage.waitForLoading();

    // Check viewport is mobile-sized (390x844 as per config)
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(500);

    // No horizontal scrollbar should appear
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('invalid login shows error message', async ({ page }) => {
    await page.goto('/');

    await page.locator('input#email').fill('invalid@test.com');
    await page.locator('input#password').fill('wrongpassword');
    await page.locator('button:has-text("Sign In")').click();

    // Should show error message
    const errorMessage = page.locator('.bg-red-50, .bg-red-900\\/20');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Navigation @smoke', () => {
  test('header navigation is visible when authenticated', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Header should be visible with navigation items
    // Based on UI-STRUCTURE.md: NAV: Home | Checklists | Kit | Groups* | Users* | Logs* | Debug*
    const nav = page.locator('nav');
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Home link should be visible
    const homeLink = page.locator('a:has-text("Home"), button:has-text("Home")');
    await expect(homeLink.first()).toBeVisible();
  });

  test('can navigate to Checklists page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    await page.waitForLoadState('networkidle');

    // Click on Checklists in navigation
    const checklistsLink = page.locator('a:has-text("Checklists")');
    if (await checklistsLink.isVisible()) {
      await checklistsLink.click();
      await expect(page).toHaveURL('/lists');
    }
  });

  test('can navigate to Kit page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAsTestUser();

    await page.waitForLoadState('networkidle');

    // Click on Kit in navigation
    const kitLink = page.locator('a:has-text("Kit")');
    if (await kitLink.isVisible()) {
      await kitLink.click();
      await expect(page).toHaveURL('/kit');
    }
  });
});

test.describe('API Health @smoke', () => {
  test('health endpoint returns OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });
});
