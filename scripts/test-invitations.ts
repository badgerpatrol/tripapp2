/**
 * Test script for the invitation API
 * Usage: npx tsx scripts/test-invitations.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip } from "../server/services/invitations";

async function testInvitations() {
  try {
    console.log("=== Testing Invitation System ===\n");

    // 1. Find or create a test trip
    console.log("1. Looking for a test trip...");
    let trip = await prisma.trip.findFirst({
      where: {
        status: "PLANNING",
      },
      include: {
        createdBy: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!trip) {
      console.log("   No trips found. Please create a trip first.");
      return;
    }

    console.log(`   Found trip: "${trip.name}" (ID: ${trip.id})`);
    console.log(`   Created by: ${trip.createdBy.email}`);
    console.log(`   Current members: ${trip.members.length}`);
    console.log("");

    // 2. Find some users to invite (excluding existing members)
    console.log("2. Finding users to invite...");
    const existingMemberIds = trip.members.map(m => m.userId);
    const usersToInvite = await prisma.user.findMany({
      where: {
        id: {
          notIn: [...existingMemberIds, trip.createdById],
        },
        deletedAt: null,
      },
      take: 3,
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    if (usersToInvite.length === 0) {
      console.log("   No additional users found to invite.");
      console.log("   Creating a test scenario with existing user emails...");

      // Test with one existing member and one fake email
      const testEmails = [
        trip.members[0]?.user.email || trip.createdBy.email,
        "nonexistent@example.com",
      ];

      console.log(`   Testing with emails: ${testEmails.join(", ")}`);
      console.log("");

      console.log("3. Sending invitations...");
      const result = await inviteUsersToTrip(trip.id, { emails: testEmails }, trip.createdById);

      console.log("\n=== Invitation Results ===");
      console.log(`Invited: ${result.invited.length} users`);
      result.invited.forEach(i => console.log(`  - ${i.email} (${i.userId})`));

      console.log(`\nAlready members: ${result.alreadyMembers.length} users`);
      result.alreadyMembers.forEach(i => console.log(`  - ${i.email} (${i.userId})`));

      console.log(`\nNot found: ${result.notFound.length} emails`);
      result.notFound.forEach(i => console.log(`  - ${'email' in i ? i.email : i.userId}`));

      return;
    }

    const emailsToInvite = usersToInvite.map(u => u.email);
    console.log(`   Found ${usersToInvite.length} users to invite:`);
    usersToInvite.forEach(u => console.log(`   - ${u.email} (${u.displayName || 'No name'})`));
    console.log("");

    // 3. Send invitations
    console.log("3. Sending invitations...");
    const result = await inviteUsersToTrip(trip.id, { emails: emailsToInvite }, trip.createdById);

    console.log("\n=== Invitation Results ===");
    console.log(`Invited: ${result.invited.length} users`);
    result.invited.forEach(i => console.log(`  - ${i.email} (${i.userId})`));

    console.log(`\nAlready members: ${result.alreadyMembers.length} users`);
    result.alreadyMembers.forEach(i => console.log(`  - ${i.email} (${i.userId})`));

    console.log(`\nNot found: ${result.notFound.length} emails`);
    result.notFound.forEach(i => console.log(`  - ${'email' in i ? i.email : i.userId}`));

    // 4. Verify TripMember records were created
    console.log("\n4. Verifying database records...");
    const newMembers = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: {
          in: result.invited.map(i => i.userId),
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

    console.log(`   Found ${newMembers.length} new TripMember records:`);
    newMembers.forEach(m => {
      console.log(`   - ${m.user.email}: Role=${m.role}, RSVP=${m.rsvpStatus}, InvitedBy=${m.invitedById}`);
    });

    // 5. Verify notifications were created
    console.log("\n5. Verifying notifications...");
    const notifications = await prisma.notification.findMany({
      where: {
        tripId: trip.id,
        recipientId: {
          in: result.invited.map(i => i.userId),
        },
        type: "TRIP_INVITE",
      },
      include: {
        sender: {
          select: {
            email: true,
          },
        },
        recipient: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`   Found ${notifications.length} notifications:`);
    notifications.forEach(n => {
      console.log(`   - To: ${n.recipient.email}`);
      console.log(`     Title: ${n.title}`);
      console.log(`     Message: ${n.message}`);
      console.log(`     Status: ${n.status}`);
      console.log("");
    });

    console.log("=== Test Complete! ===");
  } catch (error) {
    console.error("Error during test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testInvitations();
