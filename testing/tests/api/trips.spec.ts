import { test, expect } from '@playwright/test';
import { ApiHelper, TripResponse } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';
import { PATTERNS } from '../../config/test-constants';

/**
 * Trip API tests
 * Uses real Firebase authentication
 */
test.describe('Trip API @critical', () => {
  let api: ApiHelper;
  let auth: AuthHelper;

  test.beforeAll(async () => {
    auth = createApiAuthHelper();
  });

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
    // Get real Firebase token
    const token = await auth.getTestUserToken();
    api.setAuthToken(token);
  });

  test.describe('GET /api/trips', () => {
    test('returns list of trips for authenticated user', async () => {
      const response = await api.getTrips();

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { trips: [...] }
      expect(body.trips).toBeDefined();
      expect(Array.isArray(body.trips)).toBeTruthy();
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.getTrips();

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/trips', () => {
    test('creates a new trip', async () => {
      const tripData = {
        name: `API Test Trip ${Date.now()}`,
        description: 'Created via API test',
        baseCurrency: 'GBP',
      };

      const response = await api.createTrip(tripData);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { success: true, trip: {...} }
      expect(body.success).toBe(true);
      expect(body.trip).toBeDefined();
      expect(body.trip.name).toBe(tripData.name);
      expect(body.trip.description).toBe(tripData.description);
      expect(body.trip.baseCurrency).toBe(tripData.baseCurrency);
      expect(body.trip.id).toMatch(PATTERNS.uuid);

      // Clean up
      await api.deleteTrip(body.trip.id);
    });

    test('validates required fields', async () => {
      const response = await api.createTrip({
        name: '', // Empty name should fail
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('sets correct defaults', async () => {
      const response = await api.createTrip({
        name: `API Test Trip Defaults ${Date.now()}`,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.trip.status).toBe('PLANNING');
      // Currency should have a default
      expect(body.trip.baseCurrency).toBeTruthy();

      // Clean up
      await api.deleteTrip(body.trip.id);
    });
  });

  test.describe('GET /api/trips/:id', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      // Create a trip via API for testing
      const response = await api.createTrip({
        name: `API Test Trip Get ${Date.now()}`,
      });
      const body = await response.json();
      testTripId = body.trip.id;
    });

    test.afterEach(async () => {
      if (testTripId) {
        await api.deleteTrip(testTripId).catch(() => {});
      }
    });

    test('returns trip details', async () => {
      const response = await api.getTrip(testTripId);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { trip: {...} }
      expect(body.trip).toBeDefined();
      expect(body.trip.id).toBe(testTripId);
    });

    test('returns 404 for non-existent trip', async () => {
      const response = await api.getTrip('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });

    test('includes members in response', async () => {
      const response = await api.getTrip(testTripId);
      const body = await response.json();

      expect(body.trip.members).toBeDefined();
      expect(Array.isArray(body.trip.members)).toBeTruthy();
    });
  });

  test.describe('PUT /api/trips/:id', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      const response = await api.createTrip({
        name: `API Test Trip Update ${Date.now()}`,
      });
      const body = await response.json();
      testTripId = body.trip.id;
    });

    test.afterEach(async () => {
      if (testTripId) {
        await api.deleteTrip(testTripId).catch(() => {});
      }
    });

    test('updates trip name', async () => {
      const response = await api.updateTrip(testTripId, {
        name: 'Updated Trip Name',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { success: true, trip: {...} }
      expect(body.success).toBe(true);
      expect(body.trip.name).toBe('Updated Trip Name');
    });

    test('updates trip status', async () => {
      const response = await api.updateTrip(testTripId, {
        status: 'ACTIVE',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.trip.status).toBe('ACTIVE');
    });
  });

  test.describe('DELETE /api/trips/:id', () => {
    test('deletes a trip', async () => {
      // Create a trip to delete
      const createResponse = await api.createTrip({
        name: `API Test Trip Delete ${Date.now()}`,
      });
      const createBody = await createResponse.json();
      const tripId = createBody.trip.id;

      const response = await api.deleteTrip(tripId);

      expect(response.ok()).toBeTruthy();

      // Verify trip is no longer accessible
      const getResponse = await api.getTrip(tripId);
      expect(getResponse.status()).toBe(404);
    });

    test('returns 404 for non-existent trip', async () => {
      const response = await api.deleteTrip('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('GET /api/trips/:id/balances', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      const response = await api.createTrip({
        name: `API Test Trip Balances ${Date.now()}`,
      });
      const body = await response.json();
      testTripId = body.trip.id;
    });

    test.afterEach(async () => {
      if (testTripId) {
        await api.deleteTrip(testTripId).catch(() => {});
      }
    });

    test('returns balance information', async () => {
      const response = await api.getTripBalances(testTripId);

      expect(response.ok()).toBeTruthy();

      const balances = await response.json();
      expect(balances).toBeDefined();
    });
  });
});
