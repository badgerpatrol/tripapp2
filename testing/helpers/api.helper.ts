import { APIRequestContext, APIResponse } from '@playwright/test';
import { API_ENDPOINTS } from '../config/test-constants';

/**
 * API Helper for making HTTP requests in tests
 * Provides typed methods for all API endpoints
 */
export class ApiHelper {
  private request: APIRequestContext;
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(request: APIRequestContext, baseUrl?: string) {
    this.request = request;
    this.baseUrl = baseUrl || process.env.API_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Set the authentication token for requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Get default headers including auth if set
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  /**
   * Make a GET request
   */
  async get(endpoint: string, params?: Record<string, string>): Promise<APIResponse> {
    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return this.request.get(url.toString(), {
      headers: this.getHeaders(),
    });
  }

  /**
   * Make a POST request
   */
  async post(endpoint: string, data?: any): Promise<APIResponse> {
    return this.request.post(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  /**
   * Make a PUT request
   */
  async put(endpoint: string, data?: any): Promise<APIResponse> {
    return this.request.put(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  /**
   * Make a PATCH request
   */
  async patch(endpoint: string, data?: any): Promise<APIResponse> {
    return this.request.patch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
      data,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete(endpoint: string): Promise<APIResponse> {
    return this.request.delete(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
    });
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  async healthCheck(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.health);
  }

  // ============================================================================
  // AUTH ENDPOINTS
  // ============================================================================

  async syncAuth(userData: {
    uid: string;
    email: string;
    displayName?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.auth.sync, userData);
  }

  async getSession(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.auth.session);
  }

  // ============================================================================
  // TRIP ENDPOINTS
  // ============================================================================

  async getTrips(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.trips.list);
  }

  async createTrip(tripData: {
    name: string;
    description?: string;
    location?: string;
    baseCurrency?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.trips.create, tripData);
  }

  async getTrip(tripId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.trips.get(tripId));
  }

  async updateTrip(tripId: string, data: Partial<{
    name: string;
    description: string;
    location: string;
    baseCurrency: string;
    status: string;
  }>): Promise<APIResponse> {
    // API uses PUT, not PATCH
    return this.put(API_ENDPOINTS.trips.update(tripId), data);
  }

  async deleteTrip(tripId: string): Promise<APIResponse> {
    return this.delete(API_ENDPOINTS.trips.delete(tripId));
  }

  async getTripBalances(tripId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.trips.balances(tripId));
  }

  // ============================================================================
  // SPEND ENDPOINTS
  // ============================================================================

  async getSpends(tripId?: string): Promise<APIResponse> {
    const params = tripId ? { tripId } : undefined;
    return this.get(API_ENDPOINTS.spends.list, params);
  }

  async createSpend(spendData: {
    tripId: string;
    description: string;
    amount: number;
    currency?: string;
    paidById: string;
    categoryId?: string;
    date?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.spends.create, spendData);
  }

  async getSpend(spendId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.spends.get(spendId));
  }

  async updateSpend(spendId: string, data: Partial<{
    description: string;
    amount: number;
    currency: string;
    categoryId: string;
  }>): Promise<APIResponse> {
    return this.patch(API_ENDPOINTS.spends.update(spendId), data);
  }

  async deleteSpend(spendId: string): Promise<APIResponse> {
    return this.delete(API_ENDPOINTS.spends.delete(spendId));
  }

  // ============================================================================
  // CHOICE ENDPOINTS
  // ============================================================================

