import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Trip detail page object
 * Represents the trip view at /trips/[id] with collapsible sections
 *
 * Main sections:
 * - Header with trip name, status, description, organizer, dates, participant count
 * - RSVP status (Accept/Decline/Maybe)
 * - Checklists section (collapsible)
 * - Kit Lists section (collapsible)
 * - People section (collapsible)
 * - Spend section (collapsible)
 * - Choices/Menus section (collapsible)
 * - Settlement section (collapsible)
 * - Timeline section (collapsible)
 */
export class TripDetailPage extends BasePage {
  // Header elements
  readonly tripHeader: Locator;
  readonly tripName: Locator;
  readonly tripStatus: Locator;
  readonly tripDescription: Locator;
  readonly organizerName: Locator;
  readonly editTripButton: Locator;
  readonly inviteButton: Locator;

  // RSVP section
  readonly rsvpSection: Locator;
  readonly acceptButton: Locator;
  readonly maybeButton: Locator;
  readonly declineButton: Locator;

  // Action buttons (in floating action area or header)
  readonly addSpendButton: Locator;
  readonly addChoiceButton: Locator;

  // Sections (collapsible)
  readonly checklistsSection: Locator;
  readonly kitListsSection: Locator;
  readonly peopleSection: Locator;
  readonly spendSection: Locator;
  readonly choicesSection: Locator;
  readonly settlementSection: Locator;
  readonly timelineSection: Locator;

  // Spend list
  readonly spendList: Locator;
  readonly spendCards: Locator;

  // People list
  readonly participantsList: Locator;

  // Choices list
  readonly choicesList: Locator;
  readonly choiceCards: Locator;

  // Error and loading states
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;
  readonly tripNotFound: Locator;

  constructor(page: Page) {
    super(page);

    // Header elements
    this.tripHeader = page.locator('.bg-white, .bg-zinc-800').first();
    this.tripName = page.locator('h1').first();
    this.tripStatus = page.locator('span.rounded-full').filter({ hasText: /PLANNING|ACTIVE|LIVE|FINISHED|SETTLED/ });
    this.tripDescription = page.locator('p.text-zinc-600, p.text-zinc-400');
    this.organizerName = page.locator('text=Organized by').locator('..');
    this.editTripButton = page.locator('button:has-text("Edit Trip"), button[aria-label="Edit trip"]');
    this.inviteButton = page.locator('button:has-text("Invite"), button[aria-label="Invite users"]');

    // RSVP section
    this.rsvpSection = page.locator('.bg-green-50, .bg-red-50, .bg-yellow-50, .bg-green-900\\/20, .bg-red-900\\/20, .bg-yellow-900\\/20');
    this.acceptButton = page.locator('button:has-text("Accept")');
    this.maybeButton = page.locator('button:has-text("Maybe")');
    this.declineButton = page.locator('button:has-text("Decline")');

    // Action buttons
    this.addSpendButton = page.locator('button:has-text("+ Spend"), button:has-text("Add Spend")');
    this.addChoiceButton = page.locator('button:has-text("+ Menu"), button:has-text("Add Menu"), button:has-text("+ Choice")');

    // Sections - identified by heading text
    this.checklistsSection = page.locator('h2:has-text("Checklists")').locator('..');
    this.kitListsSection = page.locator('h2:has-text("Kit Lists")').locator('..');
    this.peopleSection = page.locator('h2:has-text("People")').locator('..');
    this.spendSection = page.locator('h2:has-text("Spend")').locator('..');
    this.choicesSection = page.locator('h2:has-text("Menus")').locator('..');
    this.settlementSection = page.locator('h2:has-text("Settlement")').locator('..');
    this.timelineSection = page.locator('h2:has-text("Timeline")').locator('..');

    // Spend list
    this.spendList = page.locator('[data-testid="spend-list"], .spend-list');
    this.spendCards = page.locator('[data-testid="spend-card"], .spend-card, button:has-text("£"), button:has-text("$")');

    // People list
    this.participantsList = page.locator('[data-testid="participants-list"], .participants-list');

    // Choices list
    this.choicesList = page.locator('[data-testid="choices-list"], .choices-list');
    this.choiceCards = page.locator('[data-testid="choice-card"], .choice-card');

    // Error and loading
    this.errorMessage = page.locator('.bg-red-50, .text-red-600, .text-red-400');
    this.loadingIndicator = page.locator('text=Loading...');
    this.tripNotFound = page.locator('text=Trip not found');
  }

  /**
   * Navigate to trip detail page
   */
  async goto(): Promise<void> {
    throw new Error('Use gotoTrip(tripId) instead - TripDetailPage requires a tripId');
  }

  /**
   * Navigate to a specific trip detail page
   */
  async gotoTrip(tripId: string): Promise<void> {
    await this.navigateTo(`/trips/${tripId}`);
    await this.waitForLoading();
  }

  /**
   * Check if trip detail page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    // Wait for either trip content or error state
    await Promise.race([
      this.tripName.waitFor({ state: 'visible', timeout: 10000 }),
      this.tripNotFound.waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {});

    return this.isVisible(this.tripName);
  }

  /**
   * Check if trip was not found
   */
  async isTripNotFound(): Promise<boolean> {
    return this.isVisible(this.tripNotFound, 3000);
  }

  /**
   * Get the trip name
   */
  async getTripName(): Promise<string> {
    return (await this.tripName.textContent()) || '';
  }

