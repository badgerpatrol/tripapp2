// Types for the v2 Create Trip Wizard

// Represents a choice created during trip creation (already saved to DB)
export interface CreatedChoice {
  id: string; // real server-side id
  name: string;
  description?: string;
  datetime?: string;
  place?: string;
  itemCount: number; // number of menu items added
}

export interface WizardState {
  // Trip ID (set after Step 1 completes)
  tripId: string | null;

  // Step 1 - Basics
  name: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string;
  description: string;

  // Step 2 - Details
  location: string;
  baseCurrency: string;

  // Step 3 - Invite options
  allowNamedPeople: boolean;
  allowSignup: boolean;

  // Step 4 - Invites (transient, written to DB)
  selectedUserIds: string[];
  namedInvitees: string[];

  // Step 5 - Join code (generated on demand)
  tripJoinCode: string | null;

  // Step 6 - Choices (created during wizard, already saved to DB)
  createdChoices: CreatedChoice[];

  // Step 7 - Cover image
  headerImageData: string | null;
  headerImagePreview: string | null;
}

export const INITIAL_WIZARD_STATE: WizardState = {
  tripId: null,
  name: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  description: '',
  location: '',
  baseCurrency: 'GBP',
  allowNamedPeople: false,
  allowSignup: false,
  selectedUserIds: [],
  namedInvitees: [],
  tripJoinCode: null,
  createdChoices: [],
  headerImageData: null,
  headerImagePreview: null,
};

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Basics',
  2: 'Details',
  3: 'Who Can Join',
  4: 'Invite People',
  5: 'Share',
  6: 'Choices',
  7: 'Cover Image',
};

export interface StepProps {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  setHideFooter?: (hide: boolean) => void;
}

// Currency options
export const CURRENCY_OPTIONS = [
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
];
