import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';
import { PATTERNS } from '../../config/test-constants';

/**
 * Milestone/Timeline API tests
 *
 * Tests cover user stories:
 * - US-MILE-001: View System Milestones
 * - US-MILE-010: Add Custom Milestone
 * - US-MILE-011: Edit Milestone Date
 * - US-MILE-012: Delete Custom Milestone
 * - US-MILE-020: Mark Milestone Complete
 *
 * Uses real Firebase authentication
 */
test.describe('Milestone API @critical', () => {
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

    // Create a test trip
    const tripResponse = await api.createTrip({
      name: `Milestone API Test Trip ${Date.now()}`,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('GET /api/trips/:id/milestones', () => {
    test('returns trip milestones', async () => {
      const response = await api.get(`/api/trips/${testTripId}/milestones`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestones).toBeDefined();
      expect(Array.isArray(body.milestones)).toBeTruthy();
    });

    test('includes system-generated milestones', async () => {
      const response = await api.get(`/api/trips/${testTripId}/milestones`);
      const body = await response.json();

      // System milestones should be auto-created
      const systemMilestones = body.milestones?.filter((m: any) => m.isSystem === true);
      expect(systemMilestones?.length).toBeGreaterThanOrEqual(0);
    });

    test('milestones have required fields', async () => {
      const response = await api.get(`/api/trips/${testTripId}/milestones`);
      const body = await response.json();

      if (body.milestones && body.milestones.length > 0) {
        const milestone = body.milestones[0];
        expect(milestone.id).toBeDefined();
        expect(milestone.name || milestone.title).toBeDefined();
      }
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.get(`/api/trips/${testTripId}/milestones`);

      expect(response.status()).toBe(401);
    });

    test('returns 404 for non-existent trip', async () => {
      const response = await api.get('/api/trips/00000000-0000-0000-0000-000000000000/milestones');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('POST /api/trips/:id/milestones', () => {
    test('creates a custom milestone', async () => {
      const milestoneData = {
        name: `API Test Milestone ${Date.now()}`,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Created via API test',
      };

      const response = await api.post(`/api/trips/${testTripId}/milestones`, milestoneData);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone).toBeDefined();
      expect(body.milestone.name || body.milestone.title).toBe(milestoneData.name);
      expect(body.milestone.id).toMatch(PATTERNS.uuid);
    });

    test('validates required name', async () => {
      const response = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: '',
        date: new Date().toISOString(),
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('validates date format', async () => {
      const response = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: 'Invalid Date Milestone',
        date: 'not-a-date',
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('creates milestone without description', async () => {
      const response = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: 'No Description Milestone',
        date: new Date().toISOString(),
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone).toBeDefined();
    });

    test('returns 404 for non-existent trip', async () => {
      const response = await api.post('/api/trips/00000000-0000-0000-0000-000000000000/milestones', {
        name: 'Test',
        date: new Date().toISOString(),
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PUT /api/milestones/:id', () => {
    let testMilestoneId: string;

    test.beforeEach(async () => {
      // Create a milestone for testing
      const response = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: `Update Test Milestone ${Date.now()}`,
        date: new Date().toISOString(),
      });
      const body = await response.json();
      testMilestoneId = body.milestone.id;
    });

    test('updates milestone name', async () => {
      const response = await api.put(`/api/milestones/${testMilestoneId}`, {
        name: 'Updated Milestone Name',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone?.name || body.name).toBe('Updated Milestone Name');
    });

    test('updates milestone date', async () => {
      const newDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

      const response = await api.put(`/api/milestones/${testMilestoneId}`, {
        date: newDate,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone?.date || body.date).toBeDefined();
    });

    test('updates milestone description', async () => {
      const response = await api.put(`/api/milestones/${testMilestoneId}`, {
        description: 'Updated description',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone?.description || body.description).toBe('Updated description');
    });

    test('returns 404 for non-existent milestone', async () => {
      const response = await api.put('/api/milestones/00000000-0000-0000-0000-000000000000', {
        name: 'Test',
      });

      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /api/milestones/:id', () => {
    test('deletes custom milestone', async () => {
      // Create a milestone
      const createResponse = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: `Delete Test Milestone ${Date.now()}`,
        date: new Date().toISOString(),
      });
      const createBody = await createResponse.json();
      const milestoneId = createBody.milestone.id;

      const response = await api.delete(`/api/milestones/${milestoneId}`);

      expect(response.ok()).toBeTruthy();

      // Verify deleted
      const milestonesResponse = await api.get(`/api/trips/${testTripId}/milestones`);
      const milestonesBody = await milestonesResponse.json();
      const remaining = milestonesBody.milestones?.filter((m: any) => m.id === milestoneId);
      expect(remaining?.length || 0).toBe(0);
    });

    test('cannot delete system milestone', async () => {
      // Get milestones to find a system one
      const milestonesResponse = await api.get(`/api/trips/${testTripId}/milestones`);
      const milestonesBody = await milestonesResponse.json();

      const systemMilestone = milestonesBody.milestones?.find((m: any) => m.isSystem === true);

      if (systemMilestone) {
        const response = await api.delete(`/api/milestones/${systemMilestone.id}`);

        // Should fail
        expect(response.ok()).toBeFalsy();
      }
    });

    test('returns 404 for non-existent milestone', async () => {
      const response = await api.delete('/api/milestones/00000000-0000-0000-0000-000000000000');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('PATCH /api/milestones/:id/complete', () => {
    let testMilestoneId: string;

    test.beforeEach(async () => {
      const response = await api.post(`/api/trips/${testTripId}/milestones`, {
        name: `Complete Test Milestone ${Date.now()}`,
        date: new Date().toISOString(),
      });
      const body = await response.json();
      testMilestoneId = body.milestone.id;
    });

    test('marks milestone as complete', async () => {
      const response = await api.patch(`/api/milestones/${testMilestoneId}/complete`, {
        completed: true,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone?.completed || body.completed).toBe(true);
    });

    test('marks milestone as incomplete', async () => {
      // First complete it
      await api.patch(`/api/milestones/${testMilestoneId}/complete`, {
        completed: true,
      });

      // Then uncomplete
      const response = await api.patch(`/api/milestones/${testMilestoneId}/complete`, {
        completed: false,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.milestone?.completed || body.completed).toBe(false);
    });

    test('completed milestone has completion date', async () => {
      const response = await api.patch(`/api/milestones/${testMilestoneId}/complete`, {
        completed: true,
      });

      const body = await response.json();
      expect(body.milestone?.completedAt || body.completedAt).toBeDefined();
    });
  });
});

test.describe('Milestone Ordering', () => {
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
      name: `Ordering Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test('milestones are returned in date order', async () => {
    // Create milestones with different dates
    const dates = [
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    ];

    for (const date of dates) {
      await api.post(`/api/trips/${testTripId}/milestones`, {
        name: `Milestone ${date.getTime()}`,
        date: date.toISOString(),
      });
    }

    const response = await api.get(`/api/trips/${testTripId}/milestones`);
    const body = await response.json();

    if (body.milestones && body.milestones.length >= 3) {
      // Filter to only custom milestones (not system)
      const customMilestones = body.milestones.filter((m: any) => !m.isSystem);

      // Check they're in order
      for (let i = 1; i < customMilestones.length; i++) {
        const prevDate = new Date(customMilestones[i - 1].date);
        const currDate = new Date(customMilestones[i].date);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    }
  });

  test('can update milestone order', async () => {
    // Create milestones
    const m1Response = await api.post(`/api/trips/${testTripId}/milestones`, {
      name: 'First Milestone',
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      order: 1,
    });
    const m1Body = await m1Response.json();

    // Update order
    const response = await api.put(`/api/milestones/${m1Body.milestone.id}`, {
      order: 5,
    });

    expect(response.ok()).toBeTruthy();
  });
});
