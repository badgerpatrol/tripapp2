import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api.helper';

/**
 * Health and basic API tests
 */
test.describe('Health Check API @smoke', () => {
  test('GET /api/health returns OK', async ({ request }) => {
    const api = new ApiHelper(request);
    const response = await api.healthCheck();

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('API returns JSON content type', async ({ request }) => {
    const api = new ApiHelper(request);
    const response = await api.healthCheck();

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });
});

test.describe('API Error Handling', () => {
  test('returns 404 for non-existent endpoints', async ({ request }) => {
    const response = await request.get('/api/non-existent-endpoint');
    expect(response.status()).toBe(404);
  });

  test('returns 401 for unauthorized requests', async ({ request }) => {
    // Try to access protected endpoint without auth
    const response = await request.get('/api/trips', {
      headers: { 'Accept': 'application/json' },
    });

    // Should return 401 Unauthorized
    expect(response.status()).toBe(401);
  });

  test('returns proper error format', async ({ request }) => {
    const response = await request.get('/api/trips', {
      headers: { 'Accept': 'application/json' },
    });

    const body = await response.json();

    // Error response should have proper structure
    expect(body).toHaveProperty('error');
  });
});