  async getChoices(tripId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.choices.list(tripId));
  }

  async createChoice(tripId: string, choiceData: {
    name: string;
    description?: string;
    datetime?: string;
    place?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.choices.create(tripId), choiceData);
  }

  async getChoice(choiceId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.choices.get(choiceId));
  }

  async updateChoice(choiceId: string, data: Partial<{
    name: string;
    description: string;
    status: 'OPEN' | 'CLOSED';
  }>): Promise<APIResponse> {
    return this.patch(API_ENDPOINTS.choices.update(choiceId), data);
  }

  async deleteChoice(choiceId: string): Promise<APIResponse> {
    return this.delete(API_ENDPOINTS.choices.delete(choiceId));
  }

  // ============================================================================
  // SETTLEMENT ENDPOINTS
  // ============================================================================

  async getSettlements(tripId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.settlements.list(tripId));
  }

  async recordPayment(settlementId: string, paymentData: {
    amount: number;
    paymentMethod?: string;
    notes?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.settlements.payments(settlementId), paymentData);
  }

  async getPayments(settlementId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.settlements.payments(settlementId));
  }

  // ============================================================================
  // LIST ENDPOINTS
  // ============================================================================

  async getListTemplates(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.lists.templates);
  }

  async createListTemplate(templateData: {
    title: string;
    description?: string;
    type: 'TODO' | 'KIT';
    visibility?: 'PRIVATE' | 'PUBLIC';
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.lists.templates, templateData);
  }

  async getPublicListTemplates(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.lists.publicTemplates);
  }

  // ============================================================================
  // GROUP ENDPOINTS
  // ============================================================================

  async getGroups(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.groups.list);
  }

  async createGroup(groupData: {
    name: string;
    description?: string;
  }): Promise<APIResponse> {
    return this.post(API_ENDPOINTS.groups.create, groupData);
  }

  async getGroup(groupId: string): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.groups.get(groupId));
  }

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================

  async getAdminUsers(): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.admin.users);
  }

  async getAdminLogs(params?: {
    feature?: string;
    severity?: string;
    limit?: string;
  }): Promise<APIResponse> {
    return this.get(API_ENDPOINTS.admin.logs, params);
  }

  // ============================================================================
  // RESPONSE HELPERS
  // ============================================================================

  /**
   * Parse JSON response body
   */
  static async parseJson<T>(response: APIResponse): Promise<T> {
    try {
      return await response.json();
    } catch (e) {
      throw new Error(`Failed to parse JSON response: ${await response.text()}`);
    }
  }

  /**
   * Assert response status and return parsed body
   */
  static async expectStatus<T>(response: APIResponse, expectedStatus: number): Promise<T> {
    if (response.status() !== expectedStatus) {
      const body = await response.text();
      throw new Error(
        `Expected status ${expectedStatus} but got ${response.status()}. Body: ${body}`
      );
    }
    return this.parseJson<T>(response);
  }

  /**
   * Assert successful response (2xx) and return parsed body
   */
  static async expectSuccess<T>(response: APIResponse): Promise<T> {
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `Expected successful response but got ${response.status()}. Body: ${body}`
      );
    }
    return this.parseJson<T>(response);
  }

  /**
   * Assert error response and return error details
   */
  static async expectError(response: APIResponse, expectedStatus?: number): Promise<{
    error: string;
    message?: string;
    details?: any;
  }> {
    if (response.ok()) {
      throw new Error(`Expected error response but got ${response.status()}`);
    }
    if (expectedStatus && response.status() !== expectedStatus) {
      throw new Error(`Expected status ${expectedStatus} but got ${response.status()}`);
    }
    return this.parseJson(response);
  }
}

/**
 * Response type helpers
 */
export interface TripResponse {
  id: string;
  name: string;
  description?: string;
  location?: string;
  baseCurrency: string;
  status: 'PLANNING' | 'ACTIVE' | 'FINALIZED' | 'SETTLED';
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members?: TripMemberResponse[];
}

export interface TripMemberResponse {
  id: string;
  tripId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  rsvpStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'MAYBE';
  user?: UserResponse;
}

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  role: 'VIEWER' | 'USER' | 'ADMIN' | 'SUPERADMIN';
}

export interface SpendResponse {
  id: string;
  tripId: string;
  description: string;
  amount: string;
  currency: string;
  normalizedAmount: string;
  paidById: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface ChoiceResponse {
  id: string;
  tripId: string;
  name: string;
  description?: string;
  status: 'OPEN' | 'CLOSED';
  createdById: string;
  items?: ChoiceItemResponse[];
}

export interface ChoiceItemResponse {
  id: string;
  choiceId: string;
  name: string;
  description?: string;
  price?: string;
  course?: string;
}

export interface SettlementResponse {
  id: string;
  tripId: string;
  fromUserId: string;
  toUserId: string;
  amount: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'VERIFIED';
}

export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}
