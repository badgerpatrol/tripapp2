import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Create Trip Wizard page object
 * Represents the 7-step trip creation wizard at /trips/new-v2
 *
 * Steps:
 * 1. Basics - Name, dates, description
 * 2. Details - Location, base currency
 * 3. Invite Options - Allow named people, allow signup
 * 4. Invite Selection - Select users to invite
 * 5. Share - Share link (conditional)
 * 6. Choices - Add menus/choices
 * 7. Cover Image - Upload header image
 */
export class CreateTripPage extends BasePage {
  // Header
  readonly pageTitle: Locator;
  readonly stepIndicator: Locator;

  // Footer Navigation (fixed at bottom)
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly backButton: Locator;
  readonly nextButton: Locator;
  readonly createButton: Locator;
  readonly finishButton: Locator;

  // Step 1: Basics
  readonly tripNameInput: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly descriptionInput: Locator;

  // Step 2: Details
  readonly locationInput: Locator;
  readonly currencySelect: Locator;

  // Step 3: Invite Options
  readonly allowNamedPeopleToggle: Locator;
  readonly allowSignupToggle: Locator;

  // Step 4: Invite Selection
  readonly userSearchInput: Locator;
  readonly userList: Locator;
  readonly selectedUsersList: Locator;

  // Step 5: Share
  readonly shareLink: Locator;
  readonly copyLinkButton: Locator;

  // Step 6: Choices
  readonly addChoiceButton: Locator;
  readonly choicesList: Locator;

  // Step 7: Cover Image
  readonly imageUploadInput: Locator;
  readonly skipImageButton: Locator;
  readonly imagePreview: Locator;

  // Error message
  readonly errorMessage: Locator;

  // Loading indicator
  readonly loadingText: Locator;

  constructor(page: Page) {
    super(page);

    // Header
    this.pageTitle = page.locator('h1:has-text("Create Trip")');
    this.stepIndicator = page.locator('p.text-xs:has-text("Step")');

    // Footer Navigation - based on WizardFooterNav.tsx
    this.cancelButton = page.locator('button:has-text("Cancel")');
    this.deleteButton = page.locator('button:has-text("Delete")');
    this.backButton = page.locator('button:has-text("Back")');
    this.nextButton = page.locator('button:has-text("Next"), button:has-text("Create")');
    this.createButton = page.locator('button:has-text("Create")');
    this.finishButton = page.locator('button:has-text("Finish")');

    // Step 1: Basics - from Step1Basics.tsx
    this.tripNameInput = page.locator('input#name');
    this.startDateInput = page.locator('input#startDate');
    this.endDateInput = page.locator('input#endDate');
    this.descriptionInput = page.locator('textarea#description');

    // Step 2: Details - from Step2Details.tsx
    this.locationInput = page.locator('input#location');
    this.currencySelect = page.locator('select#baseCurrency');

    // Step 3: Invite Options
    this.allowNamedPeopleToggle = page.locator('[data-testid="allow-named-people"], input[name="allowNamedPeople"]');
    this.allowSignupToggle = page.locator('[data-testid="allow-signup"], input[name="allowSignup"]');

    // Step 4: Invite Selection
    this.userSearchInput = page.locator('input[placeholder*="Search"], input[placeholder*="email"]');
    this.userList = page.locator('[data-testid="user-list"], .user-list');
    this.selectedUsersList = page.locator('[data-testid="selected-users"], .selected-users');

    // Step 5: Share
    this.shareLink = page.locator('[data-testid="share-link"], input[readonly]');
    this.copyLinkButton = page.locator('button:has-text("Copy")');

    // Step 6: Choices
    this.addChoiceButton = page.locator('button:has-text("Add"), button:has-text("Create Choice")');
    this.choicesList = page.locator('[data-testid="choices-list"], .choices-list');

    // Step 7: Cover Image
    this.imageUploadInput = page.locator('input[type="file"]');
    this.skipImageButton = page.locator('button:has-text("Skip")');
    this.imagePreview = page.locator('[data-testid="image-preview"], img');

    // Error message - from step components
    this.errorMessage = page.locator('.bg-red-50, .bg-red-900\\/20');

    // Loading
    this.loadingText = page.locator('text=Loading...');
  }

  /**
   * Navigate to create trip wizard
   */
  async goto(): Promise<void> {
    await this.navigateTo('/trips/new-v2');
    await this.waitForLoading();
  }

  /**
   * Check if wizard is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return this.isVisible(this.pageTitle);
  }

  /**
   * Get current step number from URL or indicator
   */
  async getCurrentStep(): Promise<number> {
    const url = this.getCurrentUrl();
    const stepMatch = url.match(/step=(\d+)/);
    if (stepMatch) {
      return parseInt(stepMatch[1], 10);
    }
    return 1;
  }

  /**
   * Wait for specific step to be active
   */
  async waitForStep(stepNumber: number): Promise<void> {
    await this.page.waitForURL(new RegExp(`step=${stepNumber}`), { timeout: 10000 });
    await this.waitForLoading();
  }

  /**
   * Go to next step
   */
  async nextStep(): Promise<void> {
    await this.nextButton.click();
    await this.waitForLoading();
  }

  /**
   * Go to previous step
   */
  async previousStep(): Promise<void> {
    await this.backButton.click();
    await this.waitForLoading();
  }

