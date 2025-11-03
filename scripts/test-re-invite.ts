/**
 * Test script to verify re-invitation of removed members
 * Usage: npx tsx scripts/test-re-invite.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip, removeTripMember } from "../server/services/invitations";

async function testReInvite() {
  try {
    console.log("\n=== Testing Re-Invitation of Removed Members ===\n");

    // Find a trip with at least one non-owner member
    const trip = await prisma.trip.findFirst({
      where: {
        status: "PLANNING",
        members: {
          some: {
            role: { not: "OWNER" },
            deletedAt: null,
          },
        },
      },
      include: {
        members: {
          where: { deletedAt: null },
          include: { user: true },
        },
      },
    });

    if (!trip) {
      console.log("No suitable trip found");
      return;
    }

    console.log(`Using trip: ${trip.name}`);
    console.log(`Current members: ${trip.members.length}`);

    const memberToRemove = trip.members.find(m => m.role !== "OWNER");
    if (!memberToRemove) {
      console.log("No non-owner member to test with");
      return;
    }

    console.log(`\n1. Removing member: ${memberToRemove.user.email}`);
    await removeTripMember(trip.id, memberToRemove.userId, trip.createdById);
    console.log("   ✓ Member removed");

    // Verify removal
    const removed = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: memberToRemove.userId,
        },
      },
    });
    console.log(`   Soft deleted: ${removed?.deletedAt ? 'Yes ✓' : 'No ✗'}`);

    console.log(`\n2. Re-inviting the same member: ${memberToRemove.user.email}`);
    const result = await inviteUsersToTrip(
      trip.id,
      [memberToRemove.user.email],
      trip.createdById
    );

    console.log("\n   Result:");
    console.log(`   - Invited: ${result.invited.length}`);
    console.log(`   - Already members: ${result.alreadyMembers.length}`);
    console.log(`   - Not found: ${result.notFound.length}`);

    if (result.invited.length > 0) {
      console.log(`   ✓ Successfully re-invited: ${result.invited[0].email}`);
    }

    // Verify re-invitation
    const reInvited = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: memberToRemove.userId,
        },
      },
    });

    console.log(`\n3. Verification:`);
    console.log(`   Deleted at: ${reInvited?.deletedAt || 'null (active) ✓'}`);
    console.log(`   RSVP status: ${reInvited?.rsvpStatus}`);
    console.log(`   Role: ${reInvited?.role}`);

    // Check notification
    const notification = await prisma.notification.findFirst({
      where: {
        recipientId: memberToRemove.userId,
        tripId: trip.id,
        type: "TRIP_INVITE",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    console.log(`\n4. Notification created: ${notification ? 'Yes ✓' : 'No ✗'}`);
    if (notification) {
      console.log(`   Title: ${notification.title}`);
      console.log(`   Status: ${notification.status}`);
    }

    console.log("\n=== Test Passed! ✓ ===");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testReInvite();
