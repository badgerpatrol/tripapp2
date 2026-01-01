import { test, expect } from '@playwright/test';
import { ApiHelper, ChoiceResponse } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';

/**
 * Choice/Menu API tests
 * Uses real Firebase authentication
 */
test.describe('Choice API', () => {
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

    // Create a test trip for choice operations
    const tripResponse = await api.createTrip({
      name: `Choice API Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    // Clean up test trip (will cascade delete choices)
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('GET /api/trips/:id/choices', () => {
    test('returns choices for trip', async () => {
      // Create a test choice first
      await api.createChoice(testTripId, {
        name: 'Test Choice 1',
      });

      const response = await api.getChoices(testTripId);

      expect(response.ok()).toBeTruthy();

      const choices = await response.json();
      // API returns an array directly
      expect(Array.isArray(choices)).toBeTruthy();
      expect(choices.length).toBeGreaterThanOrEqual(1);
    });

    test('returns empty array for trip with no choices', async () => {
      const response = await api.getChoices(testTripId);

      expect(response.ok()).toBeTruthy();

      const choices = await response.json();
      expect(Array.isArray(choices)).toBeTruthy();
      expect(choices.length).toBe(0);
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.getChoices(testTripId);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('POST /api/trips/:id/choices', () => {
    test('creates a new choice', async () => {
      const choiceData = {
        name: 'Dinner Menu',
        description: 'Choose your dinner',
      };

      const response = await api.createChoice(testTripId, choiceData);

      expect(response.ok()).toBeTruthy();

      const choice = await response.json() as ChoiceResponse;
      // API returns the choice object directly
      expect(choice.name).toBe(choiceData.name);
      expect(choice.description).toBe(choiceData.description);
      expect(choice.id).toBeDefined();
    });

    test('validates required fields', async () => {
      const response = await api.createChoice(testTripId, {
        name: '',
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('defaults to OPEN status', async () => {
      const response = await api.createChoice(testTripId, {
        name: 'Status Test Menu',
      });

      const choice = await response.json() as ChoiceResponse;
      expect(choice.status).toBe('OPEN');
    });
  });

  test.describe('GET /api/choices/:id', () => {
    let testChoiceId: string;

    test.beforeEach(async () => {
      const createResponse = await api.createChoice(testTripId, {
        name: 'Get Choice Test',
      });
      const choice = await createResponse.json();
      testChoiceId = choice.id;
    });

    test('returns choice details', async () => {
      const response = await api.getChoice(testChoiceId);

      expect(response.ok()).toBeTruthy();

      const choice = await response.json() as ChoiceResponse;
      expect(choice.id).toBe(testChoiceId);
      expect(choice.name).toBe('Get Choice Test');
    });

    test('returns 404 for non-existent choice', async () => {
      const response = await api.getChoice('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PATCH /api/choices/:id', () => {
    let testChoiceId: string;

    test.beforeEach(async () => {
      const createResponse = await api.createChoice(testTripId, {
        name: 'Update Choice Test',
      });
      const choice = await createResponse.json();
      testChoiceId = choice.id;
    });

    test('updates choice name', async () => {
      const response = await api.updateChoice(testChoiceId, {
        name: 'Updated Menu Name',
      });

      expect(response.ok()).toBeTruthy();

      const choice = await response.json() as ChoiceResponse;
      expect(choice.name).toBe('Updated Menu Name');
    });

    test('updates choice status to closed', async () => {
      const response = await api.updateChoice(testChoiceId, {
        status: 'CLOSED',
      });

      expect(response.ok()).toBeTruthy();

      const choice = await response.json() as ChoiceResponse;
      expect(choice.status).toBe('CLOSED');
    });
  });

  test.describe('DELETE /api/choices/:id', () => {
    test('deletes a choice', async () => {
      // Create a choice to delete
      const createResponse = await api.createChoice(testTripId, {
        name: 'Delete Choice Test',
      });
      const choice = await createResponse.json();
      const choiceId = choice.id;

      const response = await api.deleteChoice(choiceId);

      expect(response.ok()).toBeTruthy();

      // Verify choice is no longer accessible (or archived)
      const getResponse = await api.getChoice(choiceId);
      expect(getResponse.status()).toBe(404);
    });

    test('returns 404 for non-existent choice', async () => {
      const response = await api.deleteChoice('00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });
});
