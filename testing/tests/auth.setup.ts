import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../page-objects';

const authFile = '.auth/user.json';

/**
 * Authentication setup that runs before all tests
 * Logs in once and saves the session state for reuse
 */
setup('authenticate', async ({ page, context }) => {
  const loginPage = new LoginPage(page);

  // Navigate to the app
  await loginPage.goto();

  // Check if already logged in
  const isLoggedIn = await page.locator('[data-testid="user-menu"], button:has-text("Logout")').isVisible({ timeout: 3000 }).catch(() => false);

  if (!isLoggedIn) {
    // Perform login
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';

    console.log(`Logging in with email: ${email}`);

    await loginPage.login(email, password);

    // Verify login succeeded
    await expect(page).not.toHaveURL(/\/login|\/signin/, { timeout: 15000 });

    console.log('Login successful, saving auth state...');
  }

  // Save signed-in state
  await context.storageState({ path: authFile });
  console.log(`Auth state saved to ${authFile}`);
});
