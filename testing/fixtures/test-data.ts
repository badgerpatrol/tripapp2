/**
 * Test data fixtures
 * Reusable test data for various test scenarios
 */

// ============================================================================
// TRIP FIXTURES
// ============================================================================

export const TRIP_FIXTURES = {
  minimal: {
    name: 'Minimal Trip',
  },

  complete: {
    name: 'Complete Trip',
    description: 'A fully configured trip for testing',
    location: 'London, UK',
    baseCurrency: 'GBP',
    startDate: '2025-03-01',
    endDate: '2025-03-07',
  },

  planning: {
    name: 'Planning Trip',
    description: 'Trip in planning phase',
    status: 'PLANNING' as const,
  },

  active: {
    name: 'Active Trip',
    description: 'Trip currently active',
    status: 'ACTIVE' as const,
  },

  finalized: {
    name: 'Finalized Trip',
    description: 'Trip that has been finalized',
    status: 'FINALIZED' as const,
  },

  settled: {
    name: 'Settled Trip',
    description: 'Trip that has been fully settled',
    status: 'SETTLED' as const,
  },
};

// ============================================================================
// SPEND FIXTURES
// ============================================================================

export const SPEND_FIXTURES = {
  simple: {
    description: 'Simple Expense',
    amount: 50.00,
  },

  withItems: {
    description: 'Multi-item Expense',
    amount: 150.00,
    items: [
      { name: 'Item 1', cost: 50.00 },
      { name: 'Item 2', cost: 75.00 },
      { name: 'Item 3', cost: 25.00 },
    ],
  },

  foreignCurrency: {
    description: 'Euro Expense',
    amount: 100.00,
    currency: 'EUR',
    fxRate: 0.85,
  },

  restaurant: {
    description: 'Dinner at Restaurant',
    amount: 120.00,
    categoryId: 'test_cat_food',
  },

  transport: {
    description: 'Taxi Ride',
    amount: 35.00,
    categoryId: 'test_cat_transport',
  },
};

// ============================================================================
// CHOICE FIXTURES
// ============================================================================

export const CHOICE_FIXTURES = {
  simple: {
    name: 'Simple Choice',
    description: 'A basic choice for testing',
  },

  menu: {
    name: 'Restaurant Menu',
    description: 'Choose your dinner',
    place: 'Test Restaurant',
    datetime: '2025-03-15T19:00:00Z',
    items: [
      { name: 'Starter A', price: 8.00, course: 'Starters' },
      { name: 'Starter B', price: 10.00, course: 'Starters' },
      { name: 'Main A', price: 18.00, course: 'Mains' },
      { name: 'Main B', price: 22.00, course: 'Mains' },
      { name: 'Dessert A', price: 6.00, course: 'Desserts' },
    ],
  },

  voting: {
    name: 'Activity Vote',
    description: 'Vote for weekend activity',
    items: [
      { name: 'Beach Day' },
      { name: 'Mountain Hike' },
      { name: 'City Tour' },
    ],
  },
};

// ============================================================================
// USER FIXTURES
// ============================================================================

export const USER_FIXTURES = {
  regularUser: {
    email: 'regular@test.com',
    displayName: 'Regular User',
    role: 'USER' as const,
  },

  viewer: {
    email: 'viewer@test.com',
    displayName: 'Viewer User',
    role: 'VIEWER' as const,
  },

  admin: {
    email: 'admin@test.com',
    displayName: 'Admin User',
    role: 'ADMIN' as const,
  },

  superadmin: {
    email: 'superadmin@test.com',
    displayName: 'Super Admin',
    role: 'SUPERADMIN' as const,
  },
};

// ============================================================================
// SETTLEMENT FIXTURES
// ============================================================================

export const SETTLEMENT_FIXTURES = {
  pending: {
    amount: 50.00,
    status: 'PENDING' as const,
  },

  partiallyPaid: {
    amount: 100.00,
    status: 'PARTIALLY_PAID' as const,
    payments: [{ amount: 40.00 }],
  },

  paid: {
    amount: 75.00,
    status: 'PAID' as const,
  },
};

// ============================================================================
// LIST FIXTURES
// ============================================================================

export const LIST_FIXTURES = {
  todoList: {
    title: 'Packing List',
    description: 'Things to pack for the trip',
    type: 'TODO' as const,
    items: [
      { label: 'Passport', notes: 'Check expiry date' },
      { label: 'Phone charger' },
      { label: 'Toiletries' },
      { label: 'Medication' },
    ],
  },

  kitList: {
    title: 'Camping Gear',
    description: 'Equipment for camping trip',
    type: 'KIT' as const,
    items: [
      { label: 'Tent', weightGrams: 2500, quantity: 1 },
      { label: 'Sleeping bag', weightGrams: 1200, quantity: 1 },
      { label: 'Camping stove', weightGrams: 800, quantity: 1 },
      { label: 'Headlamp', weightGrams: 100, quantity: 2 },
    ],
  },
};

// ============================================================================
// INVALID DATA FIXTURES (for negative testing)
// ============================================================================

export const INVALID_DATA = {
  emptyStrings: {
    tripName: '',
    spendDescription: '',
    choiceName: '',
  },

  invalidEmails: [
    'not-an-email',
    '@missing-local.com',
    'missing-domain@',
    'spaces in@email.com',
  ],

  invalidAmounts: [
    -100,
    NaN,
    Infinity,
    'not-a-number',
  ],

  invalidCurrencies: [
    'INVALID',
    '',
    '123',
    'GB',
    'GBPP',
  ],

  sqlInjection: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
  ],

  xssPayloads: [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    '"><script>alert(1)</script>',
  ],
};

// ============================================================================
// PERFORMANCE TEST DATA
// ============================================================================

export const PERFORMANCE_DATA = {
  largeTripMemberCount: 50,
  largeSpendCount: 100,
  largeChoiceItemCount: 200,

  generateLargeTrip: (memberCount: number) => ({
    name: 'Large Trip',
    members: Array(memberCount).fill(null).map((_, i) => ({
      email: `member${i}@test.com`,
      displayName: `Member ${i}`,
    })),
  }),

  generateManySpends: (count: number, tripId: string, paidById: string) =>
    Array(count).fill(null).map((_, i) => ({
      tripId,
      description: `Spend ${i}`,
      amount: Math.random() * 100,
      paidById,
    })),
};
