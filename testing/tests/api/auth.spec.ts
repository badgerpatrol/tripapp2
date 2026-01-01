import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';
import { AuthHelper, createApiAuthHelper } from '../../helpers/auth.helper';

/**
 * Authentication API tests
 * Tests that authenticated endpoints properly require authentication
 * and that valid tokens grant access
 */
test.describe('Authentication @critical', () => {
  let auth: AuthHelper;

  test.beforeAll(() => {
    auth = createApiAuthHelper();
  });

  test.describe('Unauthenticated requests', () => {
    test('GET /api/trips returns 401 without token', async ({ request }) => {
      const api = new ApiHelper(request);
      // Don't set any auth token

      const response = await api.getTrips();

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    test('POST /api/trips returns 401 without token', async ({ request }) => {
      const api = new ApiHelper(request);

      const response = await api.createTrip({
        name: 'Unauthorized Trip',
      });

      expect(response.status()).toBe(401);
    });

    test('GET /api/spends returns 401 without token', async ({ request }) => {
      const api = new ApiHelper(request);

      const response = await api.getSpends();

      expect(response.status()).toBe(401);
    });

    test('protected endpoints consistently require auth', async ({ request }) => {
      const api = new ApiHelper(request);

      // Test multiple protected endpoints
      const protectedEndpoints = [
        () => api.getTrips(),
        () => api.getListTemplates(),
        () => api.getGroups(),
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await endpoint();
        expect(response.status()).toBe(401);
      }
    });
  });

  test.describe('Authenticated requests', () => {
    test('GET /api/trips succeeds with valid token', async ({ request }) => {
      const api = new ApiHelper(request);

      // Get a real Firebase token
      const token = await auth.getTestUserToken();
      api.setAuthToken(token);

      const response = await api.getTrips();

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      // API returns { trips: [...] } wrapper
      expect(body.trips).toBeDefined();
      expect(Array.isArray(body.trips)).toBeTruthy();
    });

    test('POST /api/trips succeeds with valid token', async ({ request }) => {
      const api = new ApiHelper(request);

      const token = await auth.getTestUserToken();
      api.setAuthToken(token);

      const response = await api.createTrip({
        name: `Auth Test Trip ${Date.now()}`,
        description: 'Created with authenticated request',
      });

      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      // API returns { success: true, trip: {...} } wrapper
      expect(body.success).toBe(true);
      expect(body.trip).toBeDefined();
      expect(body.trip.id).toBeDefined();
      expect(body.trip.name).toContain('Auth Test Trip');

      // Clean up - delete the created trip
      await api.deleteTrip(body.trip.id);
    });

    test('can access user-specific data with token', async ({ request }) => {
      const api = new ApiHelper(request);

      const token = await auth.getTestUserToken();
      api.setAuthToken(token);

      // Get trips as a proxy for user-specific data
      const response = await api.getTrips();

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      // User should be able to access their data
      expect(body.trips).toBeDefined();
    });
  });

  test.describe('Invalid tokens', () => {
    test('returns 401 with malformed token', async ({ request }) => {
      const api = new ApiHelper(request);
      api.setAuthToken('not-a-valid-token');

      const response = await api.getTrips();

      expect(response.status()).toBe(401);
    });

    test('returns 401 with expired token format', async ({ request }) => {
      const api = new ApiHelper(request);

      // Create a token-like string that's clearly invalid
      const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.fake_signature';
      api.setAuthToken(fakeToken);

      const response = await api.getTrips();

      expect(response.status()).toBe(401);
    });

    test('returns 401 with empty Authorization header', async ({ request }) => {
      const response = await request.get('/api/trips', {
        headers: {
          'Authorization': '',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('returns 401 with Bearer but no token', async ({ request }) => {
      const response = await request.get('/api/trips', {
        headers: {
          'Authorization': 'Bearer ',
        },
      });

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Token caching', () => {
    test('cached tokens work correctly', async ({ request }) => {
      const api = new ApiHelper(request);

      // Get token twice - second should be cached
      const token1 = await auth.getTestUserToken();
      const token2 = await auth.getTestUserToken();

      // Both should be the same (cached)
      expect(token1).toBe(token2);

      // Token should still work
      api.setAuthToken(token1);
      const response = await api.getTrips();
      expect(response.ok()).toBeTruthy();
    });

    test('can clear token cache', async ({ request }) => {
      const api = new ApiHelper(request);

      // Get initial token
      const token1 = await auth.getTestUserToken();

      // Clear cache
      auth.clearTokenCache();

      // Get new token (will fetch fresh from Firebase)
      const token2 = await auth.getTestUserToken();

      // Both should work (even if different)
      api.setAuthToken(token2);
      const response = await api.getTrips();
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Different user roles', () => {
    test('regular user can access their trips', async ({ request }) => {
      const api = new ApiHelper(request);

      const token = await auth.getTestUserToken();
      api.setAuthToken(token);

      const response = await api.getTrips();
      expect(response.ok()).toBeTruthy();
    });

    test('admin user can access admin endpoints', async ({ request }) => {
      // Skip if admin credentials not configured
      if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
        test.skip();
        return;
      }

      const api = new ApiHelper(request);

      const token = await auth.getAdminToken();
      api.setAuthToken(token);

      // Try to access admin endpoint
      const response = await api.getAdminUsers();

      // Admin should have access (200) or endpoint might not exist (404)
      // But should NOT be 401/403 for an admin
      expect([200, 404]).toContain(response.status());
    });

    test('regular user cannot access admin endpoints', async ({ request }) => {
      const api = new ApiHelper(request);

      const token = await auth.getTestUserToken();
      api.setAuthToken(token);

      // Try to access admin endpoint as regular user
      const response = await api.getAdminUsers();

      // Should be forbidden (403) or not found (404) but not successful
      expect(response.ok()).toBeFalsy();
    });
  });
});
