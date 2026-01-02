/**
 * Tests for Transport Service (Lift-share feature)
 * Covers CRUD operations and authorization checks
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTransportOffer,
  updateTransportOffer,
  deleteTransportOffer,
  getTripTransportOffers,
  getTransportOffer,
  createTransportRequirement,
  updateTransportRequirement,
  deleteTransportRequirement,
  getTripTransportRequirements,
  getTransportRequirement,
  getTripTransport,
} from "@/server/services/transport";

const TEST_USER_1 = "test-user-transport-1";
const TEST_USER_2 = "test-user-transport-2";
const TEST_USER_3 = "test-user-transport-3";
const TEST_TRIP_ID = "test-trip-transport";

describe("Transport Service Tests", () => {
  beforeEach(async () => {
    // Create test users
    await prisma.user.createMany({
      data: [
        {
          id: TEST_USER_1,
          email: "transport-user1@test.com",
          displayName: "Transport User 1",
          role: "USER",
        },
        {
          id: TEST_USER_2,
          email: "transport-user2@test.com",
          displayName: "Transport User 2",
          role: "USER",
        },
        {
          id: TEST_USER_3,
          email: "transport-user3@test.com",
          displayName: "Transport User 3",
          role: "USER",
        },
      ],
      skipDuplicates: true,
    });

    // Create test trip
    await prisma.trip.create({
      data: {
        id: TEST_TRIP_ID,
        name: "Test Trip for Transport",
        createdById: TEST_USER_1,
        members: {
          create: [
            {
              userId: TEST_USER_1,
              role: "OWNER",
              rsvpStatus: "ACCEPTED",
            },
            {
              userId: TEST_USER_2,
              role: "MEMBER",
              rsvpStatus: "ACCEPTED",
            },
            {
              userId: TEST_USER_3,
              role: "MEMBER",
              rsvpStatus: "ACCEPTED",
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    await prisma.transportOffer.deleteMany({ where: { tripId: TEST_TRIP_ID } });
    await prisma.transportRequirement.deleteMany({ where: { tripId: TEST_TRIP_ID } });
    await prisma.tripMember.deleteMany({ where: { tripId: TEST_TRIP_ID } });
    await prisma.trip.deleteMany({ where: { id: TEST_TRIP_ID } });
    // Delete event logs before users (foreign key constraint)
    await prisma.eventLog.deleteMany({
      where: { byUser: { in: [TEST_USER_1, TEST_USER_2, TEST_USER_3] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_1, TEST_USER_2, TEST_USER_3] } },
    });
  });

  // ============================================================================
  // Transport Offer Tests
  // ============================================================================

  describe("Transport Offers", () => {
    it("should create a transport offer with all fields", async () => {
      const departureTime = new Date("2024-12-15T08:00:00Z");

      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London, UK",
        toLocation: "Chamonix, France",
        departureTime,
        maxPeople: 3,
        maxGearDescription: "Several pairs of skis, 2 large suitcases",
        notes: "Happy to share petrol costs",
      });

      expect(offer.id).toBeDefined();
      expect(offer.tripId).toBe(TEST_TRIP_ID);
      expect(offer.fromLocation).toBe("London, UK");
      expect(offer.toLocation).toBe("Chamonix, France");
      expect(offer.departureTime?.toISOString()).toBe(departureTime.toISOString());
      expect(offer.maxPeople).toBe(3);
      expect(offer.maxGearDescription).toBe("Several pairs of skis, 2 large suitcases");
      expect(offer.notes).toBe("Happy to share petrol costs");
      expect(offer.createdBy.id).toBe(TEST_USER_1);
      expect(offer.createdBy.displayName).toBe("Transport User 1");
    });

    it("should create a minimal transport offer with only required fields", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Edinburgh",
      });

      expect(offer.id).toBeDefined();
      expect(offer.fromLocation).toBe("Manchester");
      expect(offer.toLocation).toBe("Edinburgh");
      expect(offer.departureTime).toBeNull();
      expect(offer.maxPeople).toBeNull();
      expect(offer.maxGearDescription).toBeNull();
      expect(offer.notes).toBeNull();
    });

    it("should list all transport offers for a trip", async () => {
      // Create multiple offers from different users
      await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        departureTime: new Date("2024-12-15T08:00:00Z"),
      });

      await createTransportOffer(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Bristol",
        toLocation: "Chamonix",
        departureTime: new Date("2024-12-14T10:00:00Z"),
      });

      const offers = await getTripTransportOffers(TEST_TRIP_ID);

      expect(offers).toHaveLength(2);
      // Should be sorted by departure time ascending
      expect(offers[0].fromLocation).toBe("Bristol");
      expect(offers[1].fromLocation).toBe("London");
    });

    it("should get a single transport offer by ID", async () => {
      const created = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Paris",
      });

      const fetched = await getTransportOffer(created.id);

      expect(fetched.id).toBe(created.id);
      expect(fetched.fromLocation).toBe("London");
      expect(fetched.createdBy.displayName).toBe("Transport User 1");
    });

    it("should update a transport offer by its owner", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        maxPeople: 2,
      });

      const updated = await updateTransportOffer(offer.id, TEST_USER_1, {
        maxPeople: 4,
        notes: "Actually have more space now",
      });

      expect(updated.maxPeople).toBe(4);
      expect(updated.notes).toBe("Actually have more space now");
      expect(updated.fromLocation).toBe("London"); // Unchanged
    });

    it("should not allow non-owner to update a transport offer", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
      });

      await expect(
        updateTransportOffer(offer.id, TEST_USER_2, {
          maxPeople: 5,
        })
      ).rejects.toThrow(/only edit your own/);
    });

    it("should delete a transport offer by its owner", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
      });

      const result = await deleteTransportOffer(offer.id, TEST_USER_1);
      expect(result.success).toBe(true);

      await expect(getTransportOffer(offer.id)).rejects.toThrow(/not found/);
    });

    it("should not allow non-owner to delete a transport offer", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
      });

      await expect(deleteTransportOffer(offer.id, TEST_USER_2)).rejects.toThrow(
        /only delete your own/
      );
    });
  });

  // ============================================================================
  // Transport Requirement Tests
  // ============================================================================

  describe("Transport Requirements", () => {
    it("should create a transport requirement with all fields", async () => {
      const earliestTime = new Date("2024-12-14T06:00:00Z");
      const latestTime = new Date("2024-12-15T12:00:00Z");

      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester, UK",
        toLocation: "Chamonix, France",
        earliestTime,
        latestTime,
        peopleCount: 2,
        gearDescription: "2 pairs of skis, 2 medium suitcases",
        notes: "Flexible on exact timing",
      });

      expect(requirement.id).toBeDefined();
      expect(requirement.tripId).toBe(TEST_TRIP_ID);
      expect(requirement.fromLocation).toBe("Manchester, UK");
      expect(requirement.toLocation).toBe("Chamonix, France");
      expect(requirement.earliestTime?.toISOString()).toBe(earliestTime.toISOString());
      expect(requirement.latestTime?.toISOString()).toBe(latestTime.toISOString());
      expect(requirement.peopleCount).toBe(2);
      expect(requirement.gearDescription).toBe("2 pairs of skis, 2 medium suitcases");
      expect(requirement.notes).toBe("Flexible on exact timing");
      expect(requirement.createdBy.id).toBe(TEST_USER_2);
    });

    it("should create a transport requirement with defaults", async () => {
      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Leeds",
        toLocation: "Edinburgh",
      });

      expect(requirement.peopleCount).toBe(1); // Default
      expect(requirement.earliestTime).toBeNull();
      expect(requirement.latestTime).toBeNull();
      expect(requirement.gearDescription).toBeNull();
    });

    it("should list all transport requirements for a trip", async () => {
      await createTransportRequirement(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        earliestTime: new Date("2024-12-15T08:00:00Z"),
      });

      await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Bristol",
        toLocation: "Chamonix",
        earliestTime: new Date("2024-12-14T10:00:00Z"),
      });

      await createTransportRequirement(TEST_USER_3, TEST_TRIP_ID, {
        fromLocation: "Birmingham",
        toLocation: "Chamonix",
        // No time set
      });

      const requirements = await getTripTransportRequirements(TEST_TRIP_ID);

      expect(requirements).toHaveLength(3);
      // Should be sorted by earliest time ascending (nulls might be at end or start)
    });

    it("should get a single transport requirement by ID", async () => {
      const created = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
        peopleCount: 3,
      });

      const fetched = await getTransportRequirement(created.id);

      expect(fetched.id).toBe(created.id);
      expect(fetched.fromLocation).toBe("Manchester");
      expect(fetched.peopleCount).toBe(3);
      expect(fetched.createdBy.displayName).toBe("Transport User 2");
    });

    it("should update a transport requirement by its owner", async () => {
      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
        peopleCount: 1,
      });

      const updated = await updateTransportRequirement(requirement.id, TEST_USER_2, {
        peopleCount: 2,
        gearDescription: "Added some gear",
      });

      expect(updated.peopleCount).toBe(2);
      expect(updated.gearDescription).toBe("Added some gear");
      expect(updated.fromLocation).toBe("Manchester"); // Unchanged
    });

    it("should not allow non-owner to update a transport requirement", async () => {
      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
      });

      await expect(
        updateTransportRequirement(requirement.id, TEST_USER_1, {
          peopleCount: 5,
        })
      ).rejects.toThrow(/only edit your own/);
    });

    it("should delete a transport requirement by its owner", async () => {
      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
      });

      const result = await deleteTransportRequirement(requirement.id, TEST_USER_2);
      expect(result.success).toBe(true);

      await expect(getTransportRequirement(requirement.id)).rejects.toThrow(/not found/);
    });

    it("should not allow non-owner to delete a transport requirement", async () => {
      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
      });

      await expect(deleteTransportRequirement(requirement.id, TEST_USER_1)).rejects.toThrow(
        /only delete your own/
      );
    });
  });

  // ============================================================================
  // Combined Transport Data Tests
  // ============================================================================

  describe("Combined Transport Data", () => {
    it("should get all transport data (offers and requirements) for a trip", async () => {
      // Create offers
      await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        maxPeople: 3,
      });

      await createTransportOffer(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Bristol",
        toLocation: "Chamonix",
        maxPeople: 2,
      });

      // Create requirements
      await createTransportRequirement(TEST_USER_3, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
        peopleCount: 2,
        gearDescription: "2 pairs of skis",
      });

      const transport = await getTripTransport(TEST_TRIP_ID);

      expect(transport.offers).toHaveLength(2);
      expect(transport.requirements).toHaveLength(1);

      // Verify offers have creator info
      expect(transport.offers[0].createdBy).toBeDefined();
      expect(transport.requirements[0].createdBy).toBeDefined();
    });

    it("should return empty arrays when no transport data exists", async () => {
      const transport = await getTripTransport(TEST_TRIP_ID);

      expect(transport.offers).toHaveLength(0);
      expect(transport.requirements).toHaveLength(0);
    });
  });

  // ============================================================================
  // Edge Cases and Trip Scoping Tests
  // ============================================================================

  describe("Trip Scoping", () => {
    it("should only return offers for the specified trip", async () => {
      // Create another trip
      const otherTripId = "other-trip-transport";
      await prisma.trip.create({
        data: {
          id: otherTripId,
          name: "Other Trip",
          createdById: TEST_USER_1,
        },
      });

      // Create offer in main trip
      await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
      });

      // Create offer in other trip
      await createTransportOffer(TEST_USER_1, otherTripId, {
        fromLocation: "Paris",
        toLocation: "Lyon",
      });

      // Fetch offers for main trip
      const offers = await getTripTransportOffers(TEST_TRIP_ID);
      expect(offers).toHaveLength(1);
      expect(offers[0].fromLocation).toBe("London");

      // Cleanup other trip
      await prisma.transportOffer.deleteMany({ where: { tripId: otherTripId } });
      await prisma.trip.delete({ where: { id: otherTripId } });
    });
  });

  // ============================================================================
  // Fuzzy Capacity Tests (per spec)
  // ============================================================================

  describe("Fuzzy Capacities", () => {
    it("should allow free text for gear descriptions", async () => {
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        maxGearDescription: "Several pairs of skis, maybe some boots, depends on packing",
      });

      const requirement = await createTransportRequirement(TEST_USER_2, TEST_TRIP_ID, {
        fromLocation: "Manchester",
        toLocation: "Chamonix",
        gearDescription: "1 pair of skis, 1 snowboard, and a large duffel bag",
      });

      expect(offer.maxGearDescription).toBe(
        "Several pairs of skis, maybe some boots, depends on packing"
      );
      expect(requirement.gearDescription).toBe(
        "1 pair of skis, 1 snowboard, and a large duffel bag"
      );
    });

    it("should treat maxPeople as approximate (no strict validation)", async () => {
      // The model allows any positive integer, human coordination handles the fuzzy matching
      const offer = await createTransportOffer(TEST_USER_1, TEST_TRIP_ID, {
        fromLocation: "London",
        toLocation: "Chamonix",
        maxPeople: 3, // Approximate
        notes: "Could squeeze in a 4th if needed",
      });

      expect(offer.maxPeople).toBe(3);
      expect(offer.notes).toBe("Could squeeze in a 4th if needed");
    });
  });
});
