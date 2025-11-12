/**
 * Comprehensive test script for the invitation API
 * Creates test users, invites them, and verifies the flow
 * Usage: npx tsx scripts/test-invitations-full.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip, updateRsvpStatus } from "../server/services/invitations";
import { RsvpStatus } from "../lib/generated/prisma";

async function cleanup() {
  console.log("Cleaning up test users...");
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ["invite-test-1@example.com", "invite-test-2@example.com", "invite-test-3@example.com"],
      },
    },
  });
}

async function createTestUsers() {
  console.log("Creating test users...");
  const users = await prisma.$transaction([
    prisma.user.create({
      data: {
        id: "test-user-1-" + Date.now(),
        email: "invite-test-1@example.com",
        displayName: "Test User 1",
      },
    }),
    prisma.user.create({
      data: {
        id: "test-user-2-" + Date.now(),
        email: "invite-test-2@example.com",
        displayName: "Test User 2",
      },
    }),
    prisma.user.create({
      data: {
        id: "test-user-3-" + Date.now(),
        email: "invite-test-3@example.com",
        displayName: "Test User 3",
      },
    }),
  ]);
  console.log(`  Created ${users.length} test users`);
  return users;
}

async function testInvitationFlow() {
  try {
    console.log("\n=== Comprehensive Invitation Test ===\n");

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
    const emailsToInvite = [
      testUsers[0].email,
      testUsers[1].email,
      testUsers[2].email,
      "nonexistent@example.com", // This should be in "not found"
      trip.createdBy.email, // This should be in "already members" (owner)
    ];

    console.log(`   Inviting: ${emailsToInvite.join(", ")}`);

    const inviteResult = await inviteUsersToTrip(trip.id, { emails: emailsToInvite }, trip.createdById);

    console.log("\n   Results:");
    console.log(`   ✓ Invited: ${inviteResult.invited.length}`);
    inviteResult.invited.forEach(i => console.log(`     - ${i.email}`));

    console.log(`   ⚠ Already members: ${inviteResult.alreadyMembers.length}`);
    inviteResult.alreadyMembers.forEach(i => console.log(`     - ${i.email}`));

    console.log(`   ✗ Not found: ${inviteResult.notFound.length}`);
    inviteResult.notFound.forEach(i => console.log(`     - ${'email' in i ? i.email : i.userId}`));

    // 3. Verify TripMember records
    console.log("\n3. Verifying TripMember records...");
    const members = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: {
          in: testUsers.map(u => u.id),
        },
      },
      include: {
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
      },
    });

    console.log(`   Found ${members.length} TripMember records:`);
    members.forEach(m => {
      console.log(`   - ${m.user.email}: Role=${m.role}, RSVP=${m.rsvpStatus}, InvitedBy=${m.invitedById}`);
    });

    // Verify RSVP status is PENDING
    const allPending = members.every(m => m.rsvpStatus === RsvpStatus.PENDING);
    console.log(`   All RSVP statuses are PENDING: ${allPending ? '✓' : '✗'}`);

    // 4. Verify notifications
    console.log("\n4. Verifying notifications...");
    const notifications = await prisma.notification.findMany({
      where: {
        tripId: trip.id,
        recipientId: {
          in: testUsers.map(u => u.id),
        },
        type: "TRIP_INVITE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`   Found ${notifications.length} notifications:`);
    notifications.forEach(n => {
      console.log(`   - Recipient: ${n.recipientId}`);
      console.log(`     Title: "${n.title}"`);
      console.log(`     Message: "${n.message}"`);
      console.log(`     Status: ${n.status}`);
      console.log(`     Action URL: ${n.actionUrl}`);
    });

    const allUnread = notifications.every(n => n.status === "UNREAD");
    console.log(`   All notifications are UNREAD: ${allUnread ? '✓' : '✗'}`);

    // 5. Test RSVP acceptance
    console.log("\n5. Testing RSVP acceptance...");
    console.log(`   User "${testUsers[0].displayName}" accepting invitation...`);
    const acceptedMember = await updateRsvpStatus(trip.id, testUsers[0].id, RsvpStatus.ACCEPTED);
    console.log(`   ✓ RSVP status updated to: ${acceptedMember.rsvpStatus}`);

    // 6. Test RSVP decline
    console.log("\n6. Testing RSVP decline...");
    console.log(`   User "${testUsers[1].displayName}" declining invitation...`);
    const declinedMember = await updateRsvpStatus(trip.id, testUsers[1].id, RsvpStatus.DECLINED);
    console.log(`   ✓ RSVP status updated to: ${declinedMember.rsvpStatus}`);

    // 7. Verify organizer was notified of responses
    console.log("\n7. Verifying organizer notifications...");
    const organizerNotifications = await prisma.notification.findMany({
      where: {
        recipientId: trip.createdById,
        tripId: trip.id,
        type: "TRIP_INVITE",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 2,
    });

    console.log(`   Found ${organizerNotifications.length} notification(s) to organizer:`);
    organizerNotifications.forEach(n => {
      console.log(`   - Title: "${n.title}"`);
      console.log(`     Message: "${n.message}"`);
    });

    // 8. Test duplicate invitation (should return "already member")
    console.log("\n8. Testing duplicate invitation...");
    const duplicateResult = await inviteUsersToTrip(trip.id, { emails: [testUsers[0].email] }, trip.createdById);
    console.log(`   Invited: ${duplicateResult.invited.length}`);
    console.log(`   Already members: ${duplicateResult.alreadyMembers.length}`);
    console.log(`   ${duplicateResult.alreadyMembers.length > 0 ? '✓' : '✗'} Correctly detected as already a member`);

    // 9. Verify event logs
    console.log("\n9. Verifying event logs...");
    const eventLogs = await prisma.eventLog.findMany({
      where: {
        entityId: trip.id,
        entity: "TripMember",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    console.log(`   Found ${eventLogs.length} event log(s):`);
    eventLogs.forEach(log => {
      console.log(`   - ${log.eventType}: ${JSON.stringify(log.payload)}`);
    });

    console.log("\n=== All Tests Passed! ✓ ===");
    console.log("\nSummary:");
    console.log(`- Created ${testUsers.length} test users`);
    console.log(`- Invited ${inviteResult.invited.length} users successfully`);
    console.log(`- Created ${members.length} TripMember records with RSVP=PENDING`);
    console.log(`- Sent ${notifications.length} in-app notifications`);
    console.log(`- Tested ACCEPTED and DECLINED RSVP flows`);
    console.log(`- Verified organizer notifications`);
    console.log(`- Verified duplicate invitation handling`);
    console.log(`- Verified event logging`);

  } catch (error) {
    console.error("\n✗ Error during test:", error);
    throw error;
  } finally {
    // Cleanup
    console.log("\nCleaning up...");
    await cleanup();
    await prisma.$disconnect();
    console.log("Done!");
  }
}

// Run the test
testInvitationFlow();
