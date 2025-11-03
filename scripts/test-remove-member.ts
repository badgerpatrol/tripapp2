/**
 * Test script for removing members from trips
 * Usage: npx tsx scripts/test-remove-member.ts
 */

import { prisma } from "../lib/prisma";
import { removeTripMember } from "../server/services/invitations";

async function testRemoveMember() {
  try {
    console.log("\n=== Testing Remove Member Functionality ===\n");

    // 1. Find a test trip with members
    console.log("1. Finding a trip with multiple members...");
    const trip = await prisma.trip.findFirst({
      where: {
        status: "PLANNING",
        members: {
          some: {
            role: {
              not: "OWNER",
            },
            deletedAt: null,
          },
        },
      },
      include: {
        createdBy: true,
        members: {
          where: {
            deletedAt: null,
          },
          include: {
            user: true,
          },
        },
      },
    });

    if (!trip) {
      console.log("   No suitable trip found. Please create a trip with multiple members.");
      return;
    }

    console.log(`   Using trip: "${trip.name}" (ID: ${trip.id})`);
    console.log(`   Current members: ${trip.members.length}`);
    trip.members.forEach(m => {
      console.log(`     - ${m.user.displayName || m.user.email} (${m.role}, ${m.rsvpStatus})`);
    });

    // 2. Find a non-owner member to remove
    const memberToRemove = trip.members.find(m => m.role !== "OWNER");

    if (!memberToRemove) {
      console.log("   No non-owner members found to remove.");
      return;
    }

    console.log(`\n2. Removing member: ${memberToRemove.user.displayName || memberToRemove.user.email}`);
    console.log(`   User ID: ${memberToRemove.userId}`);
    console.log(`   Role: ${memberToRemove.role}`);
    console.log(`   RSVP Status: ${memberToRemove.rsvpStatus}`);

    // 3. Remove the member
    await removeTripMember(trip.id, memberToRemove.userId, trip.createdById);
    console.log("   ✓ Member removed successfully");

    // 4. Verify the member was soft-deleted
    const removedMember = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: trip.id,
          userId: memberToRemove.userId,
        },
      },
    });

    console.log(`\n3. Verifying removal...`);
    console.log(`   Soft deleted: ${removedMember?.deletedAt ? 'Yes ✓' : 'No ✗'}`);
    if (removedMember?.deletedAt) {
      console.log(`   Deleted at: ${removedMember.deletedAt.toISOString()}`);
    }

    // 5. Verify active members count
    const activeMembers = await prisma.tripMember.count({
      where: {
        tripId: trip.id,
        deletedAt: null,
      },
    });

    console.log(`\n4. Current active members: ${activeMembers}`);
    console.log(`   Before: ${trip.members.length}`);
    console.log(`   After: ${activeMembers}`);
    console.log(`   Difference: ${trip.members.length - activeMembers} ✓`);

    // 6. Check event logs
    const eventLogs = await prisma.eventLog.findMany({
      where: {
        entityId: trip.id,
        entity: "TripMember",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1,
    });

    console.log(`\n5. Event log created:`);
    if (eventLogs.length > 0) {
      console.log(`   ✓ Event logged: ${eventLogs[0].eventType}`);
      console.log(`   Payload: ${JSON.stringify(eventLogs[0].payload)}`);
    } else {
      console.log(`   ✗ No event log found`);
    }

    console.log("\n=== Test Complete! ✓ ===");

  } catch (error) {
    console.error("\n✗ Error during test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRemoveMember();
