# Testing Guidelines for TripApp2

This document outlines the standards and best practices for writing tests in this project.

## Test Environment

**IMPORTANT**: All tests run against the **local development environment**, not production.

- **Database**: Tests use the local PostgreSQL database at `postgresql://mikeprince@localhost:5432/tripplanner`
- **App Server**: Tests run against `http://localhost:3000` (started automatically by Playwright)
- **Firebase**: Tests use the dev Firebase project (`tripappdev-875d5`)

The test framework will:
1. Start the local dev server if not already running
2. Create/clean test data in the **local database**
3. Run tests against localhost

**Never run tests against production.** The production database connection should never be used in tests.

## Directory Structure

All testing code lives in the `/testing` directory, completely separate from the `/code` application:

```
/testing
├── config/              # Test configuration (setup, teardown)
├── fixtures/            # Test data and fixtures
├── helpers/             # API and auth helpers
├── page-objects/        # Page Object Model classes
├── tests/
│   ├── api/            # API tests
│   ├── database/       # Database tests
│   └── e2e/            # End-to-end UI tests
├── playwright.config.ts
├── .env.test           # Test environment variables
└── TESTING-GUIDELINES.md
```

## UI Test Requirements

### 1. Always Login Through the UI

**CRITICAL**: UI tests must always authenticate by going through the actual login flow, not by injecting tokens or using stored auth state directly.

```typescript
// ✅ CORRECT - Login through the UI
test('can create a trip', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAsTestUser();

  const homePage = new HomePage(page);
  await homePage.waitForLoading();
  // ... continue test
});

// ❌ WRONG - Directly navigating to authenticated pages
test('can create a trip', async ({ page }) => {
  await page.goto('/trips/new-v2');  // May fail - auth state not established
  // ...
});
```

### 2. Navigate Through Real User Actions

Always navigate using the UI elements a real user would click, not direct URL navigation.

```typescript
// ✅ CORRECT - Navigate through UI elements
await homePage.startCreateTrip();  // Clicks the FAB button
await expect(page).toHaveURL('/trips/new-v2');

// ❌ WRONG - Direct URL navigation after login
await page.goto('/trips/new-v2');  // Bypasses user flow
```

### 3. Use Real Selectors from the App

Page objects must use selectors that match actual elements in the rendered app. Get selectors by:
- Reading the actual React components in `/code/app`
- Using the browser DevTools to inspect elements
- Looking for semantic HTML (aria-labels, roles, data-testid attributes)

```typescript
// ✅ CORRECT - Real selectors from the app
this.pageTitle = page.locator('h1:has-text("My Stuff")');
this.tripCard = page.locator('a[href^="/trips/"]').filter({ has: page.locator('h3') });
this.fabButton = page.locator('button[aria-label="New trip"]');

// ❌ WRONG - Assumed selectors that don't exist
this.pageTitle = page.locator('[data-testid="page-title"]');  // May not exist
this.tripCard = page.locator('.trip-card');  // Class may not exist
```

### 4. Wait for Page State Properly

Always wait for the page to be in the expected state before interacting.

```typescript
// ✅ CORRECT - Wait for loading to complete
await homePage.waitForLoading();
await homePage.waitForTripsLoaded();

// ✅ CORRECT - Wait for specific elements
await expect(createTripPage.tripNameInput).toBeVisible({ timeout: 10000 });

// ❌ WRONG - Arbitrary delays
await page.waitForTimeout(5000);  // Flaky, wastes time
```

### 5. Handle Dynamic Content

Account for content that may or may not be present.

```typescript
// ✅ CORRECT - Handle conditional content
const tripCount = await homePage.getTripCount();
if (tripCount > 0) {
  await homePage.openFirstTrip();
  // ... test trip detail
}

// ✅ CORRECT - Check multiple possible states
const tripNotFound = await page.locator('text=Trip not found').isVisible({ timeout: 5000 }).catch(() => false);
const passwordPrompt = await page.locator('text=Trip Password').isVisible({ timeout: 1000 }).catch(() => false);
expect(tripNotFound || passwordPrompt).toBeTruthy();
```

## Page Object Model

### Structure

Each page object should:
1. Extend `BasePage` for common functionality
2. Define all locators in the constructor
3. Provide semantic methods for user actions