  /**
   * Get the trip status
   */
  async getTripStatus(): Promise<string> {
    if (await this.tripStatus.isVisible()) {
      return (await this.tripStatus.textContent()) || '';
    }
    return '';
  }

  /**
   * Get trip description
   */
  async getTripDescription(): Promise<string> {
    if (await this.tripDescription.isVisible()) {
      return (await this.tripDescription.textContent()) || '';
    }
    return '';
  }

  // ============================================================================
  // RSVP OPERATIONS
  // ============================================================================

  /**
   * Accept the trip invitation
   */
  async acceptTrip(): Promise<void> {
    await this.acceptButton.click();
    await this.waitForLoading();
  }

  /**
   * Set RSVP to Maybe
   */
  async setMaybe(): Promise<void> {
    await this.maybeButton.click();
    await this.waitForLoading();
  }

  /**
   * Decline the trip invitation
   */
  async declineTrip(): Promise<void> {
    await this.declineButton.click();
    await this.waitForLoading();
  }

  /**
   * Get current RSVP status text
   */
  async getRsvpStatus(): Promise<string> {
    const rsvpText = await this.rsvpSection.locator('h3').textContent();
    return rsvpText || '';
  }

  // ============================================================================
  // SECTION NAVIGATION
  // ============================================================================

  /**
   * Expand a collapsible section
   */
  async expandSection(sectionName: 'checklists' | 'kitLists' | 'people' | 'spend' | 'choices' | 'settlement' | 'timeline'): Promise<void> {
    const sectionMap = {
      checklists: this.checklistsSection,
      kitLists: this.kitListsSection,
      people: this.peopleSection,
      spend: this.spendSection,
      choices: this.choicesSection,
      settlement: this.settlementSection,
      timeline: this.timelineSection,
    };

    const section = sectionMap[sectionName];
    if (section) {
      const expandButton = section.locator('button[aria-label*="Expand"]');
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await this.page.waitForTimeout(300);
      }
    }
  }

  /**
   * Collapse a collapsible section
   */
  async collapseSection(sectionName: 'checklists' | 'kitLists' | 'people' | 'spend' | 'choices' | 'settlement' | 'timeline'): Promise<void> {
    const sectionMap = {
      checklists: this.checklistsSection,
      kitLists: this.kitListsSection,
      people: this.peopleSection,
      spend: this.spendSection,
      choices: this.choicesSection,
      settlement: this.settlementSection,
      timeline: this.timelineSection,
    };

    const section = sectionMap[sectionName];
    if (section) {
      const collapseButton = section.locator('button[aria-label*="Collapse"]');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await this.page.waitForTimeout(300);
      }
    }
  }

  // ============================================================================
  // SPEND OPERATIONS
  // ============================================================================

  /**
   * Open add spend dialog
   */
  async openAddSpendDialog(): Promise<void> {
    await this.addSpendButton.click();
    await this.waitForDialog();
  }

  /**
   * Get spend count
   */
  async getSpendCount(): Promise<number> {
    await this.page.waitForTimeout(500); // Wait for list to load
    return this.spendCards.count();
  }

  /**
   * Click on a specific spend by description
   */
  async openSpend(description: string): Promise<void> {
    const spendCard = this.page.locator(`button:has-text("${description}")`).first();
    await spendCard.click();
    await this.waitForDialog();
  }

  // ============================================================================
  // CHOICE/MENU OPERATIONS
  // ============================================================================

  /**
   * Open create choice dialog
   */
  async openCreateChoiceDialog(): Promise<void> {
    await this.addChoiceButton.click();
    await this.waitForDialog();
  }

  /**
   * Get choice count
   */
  async getChoiceCount(): Promise<number> {
    await this.page.waitForTimeout(500);
    return this.choiceCards.count();
  }

  /**
   * Open a specific choice by name
   */
  async openChoice(name: string): Promise<void> {
    const choiceCard = this.page.locator(`[data-testid="choice-card"]:has-text("${name}"), button:has-text("${name}")`).first();
    await choiceCard.click();
    await this.waitForDialog();
  }

  // ============================================================================
  // EDIT OPERATIONS
  // ============================================================================

  /**
   * Open edit trip dialog
   */
  async openEditTripDialog(): Promise<void> {
    await this.editTripButton.click();
    await this.waitForDialog();
  }

  /**
   * Open invite users dialog
   */
  async openInviteDialog(): Promise<void> {
    await this.inviteButton.click();
    await this.waitForDialog();
  }

  // ============================================================================
  // PARTICIPANT OPERATIONS
  // ============================================================================

  /**
   * Get participant count from the header
   */
  async getParticipantCount(): Promise<number> {
    const countText = await this.page.locator('text=/\\d+ people?|no-one/').textContent();
    if (!countText || countText.includes('no-one')) return 0;
    const match = countText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ============================================================================
  // TIMELINE OPERATIONS
  // ============================================================================

  /**
   * Check if timeline section is visible
   */
  async hasTimeline(): Promise<boolean> {
    return this.isVisible(this.timelineSection, 2000);
  }

  /**
   * Get timeline item count
   */
  async getTimelineItemCount(): Promise<number> {
    if (await this.hasTimeline()) {
      await this.expandSection('timeline');
      const items = this.timelineSection.locator('.space-y-4 > div, [data-testid="timeline-item"]');
      return items.count();
    }
    return 0;
  }
}
