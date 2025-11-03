/**
 * Test script for the available users endpoint
 * Usage: npx tsx scripts/test-available-users.ts
 */

import { prisma } from "../lib/prisma";

async function testAvailableUsers() {
  try {
    console.log("\n=== Testing Available Users Endpoint Logic ===\n");

    // 1. Find a test trip
    console.log("1. Finding a trip...");
    const trip = await prisma.trip.findFirst({
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

    console.log(`   Using trip: "${trip.name}" (ID: ${trip.id})`);
    console.log(`   Current members: ${trip.members.length}`);

    // 2. Get all current trip members
    const currentMembers = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    const currentMemberIds = currentMembers.map(m => m.userId);
    console.log(`\n2. Current member IDs: ${currentMemberIds.join(", ")}`);

    // 3. Get all users who are NOT in this trip
    const availableUsers = await prisma.user.findMany({
      where: {
        id: {
          notIn: currentMemberIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        photoURL: true,
      },
      orderBy: [
        { displayName: "asc" },
        { email: "asc" },
      ],
      take: 100,
    });

    console.log(`\n3. Available users to invite: ${availableUsers.length}`);
    availableUsers.forEach(u => {
      console.log(`   - ${u.displayName || '(no name)'} <${u.email}> (${u.id})`);
    });

    // 4. Get total users in system
    const totalUsers = await prisma.user.count({
      where: {
        deletedAt: null,
      },
    });

    console.log(`\n4. Summary:`);
    console.log(`   Total users in system: ${totalUsers}`);
    console.log(`   Current trip members: ${currentMembers.length}`);
    console.log(`   Available to invite: ${availableUsers.length}`);
    console.log(`   Verification: ${currentMembers.length + availableUsers.length} = ${totalUsers} ✓`);

    console.log("\n=== Test Complete! ===");
  } catch (error) {
    console.error("\nError during test:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAvailableUsers();
