/**
 * Test script to verify the invitation fix
 * Usage: npx tsx scripts/test-invite-fix.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip } from "../server/services/invitations";

async function testInviteFix() {
  try {
    console.log("\n=== Testing Invitation Fix ===\n");

    // Find a trip
    const trip = await prisma.trip.findFirst({
      where: { status: "PLANNING" },
    });

    if (!trip) {
      console.log("No trip found");
      return;
    }

    console.log(`Using trip: ${trip.name} (${trip.id})`);

    // Find an available user (not in this trip)
    const availUser = await prisma.user.findFirst({
      where: {
        email: { startsWith: "available-user-" },
        tripMemberships: {
          none: {
            tripId: trip.id,
            deletedAt: null,
          },
        },
      },
    });

    if (!availUser) {
      console.log("No available user found to invite");
      return;
    }

    console.log(`\nInviting: ${availUser.email}`);

    // Test the invite function
    const result = await inviteUsersToTrip(
      trip.id,
      { emails: [availUser.email] },
      trip.createdById
    );

    console.log("\n✓ Invitation successful!");
    console.log("Result:", JSON.stringify(result, null, 2));

    // Verify the member was created
    const member = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: availUser.id,
        },
      },
    });

    console.log("\n✓ TripMember created:");
    console.log(`  Role: ${member?.role}`);
    console.log(`  RSVP: ${member?.rsvpStatus}`);

    // Verify notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        recipientId: availUser.id,
        tripId: trip.id,
        type: "TRIP_INVITE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log("\n✓ Notification created:");
    console.log(`  Title: ${notification?.title}`);
    console.log(`  Status: ${notification?.status}`);

    console.log("\n=== Test Passed! ✓ ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testInviteFix();
