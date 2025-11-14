import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTrip, getTripById, getUserTrips } from "@/server/services/trips";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, TripStatus } from "@/lib/generated/prisma";

describe("Trip Service", () => {
  const testUserId = "test-trip-user-123";
  const testEmail = "tripuser@test.com";

  beforeEach(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
      },
    });
  });

  afterEach(async () => {
    // Clean up trips (cascades to members and timeline items)
    await prisma.trip.deleteMany({
      where: { createdById: testUserId },
    });

    // Clean up user
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe("createTrip", () => {
    it("should create a trip with minimal data", async () => {
      const tripData = {
        name: "Test Trip",
      };

      const trip = await createTrip(testUserId, tripData);

      expect(trip.id).toBeDefined();
      expect(trip.name).toBe("Test Trip");
      expect(trip.baseCurrency).toBe("USD");
      expect(trip.status).toBe(TripStatus.PLANNING);
      expect(trip.createdById).toBe(testUserId);
    });

    it("should create a trip with all fields", async () => {
      const startDate = new Date("2025-06-01");
      const endDate = new Date("2025-06-10");

      const tripData = {
        name: "Summer Vacation",
        description: "Beach trip with friends",
        baseCurrency: "EUR",
        startDate,
        endDate,
      };

      const trip = await createTrip(testUserId, tripData);

      expect(trip.name).toBe("Summer Vacation");
      expect(trip.description).toBe("Beach trip with friends");
      expect(trip.baseCurrency).toBe("EUR");
      expect(trip.startDate).toEqual(startDate);
      expect(trip.endDate).toEqual(endDate);
    });

    it("should add creator as OWNER member", async () => {
      const tripData = { name: "Test Trip" };
      const trip = await createTrip(testUserId, tripData);

      const membership = await prisma.tripMember.findFirst({
        where: {
          tripId: trip.id,
          userId: testUserId,
        },
      });

      expect(membership).toBeDefined();
      expect(membership?.role).toBe(TripMemberRole.OWNER);
      expect(membership?.rsvpStatus).toBe("ACCEPTED");
    });

    it("should create default timeline items", async () => {
      const startDate = new Date("2025-06-01");
      const endDate = new Date("2025-06-10");

      const tripData = {
        name: "Test Trip",
        startDate,
        endDate,
      };

      const trip = await createTrip(testUserId, tripData);

      const timelineItems = await prisma.timelineItem.findMany({
        where: { tripId: trip.id },
        orderBy: { order: "asc" },
      });

      // Should have multiple timeline items
      expect(timelineItems.length).toBeGreaterThan(5);

      // First item should be "Trip Created" and completed
      const firstItem = timelineItems[0];
      expect(firstItem.title).toBe("Trip Created");
      expect(firstItem.isCompleted).toBe(true);
      expect(firstItem.completedAt).toBeDefined();

      // Should have RSVP deadline
      const rsvpItem = timelineItems.find((item) =>
        item.title.includes("RSVP")
      );
      expect(rsvpItem).toBeDefined();

      // Should have trip start and end
      const startItem = timelineItems.find((item) =>
        item.title.includes("Trip Starts")
      );
      const endItem = timelineItems.find((item) =>
        item.title.includes("Trip Ends")
      );
      expect(startItem).toBeDefined();
      expect(endItem).toBeDefined();

      const spendingEnd = timelineItems.find((item) =>
        item.title.includes("Spending Window Closes")
      );
      expect(spendingStart).toBeDefined();
      expect(spendingEnd).toBeDefined();

      // Should have settlement deadline
      const settlementItem = timelineItems.find((item) =>
        item.title.includes("Settlement Deadline")
      );
      expect(settlementItem).toBeDefined();
    });

    it("should create timeline items even without dates", async () => {
      const tripData = { name: "Test Trip" };
      const trip = await createTrip(testUserId, tripData);

      const timelineItems = await prisma.timelineItem.findMany({
        where: { tripId: trip.id },
      });

      // Should still have timeline items with calculated dates
      expect(timelineItems.length).toBeGreaterThan(0);

      const firstItem = timelineItems.find((item) => item.order === 0);
      expect(firstItem?.title).toBe("Trip Created");
    });

    it("should set RSVP deadline to 1 week before start if that's in the future", async () => {
      // Start date 30 days in the future
      const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const tripData = {
        name: "Future Trip",
        startDate,
      };

      const trip = await createTrip(testUserId, tripData);

      const rsvpItem = await prisma.timelineItem.findFirst({
        where: {
          tripId: trip.id,
          title: "RSVP Deadline",
        },
      });

      expect(rsvpItem).toBeDefined();
      expect(rsvpItem?.date).toBeDefined();

      // RSVP deadline should be 7 days before start
      const expectedDeadline = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const actualDeadline = rsvpItem!.date!;

      // Compare dates without milliseconds
      expect(actualDeadline.getTime()).toBeCloseTo(expectedDeadline.getTime(), -3);
    });

    it("should set RSVP deadline to start date if 1 week before is in the past", async () => {
      // Start date 3 days in the future (less than 1 week)
      const startDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const tripData = {
        name: "Soon Trip",
        startDate,
      };

      const trip = await createTrip(testUserId, tripData);

      const rsvpItem = await prisma.timelineItem.findFirst({
        where: {
          tripId: trip.id,
          title: "RSVP Deadline",
        },
      });

      expect(rsvpItem).toBeDefined();
      expect(rsvpItem?.date).toBeDefined();

      // RSVP deadline should be same as start date
      const actualDeadline = rsvpItem!.date!;
      expect(actualDeadline.getTime()).toBeCloseTo(startDate.getTime(), -3);
    });
  });

  describe("getTripById", () => {
    it("should get trip with full details", async () => {
      const tripData = { name: "Test Trip" };
      const createdTrip = await createTrip(testUserId, tripData);

      const trip = await getTripById(createdTrip.id);

      expect(trip).toBeDefined();
      expect(trip?.id).toBe(createdTrip.id);
      expect(trip?.createdBy).toBeDefined();
      expect(trip?.createdBy.email).toBe(testEmail);
      expect(trip?.members).toBeDefined();
      expect(trip?.members.length).toBe(1);
      expect(trip?.timelineItems).toBeDefined();
      expect(trip?.timelineItems.length).toBeGreaterThan(0);
    });

    it("should return null for non-existent trip", async () => {
      const trip = await getTripById("non-existent-id");
      expect(trip).toBeNull();
    });
  });

  describe("getUserTrips", () => {
    it("should return all trips for a user", async () => {
      // Create multiple trips
      await createTrip(testUserId, { name: "Trip 1" });
      await createTrip(testUserId, { name: "Trip 2" });
      await createTrip(testUserId, { name: "Trip 3" });

      const trips = await getUserTrips(testUserId);

      expect(trips.length).toBe(3);
      expect(trips[0].name).toBeDefined();
      expect(trips[0].createdBy).toBeDefined();
      expect(trips[0].members).toBeDefined();
    });

    it("should return empty array if user has no trips", async () => {
      const trips = await getUserTrips(testUserId);
      expect(trips).toEqual([]);
    });

    it("should order trips by creation date descending", async () => {
      // Create trips with delay to ensure different timestamps
      const trip1 = await createTrip(testUserId, { name: "Trip 1" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const trip2 = await createTrip(testUserId, { name: "Trip 2" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const trip3 = await createTrip(testUserId, { name: "Trip 3" });

      const trips = await getUserTrips(testUserId);

      // Most recent trip should be first
      expect(trips[0].id).toBe(trip3.id);
      expect(trips[1].id).toBe(trip2.id);
      expect(trips[2].id).toBe(trip1.id);
    });
  });
});
