import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page object class that all page objects extend
 * Provides common functionality and utilities
 */
export abstract class BasePage {
  protected page: Page;
  protected baseUrl: string;

  constructor(page: Page, baseUrl?: string) {
    this.page = page;
    this.baseUrl = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * Navigate to this page
   */
  abstract goto(): Promise<void>;

  /**
   * Check if this page is currently displayed
   */
  abstract isDisplayed(): Promise<boolean>;

  // ============================================================================
  // COMMON NAVIGATION
  // ============================================================================

  /**
   * Navigate to a URL
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(`${this.baseUrl}${path}`);
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(timeout = 30000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Get current path
   */
  getCurrentPath(): string {
    const url = new URL(this.page.url());
    return url.pathname;
  }

  // ============================================================================
  // COMMON ELEMENT INTERACTIONS
  // ============================================================================

  /**
   * Click an element
   */
  async click(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.click();
  }

  /**
   * Fill an input field
   */
  async fill(selector: string | Locator, value: string): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.fill(value);
  }

  /**
   * Clear and fill an input field
   */
  async clearAndFill(selector: string | Locator, value: string): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.clear();
    await locator.fill(value);
  }

  /**
   * Get text content of an element
   */
  async getText(selector: string | Locator): Promise<string | null> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    return locator.textContent();
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string | Locator, timeout = 5000): Promise<boolean> {
    try {
      const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string | Locator, timeout = 10000): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(selector: string | Locator, timeout = 10000): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Select option from dropdown
   */
  async selectOption(selector: string | Locator, value: string): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.selectOption(value);
  }

  /**
   * Check a checkbox or radio button
   */
  async check(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.check();
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.uncheck();
  }

  // ============================================================================
  // COMMON ASSERTIONS
  // ============================================================================

  /**
   * Assert element contains text
   */
  async expectText(selector: string | Locator, expectedText: string | RegExp): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toContainText(expectedText);
  }

  /**
   * Assert element has exact text
   */
  async expectExactText(selector: string | Locator, expectedText: string): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toHaveText(expectedText);
  }

  /**
   * Assert element is visible
   */
  async expectVisible(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toBeVisible();
  }

  /**
   * Assert element is hidden
   */
  async expectHidden(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toBeHidden();
  }

  /**
   * Assert element count
   */
  async expectCount(selector: string | Locator, count: number): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await expect(locator).toHaveCount(count);
  }

  /**
   * Assert URL contains path
   */
  async expectUrl(pathOrPattern: string | RegExp): Promise<void> {
    if (typeof pathOrPattern === 'string') {
      await expect(this.page).toHaveURL(new RegExp(pathOrPattern));
    } else {
      await expect(this.page).toHaveURL(pathOrPattern);
    }
  }

  // ============================================================================
  // MOBILE NAVIGATION (Bottom Tab Bar)
  // ============================================================================

  /**
   * Navigate using bottom tab bar
   */
  async navigateToTab(tabName: 'Trips' | 'Spend' | 'Assign' | 'Checklists' | 'Settle' | 'Me'): Promise<void> {
    const tabButton = this.page.locator(`[data-testid="tab-${tabName.toLowerCase()}"], button:has-text("${tabName}")`).first();
    await tabButton.click();
    await this.waitForNavigation();
  }

  // ============================================================================
  // DIALOG/MODAL HANDLING
  // ============================================================================

  /**
   * Wait for a dialog to appear
   */
  async waitForDialog(dialogSelector = '[role="dialog"], [data-testid*="dialog"]', timeout = 10000): Promise<Locator> {
    const dialog = this.page.locator(dialogSelector).first();
    await dialog.waitFor({ state: 'visible', timeout });
    return dialog;
  }

  /**
   * Close current dialog
   */
  async closeDialog(): Promise<void> {
    const closeButton = this.page.locator('[data-testid="dialog-close"], button[aria-label="Close"], button:has-text("Close")').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Try pressing Escape
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(300); // Wait for animation
  }

  // ============================================================================
  // TOAST/NOTIFICATION HANDLING
  // ============================================================================

  /**
   * Wait for a toast notification
   */
  async waitForToast(message?: string, timeout = 5000): Promise<Locator> {
    const toastSelector = '[role="alert"], [data-testid="toast"], .toast';
    const toast = this.page.locator(toastSelector).first();
    await toast.waitFor({ state: 'visible', timeout });
    if (message) {
      await expect(toast).toContainText(message);
    }
    return toast;
  }

  /**
   * Dismiss toast notification
   */
  async dismissToast(): Promise<void> {
    const dismissButton = this.page.locator('[data-testid="toast-dismiss"], .toast button').first();
    if (await dismissButton.isVisible({ timeout: 1000 })) {
      await dismissButton.click();
    }
  }

  // ============================================================================
  // LOADING STATE HANDLING
  // ============================================================================

  /**
   * Wait for loading to complete
   */
  async waitForLoading(timeout = 30000): Promise<void> {
    const loadingIndicators = [
      '[data-testid="loading"]',
      '.loading',
      '[aria-busy="true"]',
      'text=Loading...',
    ];

    for (const selector of loadingIndicators) {
      const loading = this.page.locator(selector).first();
      try {
        await loading.waitFor({ state: 'hidden', timeout });
      } catch {
        // Loading indicator not found or already hidden
      }
    }
  }

  // ============================================================================
  // SCROLL HANDLING
  // ============================================================================

  /**
   * Scroll to element
   */
  async scrollTo(selector: string | Locator): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Scroll to bottom of page
   */
  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  /**
   * Scroll to top of page
   */
  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  // ============================================================================
  // SCREENSHOT HELPERS
  // ============================================================================

  /**
   * Take a screenshot
   */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
