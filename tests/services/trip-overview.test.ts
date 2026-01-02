import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createTrip,
  getTripOverviewForInvitee,
  getTripOverviewForMember,
} from "@/server/services/trips";
import { prisma } from "@/lib/prisma";
import { TripMemberRole, RsvpStatus } from "@/lib/generated/prisma";

describe("Trip Overview Service", () => {
  const ownerUserId = "test-owner-123";
  const inviteeUserId = "test-invitee-456";
  const memberUserId = "test-member-789";
  const nonMemberUserId = "test-nonmember-000";

  let testTripId: string;

  beforeEach(async () => {
    // Create test users
    await prisma.user.createMany({
      data: [
        { id: ownerUserId, email: "owner@test.com", displayName: "Owner" },
        { id: inviteeUserId, email: "invitee@test.com", displayName: "Invitee" },
        { id: memberUserId, email: "member@test.com", displayName: "Member" },
        { id: nonMemberUserId, email: "nonmember@test.com", displayName: "Non-Member" },
      ],
    });

    // Create a test trip with owner
    const trip = await createTrip(ownerUserId, {
      name: "Test Trip",
      description: "Test trip overview",
      baseCurrency: "USD",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-06-10"),
      signUpMode: false,
    });

    testTripId = trip.id;

    // Add invitee (pending RSVP)
    await prisma.tripMember.create({
      data: {
        tripId: testTripId,
        userId: inviteeUserId,
        role: TripMemberRole.MEMBER,
        rsvpStatus: RsvpStatus.PENDING,
      },
    });

    // Add accepted member
    await prisma.tripMember.create({
      data: {
        tripId: testTripId,
        userId: memberUserId,
        role: TripMemberRole.MEMBER,
        rsvpStatus: RsvpStatus.ACCEPTED,
      },
    });

    // Add a test spend
    await prisma.spend.create({
      data: {
        tripId: testTripId,
        description: "Hotel Booking",
        amount: 500,
        currency: "USD",
        fxRate: 1.0,
        normalizedAmount: 500,
        paidById: ownerUserId,
        date: new Date("2025-06-02"),
        assignments: {
          create: [
            {
              userId: ownerUserId,
              shareAmount: 250,
              normalizedShareAmount: 250,
              splitType: "EQUAL",
            },
            {
              userId: memberUserId,
              shareAmount: 250,
              normalizedShareAmount: 250,
              splitType: "EQUAL",
            },
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up in order
    await prisma.spendAssignment.deleteMany({
      where: {
        spend: { tripId: testTripId },
      },
    });
    await prisma.spend.deleteMany({ where: { tripId: testTripId } });
    await prisma.timelineItem.deleteMany({ where: { tripId: testTripId } });
    await prisma.tripMember.deleteMany({ where: { tripId: testTripId } });
    await prisma.trip.deleteMany({ where: { id: testTripId } });
    // Delete event logs before users (foreign key constraint)
    await prisma.eventLog.deleteMany({
      where: {
        byUser: { in: [ownerUserId, inviteeUserId, memberUserId, nonMemberUserId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [ownerUserId, inviteeUserId, memberUserId, nonMemberUserId] },
      },
    });
  });

  describe("getTripOverviewForInvitee", () => {
    it("should return basic trip info for invitee", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview).toBeDefined();
      expect(overview!.id).toBe(testTripId);
      expect(overview!.name).toBe("Test Trip");
      expect(overview!.description).toBe("Test trip overview");
      expect(overview!.baseCurrency).toBe("USD");
    });

    it("should include organizer info", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview!.organizer).toBeDefined();
      expect(overview!.organizer.id).toBe(ownerUserId);
      expect(overview!.organizer.email).toBe("owner@test.com");
    });

    it("should include participant list", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview!.participants).toBeDefined();
      expect(overview!.participants.length).toBe(3); // owner + invitee + member

      const ownerParticipant = overview!.participants.find(
        (p) => p.user.id === ownerUserId
      );
      expect(ownerParticipant?.role).toBe(TripMemberRole.OWNER);
      expect(ownerParticipant?.rsvpStatus).toBe(RsvpStatus.ACCEPTED);

      const inviteeParticipant = overview!.participants.find(
        (p) => p.user.id === inviteeUserId
      );
      expect(inviteeParticipant?.role).toBe(TripMemberRole.MEMBER);
      expect(inviteeParticipant?.rsvpStatus).toBe(RsvpStatus.PENDING);
    });

    it("should include user's role and RSVP status", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview!.userRole).toBe(TripMemberRole.MEMBER);
      expect(overview!.userRsvpStatus).toBe(RsvpStatus.PENDING);
    });

    it("should return null role/status for non-members", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        nonMemberUserId
      );

      expect(overview!.userRole).toBeNull();
      expect(overview!.userRsvpStatus).toBeNull();
    });

    it("should NOT include timeline items", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview).not.toHaveProperty("timeline");
      expect(overview).not.toHaveProperty("spends");
      expect(overview).not.toHaveProperty("totalSpent");
    });

    it("should return null for non-existent trip", async () => {
      const overview = await getTripOverviewForInvitee(
        "non-existent-id",
        inviteeUserId
      );

      expect(overview).toBeNull();
    });
  });

  describe("getTripOverviewForMember", () => {
    it("should return full trip info for accepted member", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview).toBeDefined();
      expect(overview!.id).toBe(testTripId);
      expect(overview!.name).toBe("Test Trip");
      expect(overview!.organizer.id).toBe(ownerUserId);
      expect(overview!.participants.length).toBe(3);
    });

    it("should include timeline items", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview!.timeline).toBeDefined();
      expect(overview!.timeline.length).toBeGreaterThan(0);

      const firstItem = overview!.timeline[0];
      expect(firstItem.title).toBe("");
      expect(firstItem.isCompleted).toBe(true);
    });

    it("should include spends", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview!.spends).toBeDefined();
      expect(overview!.spends.length).toBe(1);

      const spend = overview!.spends[0];
      expect(spend.description).toBe("Hotel Booking");
      expect(spend.amount).toBe(500);
      expect(spend.currency).toBe("USD");
      expect(spend.paidBy.id).toBe(ownerUserId);
    });

    it("should include user assignments", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview!.userAssignments).toBeDefined();
      expect(overview!.userAssignments.length).toBe(1);

      const assignment = overview!.userAssignments[0];
      expect(assignment.userId).toBe(memberUserId);
      expect(assignment.shareAmount).toBe(250);
      expect(assignment.splitType).toBe("EQUAL");
    });

    it("should calculate total spent", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview!.totalSpent).toBe(500);
    });

    it("should calculate user owes amount", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      // Member owes 250 (their share of the hotel)
      expect(overview!.userOwes).toBe(250);
      expect(overview!.userIsOwed).toBe(0);
    });

    it("should calculate user is owed amount", async () => {
      const overview = await getTripOverviewForMember(testTripId, ownerUserId);

      // Owner paid 500, their share is 250, so they're owed 250
      expect(overview!.userOwes).toBe(0);
      expect(overview!.userIsOwed).toBe(250);
    });

    it("should return null for non-existent trip", async () => {
      const overview = await getTripOverviewForMember(
        "non-existent-id",
        memberUserId
      );

      expect(overview).toBeNull();
    });
  });

  describe("Different user perspectives", () => {
    it("owner should see full overview", async () => {
      const overview = await getTripOverviewForMember(testTripId, ownerUserId);

      expect(overview!.userRole).toBe(TripMemberRole.OWNER);
      expect(overview!.userRsvpStatus).toBe(RsvpStatus.ACCEPTED);
      expect(overview!.timeline).toBeDefined();
      expect(overview!.spends).toBeDefined();
    });

    it("invitee should see limited overview", async () => {
      const overview = await getTripOverviewForInvitee(
        testTripId,
        inviteeUserId
      );

      expect(overview!.userRole).toBe(TripMemberRole.MEMBER);
      expect(overview!.userRsvpStatus).toBe(RsvpStatus.PENDING);
      expect(overview).not.toHaveProperty("timeline");
      expect(overview).not.toHaveProperty("spends");
    });

    it("accepted member should see full overview", async () => {
      const overview = await getTripOverviewForMember(
        testTripId,
        memberUserId
      );

      expect(overview!.userRole).toBe(TripMemberRole.MEMBER);
      expect(overview!.userRsvpStatus).toBe(RsvpStatus.ACCEPTED);
      expect(overview!.timeline).toBeDefined();
      expect(overview!.spends).toBeDefined();
    });
  });
});
