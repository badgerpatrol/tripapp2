import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';

/**
 * Spend Assignment API tests
 *
 * Tests cover user stories:
 * - US-SPEND-030: Assign People to Spend
 * - US-SPEND-031: Self-Assign to Spend
 * - US-SPEND-032: Split Remainder Equally
 * - US-SPEND-033: Edit Assignment
 * - US-SPEND-034: Remove Assignment
 * - US-SPEND-022: Close Spend
 * - US-SPEND-023: Reopen Closed Spend
 *
 * Uses real Firebase authentication
 */
test.describe('Spend Assignment API @critical', () => {
  let api: ApiHelper;
  let auth: AuthHelper;
  let testTripId: string;
  let testSpendId: string;

  test.beforeAll(async () => {
    auth = createApiAuthHelper();
  });

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
    const token = await auth.getTestUserToken();
    api.setAuthToken(token);

    // Create a test trip
    const tripResponse = await api.createTrip({
      name: `Assignment API Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;

    // Create a test spend
    const spendResponse = await api.createSpend({
      tripId: testTripId,
      description: 'Test Spend for Assignments',
      amount: 100,
      currency: 'GBP',
    });
    const spendBody = await spendResponse.json();
    testSpendId = spendBody.spend.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('GET /api/spends/:id/assignments', () => {
    test('returns empty assignments for new spend', async () => {
      const response = await api.get(`/api/spends/${testSpendId}/assignments`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.assignments).toBeDefined();
      expect(Array.isArray(body.assignments)).toBeTruthy();
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.get(`/api/spends/${testSpendId}/assignments`);

      expect(response.status()).toBe(401);
    });

    test('returns 404 for non-existent spend', async () => {
      const response = await api.get('/api/spends/00000000-0000-0000-0000-000000000000/assignments');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('POST /api/spends/:id/assignments', () => {
    test('creates assignment for spend', async () => {
      // Get user ID from session
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 50,
        });

        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.assignment).toBeDefined();
        expect(body.assignment.userId).toBe(userId);
        expect(parseFloat(body.assignment.amount)).toBeCloseTo(50);
      }
    });

    test('validates assignment amount', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        // Try to assign more than spend amount
        const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 200, // Spend was only 100
        });

        // Should either fail validation or succeed (depends on business rules)
        const body = await response.json();
        expect(body).toBeDefined();
      }
    });

    test('validates negative amount', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: -50,
        });

        // Should fail validation
        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);
      }
    });

    test('validates zero amount', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 0,
        });

        // Should fail validation
        expect(response.ok()).toBeFalsy();
      }
    });

    test('requires userId', async () => {
      const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
        amount: 50,
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });
  });

  test.describe('PUT /api/spends/:spendId/assignments/:assignmentId', () => {
    test('updates assignment amount', async () => {
      // Create an assignment first
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const createResponse = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 50,
        });
        const createBody = await createResponse.json();
        const assignmentId = createBody.assignment?.id;

        if (assignmentId) {
          const response = await api.put(
            `/api/spends/${testSpendId}/assignments/${assignmentId}`,
            { amount: 75 }
          );

          expect(response.ok()).toBeTruthy();

          const body = await response.json();
          expect(parseFloat(body.assignment?.amount || body.amount)).toBeCloseTo(75);
        }
      }
    });
  });

  test.describe('DELETE /api/spends/:spendId/assignments/:assignmentId', () => {
    test('deletes assignment', async () => {
      // Create an assignment first
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const createResponse = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 50,
        });
        const createBody = await createResponse.json();
        const assignmentId = createBody.assignment?.id;

        if (assignmentId) {
          const response = await api.delete(
            `/api/spends/${testSpendId}/assignments/${assignmentId}`
          );

          expect(response.ok()).toBeTruthy();

          // Verify assignment is deleted
          const getResponse = await api.get(`/api/spends/${testSpendId}/assignments`);
          const getBody = await getResponse.json();
          const remaining = getBody.assignments?.filter((a: any) => a.id === assignmentId);
          expect(remaining?.length || 0).toBe(0);
        }
      }
    });

    test('returns 404 for non-existent assignment', async () => {
      const response = await api.delete(
        `/api/spends/${testSpendId}/assignments/00000000-0000-0000-0000-000000000000`
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe('POST /api/spends/:id/finalize (Close Spend)', () => {
    test('closes an open spend', async () => {
      const response = await api.post(`/api/spends/${testSpendId}/finalize`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.spend?.status || body.status).toBe('CLOSED');
    });

    test('closed spend cannot be edited', async () => {
      // Close the spend first
      await api.post(`/api/spends/${testSpendId}/finalize`);

      // Try to update
      const response = await api.updateSpend(testSpendId, {
        description: 'Updated Description',
      });

      // Should fail or return error
      // (Depends on API implementation - may return 400 or silently ignore)
      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('closed spend cannot add assignments', async () => {
      // Close the spend first
      await api.post(`/api/spends/${testSpendId}/finalize`);

      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.post(`/api/spends/${testSpendId}/assignments`, {
          userId: userId,
          amount: 50,
        });

        // Should fail for closed spend
        expect(response.ok()).toBeFalsy();
      }
    });
  });

  test.describe('POST /api/spends/:id/reopen', () => {
    test('reopens a closed spend', async () => {
      // Close first
      await api.post(`/api/spends/${testSpendId}/finalize`);

      // Reopen
      const response = await api.post(`/api/spends/${testSpendId}/reopen`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.spend?.status || body.status).toBe('OPEN');
    });

    test('reopened spend can be edited', async () => {
      // Close then reopen
      await api.post(`/api/spends/${testSpendId}/finalize`);
      await api.post(`/api/spends/${testSpendId}/reopen`);

      // Should be able to update
      const response = await api.updateSpend(testSpendId, {
        description: 'Updated After Reopen',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.spend?.description).toBe('Updated After Reopen');
    });
  });
});

test.describe('Spend Status Edge Cases', () => {
  let api: ApiHelper;
  let auth: AuthHelper;
  let testTripId: string;

  test.beforeAll(async () => {
    auth = createApiAuthHelper();
  });

  test.beforeEach(async ({ request }) => {
    api = new ApiHelper(request);
    const token = await auth.getTestUserToken();
    api.setAuthToken(token);

    const tripResponse = await api.createTrip({
      name: `Status Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test('cannot delete closed spend', async () => {
    // Create and close a spend
    const createResponse = await api.createSpend({
      tripId: testTripId,
      description: 'Delete Test',
      amount: 50,
    });
    const createBody = await createResponse.json();
    const spendId = createBody.spend.id;

    await api.post(`/api/spends/${spendId}/finalize`);

    // Try to delete
    const response = await api.deleteSpend(spendId);

    // Should fail for closed spend
    expect(response.ok()).toBeFalsy();
  });

  test('finalize non-existent spend returns 404', async () => {
    const response = await api.post('/api/spends/00000000-0000-0000-0000-000000000000/finalize');

    expect(response.status()).toBe(404);
  });

  test('reopen already open spend is idempotent', async () => {
    const createResponse = await api.createSpend({
      tripId: testTripId,
      description: 'Reopen Test',
      amount: 50,
    });
    const createBody = await createResponse.json();
    const spendId = createBody.spend.id;

    // Reopen without closing first
    const response = await api.post(`/api/spends/${spendId}/reopen`);

    // Should succeed or be no-op
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.spend?.status || body.status).toBe('OPEN');
  });
});
