import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Home/Trips list page object
 * Represents the main landing page showing user's trips
 *
 * Based on app/page.tsx structure:
 * - Shows login form when not authenticated
 * - Shows "My Stuff" heading with trip cards grid when authenticated
 * - Has floating action button for creating trips
 * - Pending invitations section for PENDING RSVP trips
 */
export class HomePage extends BasePage {
  // Header
  readonly pageTitle: Locator;
  readonly pageSubtitle: Locator;

  // Trip cards - accepted trips displayed in grid
  readonly tripCardsGrid: Locator;
  readonly tripCard: Locator;

  // Pending invitations section
  readonly pendingInvitationsSection: Locator;
  readonly pendingInvitationCards: Locator;

  // Empty state
  readonly emptyState: Locator;
  readonly emptyStateMessage: Locator;
  readonly emptyStateCreateButton: Locator;

  // Floating action button
  readonly fabButton: Locator;

  // Error state
  readonly errorMessage: Locator;

  // Loading state
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    super(page);

    // Header elements
    this.pageTitle = page.locator('h1:has-text("My Stuff")');
    this.pageSubtitle = page.locator('p:has-text("Plot world domination")');

    // Trip cards - main grid of accepted trips
    this.tripCardsGrid = page.locator('.grid');
    this.tripCard = page.locator('a[href^="/trips/"]').filter({ has: page.locator('h3') });

    // Pending invitations
    this.pendingInvitationsSection = page.locator('h2:has-text("Pending Invitations")').locator('..');
    this.pendingInvitationCards = page.locator('a[href^="/trips/"]:has-text("PENDING")');

    // Empty state - white card with "No trips yet" message
    this.emptyState = page.locator('text=No trips yet').locator('..');
    this.emptyStateMessage = page.locator('text=No trips yet');
    this.emptyStateCreateButton = page.locator('button:has-text("Create Trip")');

    // Floating action button - plus button for creating trips
    this.fabButton = page.locator('button[aria-label="New trip"]');

    // Error message
    this.errorMessage = page.locator('.bg-red-50, .bg-red-900\\/20');

    // Loading
    this.loadingIndicator = page.locator('text=Loading...');
  }

  /**
   * Navigate to the home page
   */
  async goto(): Promise<void> {
    await this.navigateTo('/');
    await this.waitForLoading();
  }

  /**
   * Wait for home page to finish loading
   * This waits for:
   * 1. Loading indicator to disappear
   * 2. Either the page title (authenticated) or login form (not authenticated) to appear
   */
  async waitForLoading(): Promise<void> {
    // Wait for loading indicator to disappear
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

    // Wait for either the authenticated state (page title) or login form to appear
    await Promise.race([
      this.pageTitle.waitFor({ state: 'visible', timeout: 15000 }),
      this.page.locator('h1:has-text("TripPlanner")').waitFor({ state: 'visible', timeout: 15000 }),
    ]).catch(() => {});
  }

  /**
   * Check if home page is displayed (authenticated state)
   */
  async isDisplayed(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  /**
   * Check if login form is displayed (not authenticated)
   */
  async isLoginDisplayed(): Promise<boolean> {
    const loginForm = this.page.locator('h1:has-text("TripPlanner")');
    return this.isVisible(loginForm);
  }

  /**
   * Get all trip cards on the page (both accepted and pending)
   */
  getTripCards(): Locator {
    return this.tripCard;
  }

  /**
   * Get count of displayed trips
   */
  async getTripCount(): Promise<number> {
    return this.tripCard.count();
  }

  /**
   * Get count of pending invitations
   */
  async getPendingInvitationCount(): Promise<number> {
    return this.pendingInvitationCards.count();
  }

  /**
   * Click on a specific trip by name
   */
  async openTrip(tripName: string): Promise<void> {
    const card = this.tripCard.filter({ hasText: tripName }).first();
    await card.click();
    await this.page.waitForURL(/\/trips\/[a-f0-9-]+/);
  }

  /**
   * Click on the first trip card
   */
  async openFirstTrip(): Promise<void> {
    await this.tripCard.first().click();
    await this.page.waitForURL(/\/trips\/[a-f0-9-]+/);
  }

  /**
   * Start creating a new trip via FAB
   * Note: FAB visibility depends on userProfile being loaded (async after auth sync)
   */
  async startCreateTrip(): Promise<void> {
    // Wait for the page to fully load first
    await this.waitForLoading();

    // Wait for FAB to be visible - this depends on userProfile being loaded
    // which happens asynchronously after the /api/auth/sync call completes
    await this.fabButton.waitFor({ state: 'visible', timeout: 20000 });
    await this.fabButton.click();
    await this.page.waitForURL('/trips/new-v2', { timeout: 10000 });
  }

  /**
   * Start creating a new trip via empty state button
   */
  async startCreateTripFromEmptyState(): Promise<void> {
    await this.emptyStateCreateButton.click();
    await this.page.waitForURL('/trips/new-v2');
  }

  /**
   * Check if a trip with given name exists
   */
  async hasTripWithName(tripName: string): Promise<boolean> {
    const card = this.tripCard.filter({ hasText: tripName }).first();
    return this.isVisible(card, 5000);
  }

  /**
   * Get trip card details
   */
  async getTripCardDetails(tripName: string): Promise<{
    name: string;
    status?: string;
    memberCount?: string;
    organizer?: string;
  }> {
    const card = this.tripCard.filter({ hasText: tripName }).first();

    const name = await card.locator('h3').textContent() || tripName;

    // Status badge is a span with specific bg colors
    const statusBadge = card.locator('span').filter({ hasText: /PLANNING|ACTIVE|LIVE|FINISHED|PENDING|MAYBE/ }).first();
    const status = await statusBadge.textContent().catch(() => undefined);

    // Member count shows "X people" or "X person"
    const memberText = card.locator('text=/\\d+ (people|person)/').first();
    const memberCount = await memberText.textContent().catch(() => undefined);

    // Organizer shows "Organized by X"
    const organizerText = card.locator('text=/Organized by/').first();
    const organizer = await organizerText.textContent().catch(() => undefined);

    return {
      name: name.trim(),
      status: status?.trim(),
      memberCount: memberCount?.trim(),
      organizer: organizer?.replace('Organized by ', '').trim(),
    };
  }

  /**
   * Check if empty state is shown
   */
  async isEmptyStateVisible(): Promise<boolean> {
    return this.isVisible(this.emptyStateMessage);
  }

  /**
   * Check if error message is shown
   */
  async hasError(): Promise<boolean> {
    return this.isVisible(this.errorMessage);
  }

  /**
   * Check if FAB is visible (user can create trips)
   * Waits up to 10 seconds for the FAB to appear since userProfile loads async
   */
  async canCreateTrip(): Promise<boolean> {
    return this.isVisible(this.fabButton, 10000);
  }

  /**
   * Wait for trips to load (either shows trips or empty state)
   */
  async waitForTripsLoaded(): Promise<void> {
    await this.waitForLoading();
    // Wait for either trip cards, pending invitations, or empty state
    await Promise.race([
      this.tripCard.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.pendingInvitationCards.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.emptyStateMessage.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {
      // If none appear, that's okay - might be loading
    });
  }

  /**
   * Check if pending invitations section is visible
   */
  async hasPendingInvitations(): Promise<boolean> {
    return this.isVisible(this.pendingInvitationsSection);
  }
}
