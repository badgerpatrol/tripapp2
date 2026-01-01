import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test file
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

export default defineConfig({
  // Test directory
  testDir: './tests',

  // Test file patterns
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // Global timeout for each test
  timeout: 60000,

  // Timeout for expect assertions
  expect: {
    timeout: 10000,
  },

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Number of workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  // Global setup and teardown
  globalSetup: './config/global-setup.ts',
  globalTeardown: './config/global-teardown.ts',

  // Shared settings for all projects
  use: {
    // Base URL for all requests
    baseURL: BASE_URL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',

    // Viewport size (mobile-first as per app design)
    viewport: { width: 390, height: 844 },

    // Default timeout for actions
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Extra HTTP headers for API requests
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  // Configure projects for different types of testing
  projects: [
    // Authentication setup
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // UI Tests - Mobile Chrome (primary)
    {
      name: 'ui',
      testDir: './tests/e2e',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // UI Tests - Desktop Chrome
    {
      name: 'ui-desktop',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // UI Tests - Safari Mobile
    {
      name: 'ui-safari',
      testDir: './tests/e2e',
      use: {
        ...devices['iPhone 13'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // API Tests
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        // No browser needed for API tests
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Database Tests
    {
      name: 'database',
      testDir: './tests/database',
      use: {
        // No browser needed for database tests
      },
    },

    // Cleanup Tests - Run to clean up test data
    {
      name: 'cleanup',
      testDir: './tests/cleanup',
      use: {
        ...devices['Pixel 5'],
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Web server configuration
  webServer: {
    command: 'cd ../code && pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
