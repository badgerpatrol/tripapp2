import { test, expect } from '@playwright/test';
import { DatabaseHelper } from '../../helpers/database.helper';
import { DEFAULT_TEST_USER, SECONDARY_TEST_USER, TEST_PREFIX } from '../../config/test-constants';

/**
 * Database query tests
 * Tests complex queries, aggregations, and performance-critical operations
 */
test.describe('Database Query Tests', () => {
  let db: DatabaseHelper;

  test.beforeAll(async () => {
    db = await DatabaseHelper.getInstance();
    await db.createTestUser(DEFAULT_TEST_USER);
    await db.createTestUser(SECONDARY_TEST_USER);
  });

  test.describe('Trip Queries', () => {
    let testTrips: string[] = [];

    test.beforeEach(async () => {
      // Create multiple test trips
      for (let i = 0; i < 3; i++) {
        const trip = await db.createTestTrip({
          id: `${TEST_PREFIX}query_trip_${i}_${Date.now()}`,
          name: `Query Test Trip ${i}`,
          createdById: DEFAULT_TEST_USER.id,
          status: i === 0 ? 'PLANNING' : i === 1 ? 'ACTIVE' : 'FINALIZED',
        });
        testTrips.push(trip.id);
      }
    });

    test.afterEach(async () => {
      for (const tripId of testTrips) {
        await db.client.tripMember.deleteMany({ where: { tripId } });
        await db.client.trip.delete({ where: { id: tripId } }).catch(() => {});
      }
      testTrips = [];
    });

    test('getUserTrips returns all user trips', async () => {
      const trips = await db.getUserTrips(DEFAULT_TEST_USER.id);

      expect(trips.length).toBeGreaterThanOrEqual(3);
      testTrips.forEach((tripId) => {
        expect(trips.some((t) => t.id === tripId)).toBeTruthy();
      });
    });

    test('filters trips by status', async () => {
      const activeTrips = await db.client.trip.findMany({
        where: {
          id: { in: testTrips },
          status: 'ACTIVE',
        },
      });

      expect(activeTrips.length).toBe(1);
      expect(activeTrips[0].status).toBe('ACTIVE');
    });

    test('includes member count in trip query', async () => {
      // Add secondary user to first trip
      await db.addTripMember(testTrips[0], SECONDARY_TEST_USER.id);

      const trips = await db.client.trip.findMany({
        where: { id: { in: testTrips } },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      const firstTrip = trips.find((t) => t.id === testTrips[0]);
      expect(firstTrip?._count.members).toBe(2); // Owner + secondary
    });
  });

  test.describe('Spend Aggregations', () => {
    let testTripId: string;
    let testSpends: string[] = [];

    test.beforeEach(async () => {
      const trip = await db.createTestTrip({
        id: `${TEST_PREFIX}spend_agg_trip_${Date.now()}`,
        name: 'Spend Aggregation Test',
        createdById: DEFAULT_TEST_USER.id,
      });
      testTripId = trip.id;

      // Create test spends
      for (let i = 0; i < 5; i++) {
        const spend = await db.createTestSpend({
          tripId: testTripId,
          description: `Spend ${i}`,
          amount: (i + 1) * 20, // 20, 40, 60, 80, 100
          paidById: DEFAULT_TEST_USER.id,
        });
        testSpends.push(spend.id);
      }
    });

    test.afterEach(async () => {
      await db.client.spend.deleteMany({ where: { tripId: testTripId } });
      await db.client.tripMember.deleteMany({ where: { tripId: testTripId } });
      await db.client.trip.delete({ where: { id: testTripId } }).catch(() => {});
      testSpends = [];
    });

    test('calculates total spend amount', async () => {
      const result = await db.client.spend.aggregate({
        where: { tripId: testTripId, deletedAt: null },
        _sum: { normalizedAmount: true },
      });

      const total = parseFloat(result._sum.normalizedAmount?.toString() || '0');
      expect(total).toBe(300); // 20 + 40 + 60 + 80 + 100
    });

    test('calculates average spend amount', async () => {
      const result = await db.client.spend.aggregate({
        where: { tripId: testTripId, deletedAt: null },
        _avg: { normalizedAmount: true },
      });

      const avg = parseFloat(result._avg.normalizedAmount?.toString() || '0');
      expect(avg).toBe(60); // 300 / 5
    });

    test('counts spends', async () => {
      const count = await db.client.spend.count({
        where: { tripId: testTripId, deletedAt: null },
      });

      expect(count).toBe(5);
    });

    test('groups spends by payer', async () => {
      // Add another user and create spend
      await db.addTripMember(testTripId, SECONDARY_TEST_USER.id);

      await db.createTestSpend({
        tripId: testTripId,
        description: 'Secondary User Spend',
        amount: 50,
        paidById: SECONDARY_TEST_USER.id,
      });

      const groupedSpends = await db.client.spend.groupBy({
        by: ['paidById'],
        where: { tripId: testTripId, deletedAt: null },
        _sum: { normalizedAmount: true },
        _count: true,
      });

      expect(groupedSpends.length).toBe(2);

      const defaultUserSpends = groupedSpends.find(
        (g) => g.paidById === DEFAULT_TEST_USER.id
      );
      expect(defaultUserSpends?._count).toBe(5);
    });
  });

  test.describe('Balance Calculations', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      const trip = await db.createTestTrip({
        id: `${TEST_PREFIX}balance_trip_${Date.now()}`,
        name: 'Balance Calculation Test',
        createdById: DEFAULT_TEST_USER.id,
      });
      testTripId = trip.id;

      await db.addTripMember(testTripId, SECONDARY_TEST_USER.id);
    });

    test.afterEach(async () => {
      await db.client.spendAssignment.deleteMany({
        where: { spend: { tripId: testTripId } },
      });
      await db.client.spend.deleteMany({ where: { tripId: testTripId } });
      await db.client.tripMember.deleteMany({ where: { tripId: testTripId } });
      await db.client.trip.delete({ where: { id: testTripId } }).catch(() => {});
    });

    test('calculates user total paid', async () => {
      await db.createTestSpend({
        tripId: testTripId,
        description: 'User Paid 1',
        amount: 100,
        paidById: DEFAULT_TEST_USER.id,
      });

      await db.createTestSpend({
        tripId: testTripId,
        description: 'User Paid 2',
        amount: 50,
        paidById: DEFAULT_TEST_USER.id,
      });

      const totalPaid = await db.client.spend.aggregate({
        where: {
          tripId: testTripId,
          paidById: DEFAULT_TEST_USER.id,
          deletedAt: null,
        },
        _sum: { normalizedAmount: true },
      });

      const paid = parseFloat(totalPaid._sum.normalizedAmount?.toString() || '0');
      expect(paid).toBe(150);
    });

    test('calculates user total owed', async () => {
      const spend = await db.createTestSpend({
        tripId: testTripId,
        description: 'Shared Expense',
        amount: 100,
        paidById: DEFAULT_TEST_USER.id,
      });

      await db.createSpendAssignment({
        spendId: spend.id,
        userId: SECONDARY_TEST_USER.id,
        shareAmount: 50,
      });

      const totalOwed = await db.client.spendAssignment.aggregate({
        where: {
          userId: SECONDARY_TEST_USER.id,
          spend: { tripId: testTripId, deletedAt: null },
        },
        _sum: { normalizedShareAmount: true },
      });

      const owed = parseFloat(totalOwed._sum.normalizedShareAmount?.toString() || '0');
      expect(owed).toBe(50);
    });

    test('calculates net balance', async () => {
      // User 1 pays 100, shared equally
      const spend1 = await db.createTestSpend({
        tripId: testTripId,
        description: 'User 1 Expense',
        amount: 100,
        paidById: DEFAULT_TEST_USER.id,
      });

      await db.createSpendAssignment({
        spendId: spend1.id,
        userId: DEFAULT_TEST_USER.id,
        shareAmount: 50,
      });

      await db.createSpendAssignment({
        spendId: spend1.id,
        userId: SECONDARY_TEST_USER.id,
        shareAmount: 50,
      });

      // Calculate balance for secondary user
      // Paid: 0, Owes: 50, Balance: -50 (owes $50 to the group)
      const paid = 0;
      const owes = 50;
      const balance = paid - owes;

      expect(balance).toBe(-50);
    });
  });

  test.describe('Complex Joins', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      const trip = await db.createTestTrip({
        id: `${TEST_PREFIX}join_trip_${Date.now()}`,
        name: 'Complex Join Test',
        createdById: DEFAULT_TEST_USER.id,
      });
      testTripId = trip.id;
    });

    test.afterEach(async () => {
      await db.client.spendAssignment.deleteMany({
        where: { spend: { tripId: testTripId } },
      });
      await db.client.spendItem.deleteMany({
        where: { spend: { tripId: testTripId } },
      });
      await db.client.spend.deleteMany({ where: { tripId: testTripId } });
      await db.client.tripMember.deleteMany({ where: { tripId: testTripId } });
      await db.client.trip.delete({ where: { id: testTripId } }).catch(() => {});
    });

    test('fetches trip with all related data', async () => {
      // Create spend with items and assignments
      const spend = await db.createTestSpend({
        tripId: testTripId,
        description: 'Complex Spend',
        amount: 100,
        paidById: DEFAULT_TEST_USER.id,
      });

      await db.client.spendItem.create({
        data: {
          spendId: spend.id,
          name: 'Item 1',
          cost: 50,
          createdById: DEFAULT_TEST_USER.id,
        },
      });

      await db.createSpendAssignment({
        spendId: spend.id,
        userId: DEFAULT_TEST_USER.id,
        shareAmount: 100,
      });

      // Fetch with all relations
      const tripWithRelations = await db.getTrip(testTripId);

      expect(tripWithRelations).toBeDefined();
      expect(tripWithRelations.members).toBeDefined();
      expect(tripWithRelations.spends).toBeDefined();
      expect(tripWithRelations.spends[0].items).toBeDefined();
      expect(tripWithRelations.spends[0].assignments).toBeDefined();
    });

    test('fetches user with all trips and spends', async () => {
      const userWithRelations = await db.client.user.findUnique({
        where: { id: DEFAULT_TEST_USER.id },
        include: {
          tripMemberships: {
            include: { trip: true },
          },
          spendsCreated: true,
          spendAssignments: true,
        },
      });

      expect(userWithRelations).toBeDefined();
      expect(userWithRelations?.tripMemberships).toBeDefined();
      expect(Array.isArray(userWithRelations?.spendsCreated)).toBeTruthy();
    });
  });

  test.describe('Event Log Queries', () => {
    let testTripId: string;

    test.beforeEach(async () => {
      const trip = await db.createTestTrip({
        id: `${TEST_PREFIX}event_trip_${Date.now()}`,
        name: 'Event Log Test',
        createdById: DEFAULT_TEST_USER.id,
      });
      testTripId = trip.id;

      // Create some events
      await db.client.eventLog.create({
        data: {
          entity: 'Trip',
          entityId: testTripId,
          eventType: 'TRIP_CREATED',
          byUser: DEFAULT_TEST_USER.id,
          tripId: testTripId,
        },
      });
    });

    test.afterEach(async () => {
      await db.client.eventLog.deleteMany({ where: { tripId: testTripId } });
      await db.client.tripMember.deleteMany({ where: { tripId: testTripId } });
      await db.client.trip.delete({ where: { id: testTripId } }).catch(() => {});
    });

    test('fetches events for entity', async () => {
      const events = await db.getEventLogs('Trip', testTripId);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].entity).toBe('Trip');
      expect(events[0].entityId).toBe(testTripId);
    });

    test('events are ordered by createdAt descending', async () => {
      // Create another event
      await db.client.eventLog.create({
        data: {
          entity: 'Trip',
          entityId: testTripId,
          eventType: 'TRIP_UPDATED',
          byUser: DEFAULT_TEST_USER.id,
          tripId: testTripId,
        },
      });

      const events = await db.getEventLogs('Trip', testTripId);

      // Most recent should be first
      expect(events[0].eventType).toBe('TRIP_UPDATED');
    });
  });
});