  /**
   * Cancel trip creation
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForNavigation();
  }

  /**
   * Delete the trip being created
   */
  async deleteTrip(): Promise<void> {
    await this.deleteButton.click();
    // Handle confirmation modal
    const confirmButton = this.page.locator('button:has-text("Delete")').last();
    await confirmButton.click();
    await this.waitForNavigation();
  }

  /**
   * Finish the wizard
   */
  async finish(): Promise<void> {
    await this.finishButton.click();
    await this.waitForNavigation();
  }

  // ============================================================================
  // STEP 1: BASICS
  // ============================================================================

  /**
   * Fill step 1 - basic trip info (name, dates, description)
   */
  async fillBasics(data: {
    name: string;
    startDate: string; // format: 2025-02-01T10:00
    endDate: string;
    description?: string;
  }): Promise<void> {
    await this.tripNameInput.fill(data.name);
    await this.startDateInput.fill(data.startDate);
    await this.endDateInput.fill(data.endDate);

    if (data.description) {
      await this.descriptionInput.fill(data.description);
    }
  }

  // ============================================================================
  // STEP 2: DETAILS
  // ============================================================================

  /**
   * Fill step 2 - location and currency
   */
  async fillDetails(data: {
    location?: string;
    currency?: string;
  }): Promise<void> {
    if (data.location) {
      await this.locationInput.fill(data.location);
    }

    if (data.currency) {
      await this.currencySelect.selectOption(data.currency);
    }
  }

  // ============================================================================
  // STEP 3: INVITE OPTIONS
  // ============================================================================

  /**
   * Configure invite options
   */
  async setInviteOptions(data: {
    allowNamedPeople?: boolean;
    allowSignup?: boolean;
  }): Promise<void> {
    if (data.allowNamedPeople !== undefined) {
      const isChecked = await this.allowNamedPeopleToggle.isChecked();
      if (isChecked !== data.allowNamedPeople) {
        await this.allowNamedPeopleToggle.click();
      }
    }

    if (data.allowSignup !== undefined) {
      const isChecked = await this.allowSignupToggle.isChecked();
      if (isChecked !== data.allowSignup) {
        await this.allowSignupToggle.click();
      }
    }
  }

  // ============================================================================
  // STEP 4: INVITE SELECTION
  // ============================================================================

  /**
   * Search and select users to invite
   */
  async inviteUsers(emails: string[]): Promise<void> {
    for (const email of emails) {
      if (await this.userSearchInput.isVisible()) {
        await this.userSearchInput.fill(email);
        await this.page.waitForTimeout(500);
        // Click on the user in results
        const userItem = this.page.locator(`text=${email}`).first();
        if (await userItem.isVisible()) {
          await userItem.click();
        }
      }
    }
  }

  // ============================================================================
  // STEP 7: COVER IMAGE
  // ============================================================================

  /**
   * Upload a cover image
   */
  async uploadCoverImage(imagePath: string): Promise<void> {
    await this.imageUploadInput.setInputFiles(imagePath);
    await this.waitForLoading();
  }

  /**
   * Skip the cover image step
   */
  async skipCoverImage(): Promise<void> {
    // On step 7, just click Finish to skip
    await this.finishButton.click();
  }

  // ============================================================================
  // COMPLETE FLOW
  // ============================================================================

  /**
   * Complete the minimal trip creation flow
   * Creates a trip with just name and dates, skipping optional steps
   */
  async createTrip(tripData: {
    name: string;
    startDate: string;
    endDate: string;
    description?: string;
    location?: string;
    currency?: string;
  }): Promise<void> {
    // Step 1: Fill basics
    await this.fillBasics({
      name: tripData.name,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      description: tripData.description,
    });

    // Click "Create" button on step 1 to create the trip
    await this.createButton.click();
    await this.waitForLoading();

    // Wait for step 2
    await this.waitForStep(2);

    // Step 2: Fill details (optional)
    if (tripData.location || tripData.currency) {
      await this.fillDetails({
        location: tripData.location,
        currency: tripData.currency,
      });
    }
    await this.nextStep();

    // Step 3: Skip invite options
    await this.nextStep();

    // Step 4: Skip invite selection
    await this.nextStep();

    // Steps 5-6: Skip through
    // Step 5 may be skipped automatically based on step 3 options
    const currentStep = await this.getCurrentStep();
    if (currentStep === 5) {
      await this.nextStep();
    }

    // Step 6: Skip choices
    await this.nextStep();

    // Step 7: Finish (skip cover image)
    await this.finishButton.click();
    await this.waitForNavigation();
  }

  /**
   * Quick create a trip with minimal info
   */
  async quickCreate(name: string): Promise<void> {
    const now = new Date();
    const startDate = now.toISOString().slice(0, 16); // Format: 2025-02-01T10:00
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

    await this.createTrip({
      name,
      startDate,
      endDate,
    });
  }

  /**
   * Check if there's an error message visible
   */
  async hasError(): Promise<boolean> {
    return this.isVisible(this.errorMessage, 2000);
  }

  /**
   * Get error message text
   */
  async getErrorText(): Promise<string> {
    if (await this.hasError()) {
      return (await this.errorMessage.textContent()) || '';
    }
    return '';
  }
}
