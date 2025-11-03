/**
 * Test script to verify inviting multiple users at once
 * Usage: npx tsx scripts/test-multiple-invites.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip } from "../server/services/invitations";

async function testMultipleInvites() {
  try {
    console.log("\n=== Testing Multiple User Invitations ===\n");

    // Create 3 test users
    console.log("1. Creating test users...");
    const users = await prisma.$transaction([
      prisma.user.upsert({
        where: { email: "multi-test-1@example.com" },
        update: {},
        create: {
          id: "multi-test-1-" + Date.now(),
          email: "multi-test-1@example.com",
          displayName: "Multi Test User 1",
        },
      }),
      prisma.user.upsert({
        where: { email: "multi-test-2@example.com" },
        update: {},
        create: {
          id: "multi-test-2-" + Date.now(),
          email: "multi-test-2@example.com",
          displayName: "Multi Test User 2",
        },
      }),
      prisma.user.upsert({
        where: { email: "multi-test-3@example.com" },
        update: {},
        create: {
          id: "multi-test-3-" + Date.now(),
          email: "multi-test-3@example.com",
          displayName: "Multi Test User 3",
        },
      }),
    ]);

    console.log(`   Created ${users.length} users ✓`);

    // Find a trip
    const trip = await prisma.trip.findFirst({
      where: { status: "PLANNING" },
    });

    if (!trip) {
      console.log("No trip found");
      return;
    }

    console.log(`\n2. Using trip: ${trip.name}`);

    // Clean up any existing memberships for these test users
    await prisma.tripMember.deleteMany({
      where: {
        tripId: trip.id,
        userId: { in: users.map(u => u.id) },
      },
    });

    // Invite all 3 users at once
    console.log(`\n3. Inviting ${users.length} users simultaneously...`);
    const emails = users.map(u => u.email);
    console.log(`   Emails: ${emails.join(", ")}`);

    const result = await inviteUsersToTrip(trip.id, emails, trip.createdById);

    console.log("\n4. Results:");
    console.log(`   ✓ Invited: ${result.invited.length}`);
    result.invited.forEach(i => console.log(`      - ${i.email}`));

    console.log(`   Already members: ${result.alreadyMembers.length}`);
    console.log(`   Not found: ${result.notFound.length}`);

    // Verify all memberships were created
    const memberships = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: { in: users.map(u => u.id) },
        deletedAt: null,
      },
      include: { user: true },
    });

    console.log(`\n5. Verification:`);
    console.log(`   TripMember records created: ${memberships.length}`);
    memberships.forEach(m => {
      console.log(`      - ${m.user.email}: ${m.role}, ${m.rsvpStatus}`);
    });

    // Verify notifications
    const notifications = await prisma.notification.findMany({
      where: {
        tripId: trip.id,
        recipientId: { in: users.map(u => u.id) },
        type: "TRIP_INVITE",
      },
    });

    console.log(`\n6. Notifications created: ${notifications.length} ✓`);

    const success = result.invited.length === users.length &&
                    memberships.length === users.length &&
                    notifications.length === users.length;

    if (success) {
      console.log("\n=== All Tests Passed! ✓ ===");
    } else {
      console.log("\n=== Some tests failed ✗ ===");
    }

  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testMultipleInvites();
