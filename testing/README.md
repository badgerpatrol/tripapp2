# TripPlanner Testing Framework

A comprehensive testing suite for the TripPlanner application using Playwright, covering UI testing, API testing, and database validation.

## Quick Reference

```bash
cd testing

# Run all tests
pnpm test

# Run specific test suites
pnpm test -- --project=ui          # UI tests (mobile Chrome)
pnpm test -- --project=api         # API tests
pnpm test -- --project=cleanup     # Cleanup test data via UI

# Run tests with visible browser
pnpm test:headed

# Clean up all test data from database
npx tsx utils/cleanup-all-test-data.ts

# View test report
pnpm test:report
```

## Table of Contents

- [Quick Reference](#quick-reference)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Test Data Cleanup](#test-data-cleanup)
- [Writing Tests](#writing-tests)
- [Test Types](#test-types)
- [Configuration](#configuration)
- [Helpers & Utilities](#helpers--utilities)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- PostgreSQL database for testing
- The main TripPlanner app running on localhost:3000

### Installation

```bash
cd testing
pnpm install
npx playwright install
```

### Configuration

1. Copy the environment template:
```bash
cp .env.test.example .env.test
```

2. Fill in your test configuration:
```env
BASE_URL=http://localhost:3000
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/tripplanner_test
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
```

### Quick Start

```bash
# Run all tests
pnpm test

# Run UI tests only
pnpm test:ui

# Run API tests only
pnpm test:api

# Run smoke tests (quick verification)
pnpm test:smoke

# Run tests in headed mode (see browser)
pnpm test:headed

# Debug a specific test
pnpm test:debug
```

## Project Structure

```
testing/
├── config/                    # Configuration files
│   ├── global-setup.ts        # Runs before all tests
│   ├── global-teardown.ts     # Runs after all tests
│   └── test-constants.ts      # Shared constants
│
├── helpers/                   # Test utilities
│   ├── api.helper.ts          # API request helpers
│   ├── auth.helper.ts         # Authentication helpers
│   └── database.helper.ts     # Database access helpers
│
├── page-objects/              # Page Object Model classes
│   ├── base.page.ts           # Base page class
│   ├── home.page.ts           # Home/trips list page
│   ├── login.page.ts          # Login page
│   ├── create-trip.page.ts    # Trip creation wizard
│   └── trip-detail.page.ts    # Trip detail page
│
├── fixtures/                  # Test data fixtures
│   └── test-data.ts           # Reusable test data
│
├── tests/                     # Test files
│   ├── auth.setup.ts          # Authentication setup
│   ├── e2e/                   # End-to-end UI tests
│   │   ├── smoke.spec.ts      # Smoke tests
│   │   ├── trips.spec.ts      # Trip management tests
│   │   ├── spends.spec.ts     # Spend tests
│   │   ├── choices.spec.ts    # Menu/choice tests
│   │   └── settlements.spec.ts # Settlement tests
│   ├── api/                   # API tests
│   │   ├── health.spec.ts     # Health check tests
│   │   ├── trips.spec.ts      # Trip API tests
│   │   ├── spends.spec.ts     # Spend API tests
│   │   └── choices.spec.ts    # Choice API tests
│   └── database/              # Database tests
│       ├── data-integrity.spec.ts # Constraint tests
│       └── queries.spec.ts    # Query tests
│
├── utils/                     # Utility scripts
│   ├── cleanup-all-test-data.ts # Clean up all test data from DB
│   ├── reset-test-database.ts   # Reset test DB
│   └── seed-test-data.ts        # Seed test data
│
├── playwright.config.ts       # Playwright configuration
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript configuration
```

## Running Tests

### By Project

```bash
# UI tests (Chrome Mobile)
pnpm test -- --project=ui

# UI tests (Desktop Chrome)
pnpm test -- --project=ui-desktop

# UI tests (Safari Mobile)
pnpm test -- --project=ui-safari

# API tests
pnpm test -- --project=api

# Database tests
pnpm test -- --project=database
```

### By Tag

```bash
# Smoke tests (quick validation)
pnpm test:smoke

# Critical path tests
pnpm test:critical

# Run tests matching a pattern
pnpm test -- --grep "Trip"
```

### Debug Mode

```bash
# Open Playwright Inspector
pnpm test:debug

# Run specific test in debug mode
pnpm test -- --debug tests/e2e/trips.spec.ts

# Generate test code using Codegen
pnpm test:codegen
```

### View Reports

```bash
# Open HTML report
pnpm test:report
```

## Test Data Cleanup

Tests create data with specific prefixes (`[E2E-TEST]`, `E2E Test`, `API Test`, etc.) for easy identification.

### Recommended: Database Cleanup Script

The most thorough cleanup method uses direct database access:

```bash
npx tsx utils/cleanup-all-test-data.ts
```

This script:
- Finds test data by name patterns and ID prefixes
- Deletes in proper foreign key order (handles all cascade relationships)
- Cleans: trips, list templates, groups, categories, system logs
- Reports deleted counts and remaining data

### Alternative: UI-Based Cleanup

```bash
pnpm test -- --project=cleanup
```

Uses browser automation to delete test data through the UI. Slower but mirrors real user actions.

### Test Data Naming Convention

Always prefix test data for easy identification:

```typescript
// Good - prefixed test data
const tripName = `[E2E-TEST] Trip ${Date.now()}`;
const listName = `E2E Test Checklist`;

// Bad - hard to identify as test data
const tripName = 'My Trip';
```

## Writing Tests

### E2E Tests (UI)

```typescript
import { test, expect } from '@playwright/test';
import { HomePage, TripDetailPage } from '../../page-objects';

test.describe('Trip Management', () => {
  test('can create a new trip', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto();
    await homePage.startCreateTrip();

    // Fill form and verify...
  });
});
```

### API Tests

```typescript
import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';

test.describe('Trip API', () => {
  test('GET /api/trips returns trips', async ({ request }) => {
    const api = new ApiHelper(request);
    api.setAuthToken('test-token');

    const response = await api.getTrips();
    expect(response.ok()).toBeTruthy();
  });
});
```

### Database Tests

```typescript
import { test, expect } from '@playwright/test';
import { DatabaseHelper } from '../../helpers/database.helper';

test.describe('Data Integrity', () => {
  let db: DatabaseHelper;

  test.beforeAll(async () => {
    db = await DatabaseHelper.getInstance();
  });

  test('trip must have a creator', async () => {
    await expect(
      db.client.trip.create({
        data: { name: 'Test', createdById: 'invalid' },
      })
    ).rejects.toThrow();
  });
});
```

## Test Types

### Smoke Tests (`@smoke`)
Quick tests to verify core functionality works. Run before deployments.

### Critical Tests (`@critical`)
Essential functionality that must never break. Run on every PR.

### E2E Tests
Full user journey tests through the UI.

### API Tests
Direct HTTP request tests against API endpoints.

### Database Tests
Data integrity, constraints, and query performance tests.

## Helpers & Utilities

### DatabaseHelper

```typescript
const db = await DatabaseHelper.getInstance();

// Create test data
const user = await db.createTestUser({ ... });
const trip = await db.createTestTrip({ ... });
const spend = await db.createTestSpend({ ... });

// Query data
const trips = await db.getUserTrips(userId);
const spend = await db.getSpend(spendId);

// Clean up
await db.cleanTestData();
```

### ApiHelper

```typescript
const api = new ApiHelper(request);
api.setAuthToken(token);

// CRUD operations
await api.createTrip({ name: 'Test' });
await api.getTrip(tripId);
await api.updateTrip(tripId, { name: 'Updated' });
await api.deleteTrip(tripId);
```

### AuthHelper

```typescript
const auth = new AuthHelper({ page, context });

await auth.loginAsTestUser();
await auth.loginAsAdmin();
await auth.logout();
```

## Best Practices

### 1. Use Page Objects
Encapsulate UI interactions in page objects for maintainability.

### 2. Clean Up Test Data
Always clean up test data in `afterEach` or `afterAll` hooks.

### 3. Use Test Prefixes
Prefix test data IDs with `test_` for easy identification and cleanup.

### 4. Tag Tests Appropriately
Use tags like `@smoke`, `@critical` for test organization.

### 5. Keep Tests Independent
Each test should be able to run in isolation.

### 6. Don't Sleep, Wait
Use `waitFor` methods instead of arbitrary `waitForTimeout`.

### 7. Parallelize When Possible
Design tests to run in parallel for faster execution.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: tripplanner_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd testing
          pnpm install
          npx playwright install --with-deps

      - name: Start app
        run: |
          cd code
          pnpm install
          pnpm dev &
          npx wait-on http://localhost:3000

      - name: Run tests
        run: |
          cd testing
          pnpm test
        env:
          BASE_URL: http://localhost:3000
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/tripplanner_test

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: testing/playwright-report
```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if app is running on correct port
- Verify database connection

### Authentication issues
- Ensure `.auth/user.json` exists after setup
- Check Firebase configuration
- Verify test user credentials

### Database connection errors
- Verify `TEST_DATABASE_URL` is correct
- Check PostgreSQL is running
- Ensure test database exists

### Flaky tests
- Add proper wait conditions
- Use `test.slow()` for known slow tests
- Check for race conditions

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Page Object Model](https://playwright.dev/docs/pom)
- [API Testing](https://playwright.dev/docs/api-testing)
- [Best Practices](https://playwright.dev/docs/best-practices)
