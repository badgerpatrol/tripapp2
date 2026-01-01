/**
 * Test Data Prefix Configuration
 *
 * All test-created data MUST use this prefix so it can be reliably
 * detected and cleaned up after tests.
 *
 * The prefix includes a unique identifier that won't appear in real user data.
 */

// Unique prefix that identifies test-created data
// Format: "[E2E-TEST]" - square brackets make it unlikely to appear in real data
export const TEST_DATA_PREFIX = '[E2E-TEST]';

// Alternative shorter prefix for backward compatibility
export const TEST_DATA_PREFIX_SHORT = 'E2E Test';

// Legacy prefixes that cleanup should also detect
export const LEGACY_PREFIXES = ['E2E Test', 'E2E_', 'E2E ', 'Test Trip', 'Test '];

/**
 * Generate a unique test item name with the standard prefix
 * @param itemType - Type of item (Trip, Spend, Choice, etc.)
 * @returns Unique name with prefix and timestamp
 */
export function generateTestName(itemType: string): string {
  return `${TEST_DATA_PREFIX} ${itemType} ${Date.now()}`;
}

/**
 * Check if a name matches any test data prefix
 * @param name - Name to check
 * @returns true if the name appears to be test data
 */
export function isTestData(name: string): boolean {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return (
    name.startsWith(TEST_DATA_PREFIX) ||
    LEGACY_PREFIXES.some(prefix => lowerName.startsWith(prefix.toLowerCase()))
  );
}

/**
 * SQL pattern for finding test data in database queries
 * Use with LIKE or SIMILAR TO
 */
export const TEST_DATA_SQL_PATTERNS = [
  "[E2E-TEST]%",
  "E2E Test%",
  "E2E\\_%",
  "Test Trip%",
  "Test %"
];
