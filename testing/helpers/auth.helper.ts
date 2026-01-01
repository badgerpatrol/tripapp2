import { Page, BrowserContext, APIRequestContext } from '@playwright/test';
import { DatabaseHelper } from './database.helper';
import { DEFAULT_TEST_USER, ADMIN_TEST_USER, SUPERADMIN_TEST_USER } from '../config/test-constants';

/**
 * Firebase REST API response for sign in
 */
interface FirebaseSignInResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered: boolean;
}

// Global token cache shared across all AuthHelper instances
// This prevents hitting Firebase rate limits by reusing tokens
const globalTokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Authentication helper for handling login/logout in tests
 * Supports both UI-based login and direct Firebase API authentication for API testing
 */
export class AuthHelper {
  private page?: Page;
  private context?: BrowserContext;
  private request?: APIRequestContext;
  private db?: DatabaseHelper;
  // Use the global cache instead of instance cache
  private cachedTokens = globalTokenCache;

  constructor(options?: {
    page?: Page;
    context?: BrowserContext;
    request?: APIRequestContext;
  }) {
    this.page = options?.page;
    this.context = options?.context;
    this.request = options?.request;
  }

  /**
   * Initialize database connection
   */
  private async getDb(): Promise<DatabaseHelper> {
    if (!this.db) {
      this.db = await DatabaseHelper.getInstance();
    }
    return this.db;
  }

  // ============================================================================
  // FIREBASE REST API AUTHENTICATION
  // ============================================================================

  /**
   * Get a real Firebase ID token using the REST API
   * This authenticates against Firebase and returns a valid token for API calls
   *
   * @param email - User's email
   * @param password - User's password
   * @returns Firebase ID token
   */
  async getFirebaseToken(email: string, password: string): Promise<string> {
    // Check cache first
    const cacheKey = email;
    const cached = this.cachedTokens.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const apiKey = process.env.TEST_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Firebase API key not configured. Set FIREBASE_API_KEY in .env.test'
      );
    }

    // Firebase Auth REST API endpoint for email/password sign in
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Firebase authentication failed: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data: FirebaseSignInResponse = await response.json();

    // Cache the token (expires in 1 hour, cache for 55 minutes to be safe)
    const expiresAt = Date.now() + 55 * 60 * 1000;
    this.cachedTokens.set(cacheKey, { token: data.idToken, expiresAt });

    return data.idToken;
  }

  /**
   * Get a Firebase token for the default test user
   */
  async getTestUserToken(): Promise<string> {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'Test user credentials not configured. Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test'
      );
    }

    return this.getFirebaseToken(email, password);
  }

  /**
   * Get a Firebase token for the admin test user
   */
  async getAdminToken(): Promise<string> {
    const email = process.env.TEST_ADMIN_EMAIL;
    const password = process.env.TEST_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'Admin credentials not configured. Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env.test'
      );
    }

    return this.getFirebaseToken(email, password);
  }

  /**
   * Clear cached tokens (useful between test runs)
   */
  clearTokenCache(): void {
    this.cachedTokens.clear();
  }

  // ============================================================================
  // UI-BASED AUTHENTICATION
  // ============================================================================

  /**
   * Login as the default test user via UI
   */
  async loginAsTestUser(): Promise<void> {
    if (!this.page) throw new Error('Page not provided');
    await this.loginWithCredentials(
      process.env.TEST_USER_EMAIL || DEFAULT_TEST_USER.email,
      process.env.TEST_USER_PASSWORD || 'testpassword123'
    );
  }

  /**
   * Login as an admin user via UI
   */
  async loginAsAdmin(): Promise<void> {
    if (!this.page) throw new Error('Page not provided');
    await this.loginWithCredentials(
      process.env.TEST_ADMIN_EMAIL || ADMIN_TEST_USER.email,
      process.env.TEST_ADMIN_PASSWORD || 'adminpassword123'
    );
  }

  /**
   * Login as a superadmin user via UI
   */
  async loginAsSuperAdmin(): Promise<void> {
    if (!this.page) throw new Error('Page not provided');
    await this.loginWithCredentials(
      SUPERADMIN_TEST_USER.email,
      'superadminpassword123'
    );
  }

  /**
   * Login with email and password via UI
   */
  async loginWithCredentials(email: string, password: string): Promise<void> {
    if (!this.page) throw new Error('Page not provided');

    // Navigate to login if not already there
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/login') && !currentUrl.includes('/signin')) {
      await this.page.goto('/');
    }

    // Wait for login form
    await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill login form
    await this.page.fill('input[type="email"], input[name="email"]', email);
    await this.page.fill('input[type="password"], input[name="password"]', password);

    // Submit form
    await this.page.click('button[type="submit"]');

    // Wait for navigation to complete (should redirect to home/dashboard)
    await this.page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/signin'), {
      timeout: 15000,
    });
  }

  /**
   * Logout the current user via UI
   */
  async logout(): Promise<void> {
    if (!this.page) throw new Error('Page not provided');

    // Look for logout button or menu
    const logoutButton = this.page.locator('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout-button"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try opening user menu first
      const userMenu = this.page.locator('[data-testid="user-menu"], button:has-text("Me")');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await this.page.click('text=Logout, text=Sign out');
      }
    }

    // Wait for redirect to login page
    await this.page.waitForURL((url) => url.pathname.includes('/login') || url.pathname.includes('/signin') || url.pathname === '/', {
      timeout: 10000,
    });
  }

  // ============================================================================
  // SESSION STATE MANAGEMENT
  // ============================================================================

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.page) throw new Error('Page not provided');

    // Check for common logged-in indicators
    const loggedInIndicators = [
      '[data-testid="user-menu"]',
      'button:has-text("Logout")',
      'button:has-text("Sign out")',
      '[data-testid="user-avatar"]',
    ];

    for (const selector of loggedInIndicators) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch {
        // Element not found, continue checking
      }
    }

    return false;
  }

  /**
   * Wait for authentication to complete
   */
  async waitForAuth(timeout = 10000): Promise<void> {
    if (!this.page) throw new Error('Page not provided');

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await this.isLoggedIn()) {
        return;
      }
      await this.page.waitForTimeout(500);
    }
    throw new Error('Authentication did not complete in time');
  }

  /**
   * Create and store auth state for reuse
   */
  async saveAuthState(path: string): Promise<void> {
    if (!this.context) throw new Error('Context not provided');
    await this.context.storageState({ path });
  }

  /**
   * Clear all auth-related cookies and storage
   */
  async clearAuthState(): Promise<void> {
    if (!this.context) throw new Error('Context not provided');
    await this.context.clearCookies();

    if (this.page) {
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  }

  // ============================================================================
  // DATABASE HELPERS
  // ============================================================================

  /**
   * Ensure user exists in database and return user data
   */
  async ensureUserExists(userData: {
    id: string;
    email: string;
    displayName: string;
    role?: 'VIEWER' | 'USER' | 'ADMIN' | 'SUPERADMIN';
  }): Promise<any> {
    const db = await this.getDb();
    return db.createTestUser(userData);
  }

  /**
   * Get the current user from database
   */
  async getCurrentUser(userId: string): Promise<any> {
    const db = await this.getDb();
    return db.getUser(userId);
  }
}

/**
 * Create an auth helper with page context (for UI tests)
 */
export function createAuthHelper(page: Page, context?: BrowserContext): AuthHelper {
  return new AuthHelper({ page, context });
}

/**
 * Create an auth helper for API testing
 */
export function createApiAuthHelper(request?: APIRequestContext): AuthHelper {
  return new AuthHelper({ request });
}
