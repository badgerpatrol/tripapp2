import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';

/**
 * Spend API tests
 * Uses real Firebase authentication
 */
test.describe('Spend API @critical', () => {
  let api: ApiHelper;
  let auth: AuthHelper;
  let testTripId: string;

  test.beforeAll(async () => {
    auth = createApiAuthHelper();
  });

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
    // Get real Firebase token
    const token = await auth.getTestUserToken();
    api.setAuthToken(token);

    // Create a test trip for spend operations
    const tripResponse = await api.createTrip({
      name: `Spend API Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    // Clean up test trip (will cascade delete spends)
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('GET /api/spends', () => {
    test('returns spends for trip', async () => {
      // Create a test spend first
      await api.createSpend({
        tripId: testTripId,
        description: 'Test Spend 1',
        amount: 50,
      });

      const response = await api.getSpends(testTripId);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { success: true, spends: [...], count: N }
      expect(body.success).toBe(true);
      expect(body.spends).toBeDefined();
      expect(Array.isArray(body.spends)).toBeTruthy();
      expect(body.count).toBeGreaterThanOrEqual(1);
    });

    test('returns empty array for trip with no spends', async () => {
      const response = await api.getSpends(testTripId);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.spends).toBeDefined();
      expect(Array.isArray(body.spends)).toBeTruthy();
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.getSpends(testTripId);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/spends', () => {
    test('creates a new spend', async () => {
      const spendData = {
        tripId: testTripId,
        description: 'New API Spend',
        amount: 123.45,
        currency: 'GBP',
      };

      const response = await api.createSpend(spendData);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { success: true, spend: {...} }
      expect(body.success).toBe(true);
      expect(body.spend).toBeDefined();
      expect(body.spend.description).toBe(spendData.description);
      expect(body.spend.amount).toBeCloseTo(spendData.amount);
      expect(body.spend.currency).toBe(spendData.currency);
    });

    test('validates required fields', async () => {
      const response = await api.createSpend({
        tripId: testTripId,
        description: '',
        amount: 0,
      });

      // Should fail validation
      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('requires tripId', async () => {
      const response = await api.createSpend({
        tripId: '',
        description: 'Missing Trip',
        amount: 50,
      });

      expect(response.ok()).toBeFalsy();
    });
  });

  test.describe('GET /api/spends/:id', () => {
    let testSpendId: string;

    test.beforeEach(async () => {
      const createResponse = await api.createSpend({
        tripId: testTripId,
        description: 'Get Spend Test',
        amount: 100,
      });
      const body = await createResponse.json();
      testSpendId = body.spend.id;
    });

    test('returns spend details', async () => {
      const response = await api.getSpend(testSpendId);

      expect(response.ok()).toBeTruthy();

      const spend = await response.json();
      expect(spend.id).toBe(testSpendId);
      expect(spend.description).toBe('Get Spend Test');
    });

    test('returns 404 for non-existent spend', async () => {
      const response = await api.getSpend('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PUT /api/spends/:id', () => {
    let testSpendId: string;

    test.beforeEach(async () => {
      const createResponse = await api.createSpend({
        tripId: testTripId,
        description: 'Update Spend Test',
        amount: 100,
      });
      const body = await createResponse.json();
      testSpendId = body.spend.id;
    });

    test('updates spend description', async () => {
      const response = await api.updateSpend(testSpendId, {
        description: 'Updated Description',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.spend.description).toBe('Updated Description');
    });

    test('updates spend amount', async () => {
      const response = await api.updateSpend(testSpendId, {
        amount: 150,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.spend.amount).toBeCloseTo(150);
    });
  });

  test.describe('DELETE /api/spends/:id', () => {
    test('deletes a spend', async () => {
      // Create a spend to delete
      const createResponse = await api.createSpend({
        tripId: testTripId,
        description: 'Delete Spend Test',
        amount: 50,
      });
      const createBody = await createResponse.json();
      const spendId = createBody.spend.id;

      const response = await api.deleteSpend(spendId);

      expect(response.ok()).toBeTruthy();

      // Verify spend is no longer accessible
      const getResponse = await api.getSpend(spendId);
      expect(getResponse.status()).toBe(404);
    });

    test('returns 404 for non-existent spend', async () => {
      const response = await api.deleteSpend('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });
});