```typescript
export class MyPage extends BasePage {
  // Define locators
  readonly submitButton: Locator;
  readonly nameInput: Locator;

  constructor(page: Page) {
    super(page);
    this.submitButton = page.locator('button:has-text("Submit")');
    this.nameInput = page.locator('input#name');
  }

  // Semantic action methods
  async fillForm(data: { name: string }): Promise<void> {
    await this.nameInput.fill(data.name);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoading();
  }
}
```

### Locator Priority

Use this order of preference for selectors:
1. `aria-label` attributes (accessibility-first)
2. Semantic HTML roles and elements
3. Text content with `:has-text()`
4. ID attributes (`#id`)
5. `data-testid` attributes (if added to app)
6. CSS classes (last resort, most brittle)

## Test Organization

### File Naming

- `*.spec.ts` - Test files
- `*.page.ts` - Page object files
- `*.helper.ts` - Helper utilities

### Test Tags

Use tags to categorize tests:

```typescript
test.describe('Feature @smoke @critical', () => {
  // Critical tests that should always pass
});

test.describe('Feature @regression', () => {
  // Full regression tests
});
```

### Test Independence

Each test should:
- Be able to run independently
- Not depend on other tests' state
- Clean up after itself when possible

## API Tests

API tests can use direct HTTP calls but should still:
- Use real Firebase authentication tokens
- Test against the actual running app
- Verify response structures match the API spec

```typescript
test('creates a trip via API', async () => {
  const token = await auth.getTestUserToken();
  api.setAuthToken(token);

  const response = await api.createTrip({ name: 'Test Trip' });
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.trip.name).toBe('Test Trip');
});
```

## Environment Configuration

Test environment variables are in `.env.test`:

```env
# App URL
BASE_URL=http://localhost:3000

# Test credentials
TEST_USER_EMAIL=test@test.com
TEST_USER_PASSWORD=testtest

# Firebase config (for API tests)
TEST_FIREBASE_API_KEY=...
```

## Running Tests

```bash
# Run all UI tests
npx playwright test --project=ui

# Run specific test file
npx playwright test tests/e2e/trips.spec.ts --project=ui

# Run with visible browser
npx playwright test --headed

# Run specific test by name
npx playwright test -g "can create a trip"

# Run with debug mode
npx playwright test --debug
```

## Test Data Cleanup

Tests create data in the local database. To clean up test data:

### Comprehensive Database Cleanup (Recommended)

Use the cleanup script that directly accesses the database via Prisma:

```bash
cd testing
npx tsx utils/cleanup-all-test-data.ts
```

This script:
- Finds all test data by patterns: `[E2E-TEST]`, `E2E Test`, `E2E_`, `API Test`, `Test Trip`, etc.
- Deletes in proper foreign key order (cascade through all related tables)
- Cleans trips, list templates, groups, and orphaned data
- Reports what was deleted and remaining counts

### UI-Based Cleanup

Run the cleanup test suite (uses browser to delete via UI):

```bash
npx playwright test --project=cleanup
```

### Automatic Cleanup

The global teardown (`config/global-teardown.ts`) runs after each test suite.

### Test Data Naming Convention

All test-created data should use the `E2E Test` or `E2E_` prefix so it can be identified and cleaned up:

```typescript
// ✅ CORRECT - Prefixed test data
await nameInput.fill('E2E Test Trip');
await nameInput.fill('E2E_Menu_123');

// ❌ WRONG - No prefix, hard to identify as test data
await nameInput.fill('My Trip');
```

## Debugging Failed Tests

1. Check the test artifacts in `test-results/`:
   - Screenshots on failure
   - Video recordings
   - Error context (page snapshot)

2. Use the Playwright trace viewer:
   ```bash
   npx playwright show-trace test-results/*/trace.zip
   ```

3. Run with `--debug` flag to step through

4. Add `await page.pause()` to pause at specific points

## Common Issues

### Next.js Dev Overlay Blocking Clicks

In development, the Next.js overlay can intercept clicks. Use force click:

```typescript
await button.click({ force: true });
```

### Firebase Auth State Not Persisting

Always login through the UI at the start of each test. Don't rely on stored auth state for Firebase.

### Flaky Element Detection

Use explicit waits instead of implicit ones:

```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

### Mobile Viewport Issues

Tests run at 390x844 (mobile) by default. Account for:
- Responsive layouts
- Mobile-specific navigation (hamburger menus)
- Touch-friendly tap targets
