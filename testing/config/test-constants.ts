/**
 * Test constants and configuration values
 */

// Test user IDs (prefixed to identify test data)
export const TEST_PREFIX = 'test_';

// Default test user
export const DEFAULT_TEST_USER = {
  id: 'test_user_001',
  email: 'testuser@tripplanner.test',
  displayName: 'Test User',
  role: 'USER' as const,
  userType: 'FULL' as const,
};

// Admin test user
export const ADMIN_TEST_USER = {
  id: 'test_admin_001',
  email: 'testadmin@tripplanner.test',
  displayName: 'Test Admin',
  role: 'ADMIN' as const,
  userType: 'FULL' as const,
};

// Superadmin test user
export const SUPERADMIN_TEST_USER = {
  id: 'test_superadmin_001',
  email: 'testsuperadmin@tripplanner.test',
  displayName: 'Test Superadmin',
  role: 'SUPERADMIN' as const,
  userType: 'FULL' as const,
};

// Secondary test user (for multi-user scenarios)
export const SECONDARY_TEST_USER = {
  id: 'test_user_002',
  email: 'testuser2@tripplanner.test',
  displayName: 'Test User 2',
  role: 'USER' as const,
  userType: 'FULL' as const,
};

// Default test trip
export const DEFAULT_TEST_TRIP = {
  id: 'test_trip_001',
  name: 'Test Trip',
  description: 'A trip for automated testing',
  location: 'Test Location',
  baseCurrency: 'GBP',
  status: 'PLANNING' as const,
};

// Test categories
export const TEST_CATEGORIES = [
  { id: 'test_cat_food', name: 'Food & Drink', icon: '🍕', color: '#FF6B6B', isDefault: true },
  { id: 'test_cat_transport', name: 'Transport', icon: '🚗', color: '#4ECDC4', isDefault: true },
  { id: 'test_cat_accommodation', name: 'Accommodation', icon: '🏨', color: '#45B7D1', isDefault: true },
  { id: 'test_cat_activities', name: 'Activities', icon: '🎯', color: '#96CEB4', isDefault: true },
  { id: 'test_cat_other', name: 'Other', icon: '📦', color: '#DDA0DD', isDefault: true },
];

// Timeouts
export const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 30000,
  navigation: 30000,
  api: 15000,
};

// API Endpoints
export const API_ENDPOINTS = {
  auth: {
    sync: '/api/auth/sync',
    session: '/api/auth/session',
  },
  trips: {
    list: '/api/trips',
    create: '/api/trips',
    get: (id: string) => `/api/trips/${id}`,
    update: (id: string) => `/api/trips/${id}`,
    delete: (id: string) => `/api/trips/${id}`,
    balances: (id: string) => `/api/trips/${id}/balances`,
    members: (id: string) => `/api/trips/${id}/members`,
  },
  spends: {
    list: '/api/spends',
    create: '/api/spends',
    get: (id: string) => `/api/spends/${id}`,
    update: (id: string) => `/api/spends/${id}`,
    delete: (id: string) => `/api/spends/${id}`,
  },
  choices: {
    list: (tripId: string) => `/api/trips/${tripId}/choices`,
    create: (tripId: string) => `/api/trips/${tripId}/choices`,
    get: (id: string) => `/api/choices/${id}`,
    update: (id: string) => `/api/choices/${id}`,
    delete: (id: string) => `/api/choices/${id}`,
  },
  settlements: {
    list: (tripId: string) => `/api/trips/${tripId}/settlements`,
    payments: (id: string) => `/api/settlements/${id}/payments`,
  },
  lists: {
    templates: '/api/lists/templates',
    publicTemplates: '/api/lists/templates/public',
    instances: '/api/lists/instances',
  },
  groups: {
    list: '/api/groups',
    create: '/api/groups',
    get: (id: string) => `/api/groups/${id}`,
  },
  admin: {
    users: '/api/admin/users',
    logs: '/api/admin/logs',
  },
  health: '/api/health',
};

// Test data patterns
export const PATTERNS = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  currency: /^[A-Z]{3}$/,
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
};
