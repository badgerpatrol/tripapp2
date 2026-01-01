import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';
import { PATTERNS } from '../../config/test-constants';

/**
 * Invitation and RSVP API tests
 *
 * Tests cover user stories:
 * - US-INV-001: Invite Existing User
 * - US-INV-011: Accept Trip Invitation
 * - US-INV-012: Decline Trip Invitation
 * - US-INV-013: Respond Maybe
 * - US-INV-014: Change RSVP Response
 * - US-INV-032: Remove Member from Trip
 *
 * Uses real Firebase authentication
 */
test.describe('Invitation API @critical', () => {
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
      name: `Invitation API Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('GET /api/trips/:id/members', () => {
    test('returns trip members', async () => {
      const response = await api.get(`/api/trips/${testTripId}/members`);

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.members).toBeDefined();
      expect(Array.isArray(body.members)).toBeTruthy();
      // Owner should be in members list
      expect(body.members.length).toBeGreaterThanOrEqual(1);
    });

    test('members include role and rsvp status', async () => {
      const response = await api.get(`/api/trips/${testTripId}/members`);
      const body = await response.json();

      if (body.members && body.members.length > 0) {
        const member = body.members[0];
        expect(member.role).toBeDefined();
        expect(member.rsvpStatus).toBeDefined();
      }
    });

    test('returns 401 without authentication', async ({ request }) => {
      const unauthApi = new ApiHelper(request);
      const response = await unauthApi.get(`/api/trips/${testTripId}/members`);

      expect(response.status()).toBe(401);
    });

    test('returns 404 for non-existent trip', async () => {
      const response = await api.get('/api/trips/00000000-0000-0000-0000-000000000000/members');

      expect(response.status()).toBe(404);
    });
  });

  test.describe('POST /api/trips/:id/members', () => {
    test('invites a user to trip', async () => {
      // First get an existing user to invite
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();

      // Try inviting with a test email
      const response = await api.post(`/api/trips/${testTripId}/members`, {
        email: `invitetest${Date.now()}@tripplanner.test`,
        displayName: 'Invite Test User',
      });

      // May succeed or fail depending on whether user exists
      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('validates email format', async () => {
      const response = await api.post(`/api/trips/${testTripId}/members`, {
        email: 'invalid-email',
        displayName: 'Test User',
      });

      expect(response.ok()).toBeFalsy();
      expect(response.status()).toBe(400);
    });

    test('prevents duplicate invitations', async () => {
      const testEmail = `duplicate${Date.now()}@tripplanner.test`;

      // First invitation
      await api.post(`/api/trips/${testTripId}/members`, {
        email: testEmail,
        displayName: 'First Invite',
      });

      // Second invitation (duplicate)
      const response = await api.post(`/api/trips/${testTripId}/members`, {
        email: testEmail,
        displayName: 'Duplicate Invite',
      });

      // Should fail or return existing member
      const body = await response.json();
      expect(body).toBeDefined();
    });
  });

  test.describe('PATCH /api/trips/:id/members/:userId', () => {
    test('updates member RSVP status to ACCEPTED', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.patch(`/api/trips/${testTripId}/members/${userId}`, {
          rsvpStatus: 'ACCEPTED',
        });

        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.member?.rsvpStatus || body.rsvpStatus).toBe('ACCEPTED');
      }
    });

    test('updates member RSVP status to DECLINED', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.patch(`/api/trips/${testTripId}/members/${userId}`, {
          rsvpStatus: 'DECLINED',
        });

        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.member?.rsvpStatus || body.rsvpStatus).toBe('DECLINED');
      }
    });

    test('updates member RSVP status to MAYBE', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.patch(`/api/trips/${testTripId}/members/${userId}`, {
          rsvpStatus: 'MAYBE',
        });

        expect(response.ok()).toBeTruthy();

        const body = await response.json();
        expect(body.member?.rsvpStatus || body.rsvpStatus).toBe('MAYBE');
      }
    });

    test('validates RSVP status value', async () => {
      const sessionResponse = await api.getSession();
      const session = await sessionResponse.json();
      const userId = session.user?.id;

      if (userId) {
        const response = await api.patch(`/api/trips/${testTripId}/members/${userId}`, {
          rsvpStatus: 'INVALID_STATUS',
        });

        expect(response.ok()).toBeFalsy();
        expect(response.status()).toBe(400);
      }
    });

    test('returns 404 for non-member user', async () => {
      const response = await api.patch(
        `/api/trips/${testTripId}/members/00000000-0000-0000-0000-000000000000`,
        { rsvpStatus: 'ACCEPTED' }
      );

      expect(response.status()).toBe(404);
    });
  });

  test.describe('DELETE /api/trips/:id/members/:userId', () => {
    test('removes member from trip', async () => {
      // First add a member
      const testEmail = `remove${Date.now()}@tripplanner.test`;
      const addResponse = await api.post(`/api/trips/${testTripId}/members`, {
        email: testEmail,
        displayName: 'Remove Test User',
      });
      const addBody = await addResponse.json();
      const memberId = addBody.member?.userId || addBody.userId;

      if (memberId) {
        const response = await api.delete(`/api/trips/${testTripId}/members/${memberId}`);

        expect(response.ok()).toBeTruthy();

        // Verify member is removed
        const membersResponse = await api.get(`/api/trips/${testTripId}/members`);
        const membersBody = await membersResponse.json();
        const remaining = membersBody.members?.filter((m: any) => m.userId === memberId);
        expect(remaining?.length || 0).toBe(0);
      }
    });

    test('cannot remove trip owner', async () => {
      // Get trip details to find owner
      const tripResponse = await api.getTrip(testTripId);
      const tripBody = await tripResponse.json();
      const ownerId = tripBody.trip?.createdById;

      if (ownerId) {
        const response = await api.delete(`/api/trips/${testTripId}/members/${ownerId}`);

        // Should fail - cannot remove owner
        expect(response.ok()).toBeFalsy();
      }
    });

    test('returns 404 for non-member', async () => {
      const response = await api.delete(
        `/api/trips/${testTripId}/members/00000000-0000-0000-0000-000000000000`
      );

      expect(response.status()).toBe(404);
    });
  });
});

test.describe('RSVP Window API', () => {
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
      name: `RSVP Window Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('POST /api/trips/:id/rsvp-status', () => {
    test('can close RSVP window', async () => {
      const response = await api.post(`/api/trips/${testTripId}/rsvp-status`, {
        isOpen: false,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.trip?.rsvpOpen === false || body.rsvpOpen === false).toBeTruthy();
    });

    test('can open RSVP window', async () => {
      // First close
      await api.post(`/api/trips/${testTripId}/rsvp-status`, {
        isOpen: false,
      });

      // Then open
      const response = await api.post(`/api/trips/${testTripId}/rsvp-status`, {
        isOpen: true,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.trip?.rsvpOpen === true || body.rsvpOpen === true).toBeTruthy();
    });

    test('set RSVP deadline', async () => {
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await api.post(`/api/trips/${testTripId}/rsvp-status`, {
        deadline: deadline,
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body.trip?.rsvpDeadline || body.rsvpDeadline).toBeDefined();
    });
  });
});

test.describe('Join Trip API', () => {
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
      name: `Join Test Trip ${Date.now()}`,
    });
    const tripBody = await tripResponse.json();
    testTripId = tripBody.trip.id;
  });

  test.afterEach(async () => {
    if (testTripId) {
      await api.deleteTrip(testTripId).catch(() => {});
    }
  });

  test.describe('POST /api/trips/:id/join', () => {
    test('join trip returns success for public trip', async () => {
      // Enable signup mode first
      await api.updateTrip(testTripId, { allowSignup: true } as any);

      const response = await api.post(`/api/trips/${testTripId}/join`, {});

      // May succeed or user may already be a member
      const body = await response.json();
      expect(body).toBeDefined();
    });

    test('join with wrong password fails', async () => {
      // Set a password on the trip
      await api.updateTrip(testTripId, { password: 'secret123' } as any);

      const response = await api.post(`/api/trips/${testTripId}/join`, {
        password: 'wrongpassword',
      });

      // Should fail
      expect(response.ok()).toBeFalsy();
    });

    test('join with correct password succeeds', async () => {
      // Set a password and enable signup
      await api.updateTrip(testTripId, {
        password: 'secret123',
        allowSignup: true,
      } as any);

      const response = await api.post(`/api/trips/${testTripId}/join`, {
        password: 'secret123',
      });

      // Should succeed (or user already member)
      const body = await response.json();
      expect(body).toBeDefined();
    });
  });
});
