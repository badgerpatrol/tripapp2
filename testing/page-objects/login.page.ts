import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Login page object
 * Handles user authentication flows
 */
export class LoginPage extends BasePage {
  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signUpLink: Locator;
  readonly forgotPasswordLink: Locator;

  // Passkey elements
  readonly passkeyButton: Locator;

  // Error messages
  readonly errorMessage: Locator;

  // Alternative login methods
  readonly googleLoginButton: Locator;

  constructor(page: Page) {
    super(page);

    // Form elements
    this.emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]');
    this.passwordInput = page.locator('input[type="password"], input[name="password"]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    this.signUpLink = page.locator('a:has-text("Sign up"), a:has-text("Create account"), button:has-text("Sign up")');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot password"), a:has-text("Reset password")');

    // Passkey
    this.passkeyButton = page.locator('[data-testid="passkey-login"], button:has-text("Passkey"), button:has-text("Use passkey")');

    // Error
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message, [role="alert"]');

    // Alternative methods
    this.googleLoginButton = page.locator('[data-testid="google-login"], button:has-text("Google")');
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/');
    // Wait for either login form or redirect if already logged in
    await Promise.race([
      this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 }),
      this.page.waitForURL(/\/trips/, { timeout: 10000 }),
    ]);
  }

  /**
   * Check if login page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return (await this.isVisible(this.emailInput)) && (await this.isVisible(this.passwordInput));
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    // Wait for either success (redirect) or error
    await Promise.race([
      this.page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/signin'), { timeout: 15000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  }

  /**
   * Login with valid test credentials
   * Skips login if already authenticated (session restored from storageState)
   */
  async loginAsTestUser(): Promise<void> {
    // Wait for page to load - either login form or home page
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Check if already logged in (session restored from auth setup)
    // Wait longer as page might be loading async data
    const isAlreadyLoggedIn = await this.page.locator('h1:has-text("My Stuff")').isVisible({ timeout: 5000 }).catch(() => false);
    if (isAlreadyLoggedIn) {
      return; // Already logged in, skip Firebase login
    }

    // Check for Firebase quota exceeded error - if so, wait and retry once
    const quotaError = await this.page.locator('text=quota-exceeded').isVisible({ timeout: 1000 }).catch(() => false);
    if (quotaError) {
      console.log('Firebase quota exceeded, waiting 5 seconds before retry...');
      await this.page.waitForTimeout(5000);
      // Reload and try again
      await this.page.reload();
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    }

    // Check if we're on the login form
    const isLoginForm = await this.isDisplayed();
    if (!isLoginForm) {
      // Not on login form - wait a bit and check again for home page
      const laterCheck = await this.page.locator('h1:has-text("My Stuff")').isVisible({ timeout: 3000 }).catch(() => false);
      if (laterCheck) {
        return; // Now logged in
      }
      // Still not on home or login, return and let test handle it
      return;
    }

    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'testpassword123';
    await this.login(email, password);
  }

  /**
   * Login with admin credentials
   */
  async loginAsAdmin(): Promise<void> {
    const email = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.TEST_ADMIN_PASSWORD || 'adminpassword123';
    await this.login(email, password);
  }

  /**
   * Check if login failed
   */
  async hasError(): Promise<boolean> {
    return this.isVisible(this.errorMessage, 3000);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) || '';
  }

  /**
   * Go to sign up page
   */
  async goToSignUp(): Promise<void> {
    await this.signUpLink.click();
    await this.waitForNavigation();
  }

  /**
   * Go to forgot password page
   */
  async goToForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.waitForNavigation();
  }

  /**
   * Initiate passkey login
   */
  async loginWithPasskey(): Promise<void> {
    if (await this.passkeyButton.isVisible()) {
      await this.passkeyButton.click();
      // Note: Passkey login requires browser automation setup
      // This will trigger the WebAuthn prompt
    } else {
      throw new Error('Passkey login button not available');
    }
  }

  /**
   * Initiate Google login
   */
  async loginWithGoogle(): Promise<void> {
    if (await this.googleLoginButton.isVisible()) {
      await this.googleLoginButton.click();
      // Note: This will open Google's OAuth flow
    } else {
      throw new Error('Google login button not available');
    }
  }

  /**
   * Wait for successful login
   */
  async waitForLoginSuccess(timeout = 15000): Promise<void> {
    await this.page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/signin'), { timeout });
  }

  /**
   * Check if password field is visible (for determining auth state)
   */
  async isPasswordRequired(): Promise<boolean> {
    return this.isVisible(this.passwordInput);
  }
}
