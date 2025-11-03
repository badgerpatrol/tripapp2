/**
 * Comprehensive test covering all invitation scenarios:
 * - New invites
 * - Already member
 * - User not found
 * - Re-invite removed member
 * Usage: npx tsx scripts/test-invitation-comprehensive.ts
 */

import { prisma } from "../lib/prisma";
import { inviteUsersToTrip, removeTripMember } from "../server/services/invitations";

async function comprehensiveTest() {
  try {
    console.log("\n=== Comprehensive Invitation Test ===\n");

    // Setup: Create test users
    console.log("1. Setting up test data...");
    const newUser = await prisma.user.upsert({
      where: { email: "comp-new@example.com" },
      update: {},
      create: {
        id: "comp-new-" + Date.now(),
        email: "comp-new@example.com",
        displayName: "New User",
      },
    });

    const existingUser = await prisma.user.upsert({
      where: { email: "comp-existing@example.com" },
      update: {},
      create: {
        id: "comp-existing-" + Date.now(),
        email: "comp-existing@example.com",
        displayName: "Existing User",
      },
    });

    const removedUser = await prisma.user.upsert({
      where: { email: "comp-removed@example.com" },
      update: {},
      create: {
        id: "comp-removed-" + Date.now(),
        email: "comp-removed@example.com",
        displayName: "Removed User",
      },
    });

    const trip = await prisma.trip.findFirst({
      where: { status: "PLANNING" },
    });

    if (!trip) {
      console.log("No trip found");
      return;
    }

    console.log(`   Trip: ${trip.name}`);
    console.log(`   ✓ Created/found 3 test users`);

    // Add existing user to trip
    await prisma.tripMember.deleteMany({
      where: {
        tripId: trip.id,
        userId: { in: [newUser.id, existingUser.id, removedUser.id] },
      },
    });

    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: existingUser.id,
        role: "MEMBER",
        rsvpStatus: "ACCEPTED",
        invitedById: trip.createdById,
      },
    });
    console.log(`   ✓ Added existing user to trip`);

    // Add and then remove the "removed" user
    await prisma.tripMember.create({
      data: {
        tripId: trip.id,
        userId: removedUser.id,
        role: "MEMBER",
        rsvpStatus: "PENDING",
        invitedById: trip.createdById,
      },
    });
    await removeTripMember(trip.id, removedUser.id, trip.createdById);
    console.log(`   ✓ Created and removed user (soft-deleted)`);

    // Test comprehensive invite
    console.log(`\n2. Testing comprehensive invitation...`);
    const emailsToInvite = [
      "comp-new@example.com",           // Should be invited
      "comp-existing@example.com",      // Should be "already member"
      "comp-removed@example.com",       // Should be re-invited
      "nonexistent@example.com",        // Should be "not found"
    ];
    console.log(`   Inviting: ${emailsToInvite.join(", ")}`);

    const result = await inviteUsersToTrip(trip.id, emailsToInvite, trip.createdById);

    console.log(`\n3. Results:`);
    console.log(`   ✓ Invited (${result.invited.length}):`);
    result.invited.forEach(i => console.log(`      - ${i.email} (${i.status})`));

    console.log(`   ⚠ Already members (${result.alreadyMembers.length}):`);
    result.alreadyMembers.forEach(i => console.log(`      - ${i.email}`));

    console.log(`   ✗ Not found (${result.notFound.length}):`);
    result.notFound.forEach(i => console.log(`      - ${i.email}`));

    // Verify expectations
    console.log(`\n4. Verification:`);
    const expectations = {
      invited: 2,           // new user + re-invited user
      alreadyMembers: 1,    // existing user
      notFound: 1,          // nonexistent email
    };

    const checks = [
      {
        name: "New users invited",
        expected: expectations.invited,
        actual: result.invited.length,
      },
      {
        name: "Already members detected",
        expected: expectations.alreadyMembers,
        actual: result.alreadyMembers.length,
      },
      {
        name: "Non-existent users detected",
        expected: expectations.notFound,
        actual: result.notFound.length,
      },
    ];

    let allPassed = true;
    checks.forEach(check => {
      const passed = check.expected === check.actual;
      console.log(`   ${passed ? '✓' : '✗'} ${check.name}: ${check.actual} (expected ${check.expected})`);
      if (!passed) allPassed = false;
    });

    // Verify database state
    const memberships = await prisma.tripMember.findMany({
      where: {
        tripId: trip.id,
        userId: { in: [newUser.id, existingUser.id, removedUser.id] },
      },
      include: { user: true },
    });

    console.log(`\n5. Database state:`);
    memberships.forEach(m => {
      console.log(`   ${m.user.email}:`);
      console.log(`      - Deleted: ${m.deletedAt ? 'Yes' : 'No'}`);
      console.log(`      - RSVP: ${m.rsvpStatus}`);
      console.log(`      - Role: ${m.role}`);
    });

    // Verify removed user was re-activated
    const removedMembership = memberships.find(m => m.userId === removedUser.id);
    const reActivated = removedMembership && !removedMembership.deletedAt;
    console.log(`\n   ${reActivated ? '✓' : '✗'} Removed user was re-activated`);

    if (allPassed && reActivated) {
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

comprehensiveTest();
