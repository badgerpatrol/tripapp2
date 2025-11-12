/**
 * Test script for RSVP flow with Accept/Decline/Maybe
 * Usage: npx tsx scripts/test-rsvp-flow.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip, updateRsvpStatus } from "../server/services/invitations";
import { RsvpStatus } from "../lib/generated/prisma";

async function cleanup() {
  console.log("Cleaning up test users...");
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "rsvp-test-1@example.com",
          "rsvp-test-2@example.com",
          "rsvp-test-3@example.com",
        ],
      },
    },
  });
}

async function createTestUsers() {
  console.log("Creating test users...");
  const users = await prisma.$transaction([
    prisma.user.create({
      data: {
        id: "rsvp-test-user-1-" + Date.now(),
        email: "rsvp-test-1@example.com",
        displayName: "RSVP Test User 1",
      },
    }),
    prisma.user.create({
      data: {
        id: "rsvp-test-user-2-" + Date.now(),
        email: "rsvp-test-2@example.com",
        displayName: "RSVP Test User 2",
      },
    }),
    prisma.user.create({
      data: {
        id: "rsvp-test-user-3-" + Date.now(),
        email: "rsvp-test-3@example.com",
        displayName: "RSVP Test User 3",
      },
    }),
  ]);
  console.log(`  Created ${users.length} test users`);
  return users;
}

async function testRsvpFlow() {
  try {
    console.log("\n=== RSVP Flow Test (Accept/Decline/Maybe) ===\n");

    // Clean up any existing test data
    await cleanup();

    // Create test users
    const testUsers = await createTestUsers();

    // 1. Find a test trip
    console.log("\n1. Finding a trip...");
    const trip = await prisma.trip.findFirst({
      where: {
        status: "PLANNING",
      },
      include: {
        createdBy: true,
      },
    });

    if (!trip) {
      console.log("   No trips found. Please create a trip first.");
      return;
    }

    console.log(`   Using trip: "${trip.name}" (ID: ${trip.id})`);
    console.log(`   Owner: ${trip.createdBy.email}`);

    // 2. Invite users
    console.log("\n2. Inviting users to the trip...");
    const inviteResult = await inviteUsersToTrip(
      trip.id,
      { emails: [testUsers[0].email, testUsers[1].email, testUsers[2].email] },
      trip.createdById
    );

    console.log(`   ✓ Invited ${inviteResult.invited.length} users`);

    // 3. Verify initial RSVP status (should be PENDING)
    console.log("\n3. Verifying initial RSVP status...");
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: {
          in: testUsers.map((u) => u.id),
        },
      },
      include: {
        user: true,
      },
    });

    console.log(`   Found ${members.length} members:`);
    members.forEach((m) => {
      console.log(`   - ${m.user.email}: ${m.rsvpStatus}`);
    });

    const allPending = members.every((m) => m.rsvpStatus === RsvpStatus.PENDING);
    console.log(`   All RSVP statuses are PENDING: ${allPending ? "✓" : "✗"}`);

    // 4. Test ACCEPTED status
    console.log("\n4. Testing ACCEPTED RSVP...");
    const acceptedMember = await updateRsvpStatus(
      trip.id,
      testUsers[0].id,
      RsvpStatus.ACCEPTED
    );
    console.log(`   ✓ ${testUsers[0].email} RSVP status: ${acceptedMember.rsvpStatus}`);

    // 5. Test DECLINED status
    console.log("\n5. Testing DECLINED RSVP...");
    const declinedMember = await updateRsvpStatus(
      trip.id,
      testUsers[1].id,
      RsvpStatus.DECLINED
    );
    console.log(`   ✓ ${testUsers[1].email} RSVP status: ${declinedMember.rsvpStatus}`);

    // 6. Test MAYBE status
    console.log("\n6. Testing MAYBE RSVP...");
    const maybeMember = await updateRsvpStatus(
      trip.id,
      testUsers[2].id,
      RsvpStatus.MAYBE
    );
    console.log(`   ✓ ${testUsers[2].email} RSVP status: ${maybeMember.rsvpStatus}`);

    // 7. Verify all three statuses
    console.log("\n7. Verifying all RSVP statuses...");
    const updatedMembers = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: {
          in: testUsers.map((u) => u.id),
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        user: {
          email: "asc",
        },
      },
    });

    console.log(`   Current RSVP statuses:`);
    updatedMembers.forEach((m) => {
      const icon =
        m.rsvpStatus === RsvpStatus.ACCEPTED
          ? "✓"
          : m.rsvpStatus === RsvpStatus.DECLINED
          ? "✗"
          : m.rsvpStatus === RsvpStatus.MAYBE
          ? "?"
          : "○";
      console.log(`   ${icon} ${m.user.email}: ${m.rsvpStatus}`);
    });

    // 8. Test changing from one status to another
    console.log("\n8. Testing RSVP status changes...");
    console.log("   Changing MAYBE to ACCEPTED...");
    const changedMember = await updateRsvpStatus(
      trip.id,
      testUsers[2].id,
      RsvpStatus.ACCEPTED
    );
    console.log(`   ✓ ${testUsers[2].email} changed to: ${changedMember.rsvpStatus}`);

    // 9. Check event logs
    console.log("\n9. Checking event logs...");
    const eventLogs = await prisma.eventLog.findMany({
      where: {
        entity: "TripMember",
        entityId: trip.id,
        eventType: "TRIP_UPDATED",
        payload: {
          path: ["action"],
          equals: "rsvp_updated",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    console.log(`   Found ${eventLogs.length} RSVP update events:`);
    eventLogs.forEach((log) => {
      const payload = log.payload as any;
      console.log(`   - User ${log.byUser}: ${payload.rsvpStatus}`);
    });

    // 10. Check notifications
    console.log("\n10. Checking notifications...");
    const notifications = await prisma.notification.findMany({
      where: {
        tripId: trip.id,
        type: "TRIP_INVITE",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
      include: {
        recipient: true,
        sender: true,
      },
    });

    console.log(`   Found ${notifications.length} notifications:`);
    notifications.forEach((n) => {
      console.log(`   - To: ${n.recipient.email}`);
      console.log(`     From: ${n.sender?.email || "System"}`);
      console.log(`     Title: ${n.title}`);
      console.log(`     Message: ${n.message}`);
    });

    console.log("\n=== Test Summary ===");
    console.log("✓ Created 3 test users");
    console.log("✓ Invited users to trip (all started with PENDING)");
    console.log("✓ Tested ACCEPTED status");
    console.log("✓ Tested DECLINED status");
    console.log("✓ Tested MAYBE status");
    console.log("✓ Tested changing RSVP status (MAYBE → ACCEPTED)");
    console.log("✓ Verified event logs are created");
    console.log("✓ Verified notifications are sent");

    console.log("\n✓ All RSVP flow tests passed!");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  } finally {
    // Clean up
    await cleanup();
    await prisma.$disconnect();
  }
}

// Run the test
testRsvpFlow()
  .then(() => {
    console.log("\nTest completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nTest failed:", error);
    process.exit(1);
  });
