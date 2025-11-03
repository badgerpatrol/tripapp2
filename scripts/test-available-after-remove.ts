/**
 * Test that removed users appear in available users list
 * Usage: npx tsx scripts/test-available-after-remove.ts
 */

import { prisma } from "../lib/prisma";
import { removeTripMember } from "../server/services/invitations";

async function testAvailableAfterRemove() {
  try {
    console.log("\n=== Testing Available Users After Removal ===\n");

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
    console.log(`Current active members: ${trip.members.length}`);

    const memberToRemove = trip.members.find(m => m.role !== "OWNER");
    if (!memberToRemove) {
      console.log("No non-owner member found");
      return;
    }

    console.log(`\n1. Before removal:`);

    // Get available users before removal
    const currentMembersBefore = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        deletedAt: null,
      },
      select: { userId: true },
    });

    const currentMemberIdsBefore = currentMembersBefore.map(m => m.userId);

    const availableUsersBefore = await prisma.user.findMany({
      where: {
        id: { notIn: currentMemberIdsBefore },
        deletedAt: null,
      },
      select: { id: true, email: true },
    });

    const isAvailableBefore = availableUsersBefore.some(u => u.id === memberToRemove.userId);
    console.log(`   ${memberToRemove.user.email} in available list: ${isAvailableBefore ? 'Yes ✗' : 'No ✓'}`);
    console.log(`   Total available users: ${availableUsersBefore.length}`);

    // Remove the member
    console.log(`\n2. Removing member: ${memberToRemove.user.email}`);
    await removeTripMember(trip.id, memberToRemove.userId, trip.createdById);
    console.log(`   ✓ Member removed (soft-deleted)`);

    // Get available users after removal
    console.log(`\n3. After removal:`);

    const currentMembersAfter = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        deletedAt: null,
      },
      select: { userId: true },
    });

    const currentMemberIdsAfter = currentMembersAfter.map(m => m.userId);

    const availableUsersAfter = await prisma.user.findMany({
      where: {
        id: { notIn: currentMemberIdsAfter },
        deletedAt: null,
      },
      select: { id: true, email: true },
    });

    const isAvailableAfter = availableUsersAfter.some(u => u.id === memberToRemove.userId);
    console.log(`   ${memberToRemove.user.email} in available list: ${isAvailableAfter ? 'Yes ✓' : 'No ✗'}`);
    console.log(`   Total available users: ${availableUsersAfter.length}`);

    console.log(`\n4. Verification:`);
    console.log(`   Available users increased by 1: ${availableUsersAfter.length === availableUsersBefore.length + 1 ? 'Yes ✓' : 'No ✗'}`);
    console.log(`   Removed user now available: ${isAvailableAfter ? 'Yes ✓' : 'No ✗'}`);

    if (isAvailableAfter && availableUsersAfter.length === availableUsersBefore.length + 1) {
      console.log("\n=== Test Passed! ✓ ===");
      console.log("Removed users correctly appear in available users list");
    } else {
      console.log("\n=== Test Failed! ✗ ===");
    }

  } catch (error) {
    console.error("\n✗ Test failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testAvailableAfterRemove();
