import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, TripStatus, ListType } from "@/lib/generated/prisma";

describe("List Conflict Detection", () => {
  const testUserId = "test-conflict-user-123";
  const testEmail = "conflictuser@test.com";
  let testTripId: string;
  let testTemplateId: string;

  beforeEach(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testEmail,
      },
    });

    // Create test trip
    const trip = await prisma.trip.create({
      data: {
        name: "Test Trip",
        baseCurrency: "USD",
        status: TripStatus.PLANNING,
        createdById: testUserId,
        members: {
          create: {
            userId: testUserId,
            role: TripMemberRole.OWNER,
            rsvpStatus: "ACCEPTED",
          },
        },
      },
    });
    testTripId = trip.id;

    // Create test template
    const template = await prisma.listTemplate.create({
      data: {
        ownerId: testUserId,
        title: "Packing List",
        description: "Essential items for trip",
        type: ListType.KIT,
        visibility: "PRIVATE",
      },
    });
    testTemplateId = template.id;
  });

  afterEach(async () => {
    // Clean up list instances
    await prisma.listInstance.deleteMany({
      where: { tripId: testTripId },
    });

    // Clean up templates
    await prisma.listTemplate.deleteMany({
      where: { ownerId: testUserId },
    });

    // Clean up trips
    await prisma.trip.deleteMany({
      where: { id: testTripId },
    });

    // Clean up user
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
  });

  describe("Conflict Detection Logic", () => {
    it("should detect conflict when list with same title and type exists", async () => {
      // Create a list instance with the same title and type
      await prisma.listInstance.create({
        data: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT,
          sourceTemplateId: testTemplateId,
        },
      });

      // Check for conflict
      const existingInstance = await prisma.listInstance.findFirst({
        where: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT,
        },
        select: {
          id: true,
        },
      });

      expect(existingInstance).toBeDefined();
      expect(!!existingInstance).toBe(true);
    });

    it("should not detect conflict when no list with same title and type exists", async () => {
      // Don't create any list instance

      // Check for conflict
      const existingInstance = await prisma.listInstance.findFirst({
        where: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT,
        },
        select: {
          id: true,
        },
      });

      expect(existingInstance).toBeNull();
      expect(!!existingInstance).toBe(false);
    });

    it("should not detect conflict when list with same title but different type exists", async () => {
      // Create a list instance with the same title but different type
      await prisma.listInstance.create({
        data: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.TODO, // Different type
          sourceTemplateId: testTemplateId,
        },
      });

      // Check for conflict with KIT type
      const existingInstance = await prisma.listInstance.findFirst({
        where: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT, // Looking for KIT type
        },
        select: {
          id: true,
        },
      });

      expect(existingInstance).toBeNull();
      expect(!!existingInstance).toBe(false);
    });

    it("should not detect conflict when list with same type but different title exists", async () => {
      // Create a list instance with the same type but different title
      await prisma.listInstance.create({
        data: {
          tripId: testTripId,
          title: "Different List",
          type: ListType.KIT,
          sourceTemplateId: testTemplateId,
        },
      });

      // Check for conflict
      const existingInstance = await prisma.listInstance.findFirst({
        where: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT,
        },
        select: {
          id: true,
        },
      });

      expect(existingInstance).toBeNull();
      expect(!!existingInstance).toBe(false);
    });

    it("should only detect conflict on the same trip", async () => {
      // Create another trip
      const otherTrip = await prisma.trip.create({
        data: {
          name: "Other Trip",
          baseCurrency: "USD",
          status: TripStatus.PLANNING,
          createdById: testUserId,
          members: {
            create: {
              userId: testUserId,
              role: TripMemberRole.OWNER,
              rsvpStatus: "ACCEPTED",
            },
          },
        },
      });

      // Create a list instance on the other trip
      await prisma.listInstance.create({
        data: {
          tripId: otherTrip.id,
          title: "Packing List",
          type: ListType.KIT,
          sourceTemplateId: testTemplateId,
        },
      });

      // Check for conflict on the test trip (should not find it)
      const existingInstance = await prisma.listInstance.findFirst({
        where: {
          tripId: testTripId,
          title: "Packing List",
          type: ListType.KIT,
        },
        select: {
          id: true,
        },
      });

      expect(existingInstance).toBeNull();

      // Clean up
      await prisma.listInstance.deleteMany({
        where: { tripId: otherTrip.id },
      });
      await prisma.trip.delete({
        where: { id: otherTrip.id },
      });
    });
  });
});
