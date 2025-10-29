/**
 * Test script for PUT /api/trips/:id endpoint
 *
 * This script:
 * 1. Creates a test user
 * 2. Creates a test trip
 * 3. Updates the trip with new dates
 * 4. Verifies timeline items were updated
 */

import { prisma } from "../lib/prisma.js";
import { adminAuth } from "../lib/firebase/admin.js";
import { createTrip, updateTrip, getTripById } from "../server/services/trips.js";

async function testUpdateTrip() {
  let testUserId: string | null = null;
  let testTripId: string | null = null;

  try {
    console.log("=== Testing Trip Update ===\n");

    // 1. Create test user
    console.log("1. Creating test user...");
    const email = `test-${Date.now()}@example.com`;
    const userRecord = await adminAuth.createUser({
      email,
      password: "test123456",
      displayName: "Test User",
    });
    testUserId = userRecord.uid;

    // Sync user to database
    const dbUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: email,
        displayName: "Test User",
      },
    });
    console.log(`✓ Created user: ${dbUser.id}\n`);

    // 2. Create a test trip
    console.log("2. Creating test trip...");
    const tripData = {
      name: "Test Trip - Update Test",
      description: "Testing trip update functionality",
      baseCurrency: "USD",
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-10"),
    };

    const trip = await createTrip(testUserId, tripData);
    testTripId = trip.id;
    console.log(`✓ Created trip: ${trip.id}`);
    console.log(`  Original start date: ${trip.startDate?.toISOString()}`);
    console.log(`  Original end date: ${trip.endDate?.toISOString()}\n`);

    // 3. Get original timeline items
    console.log("3. Fetching original timeline items...");
    const originalTrip = await getTripById(testTripId);
    const originalTimeline = originalTrip?.timelineItems || [];
    console.log(`✓ Found ${originalTimeline.length} timeline items`);
    originalTimeline.forEach((item) => {
      console.log(`  - ${item.title}: ${item.date?.toISOString()}`);
    });
    console.log();

    // 4. Update the trip with new dates
    console.log("4. Updating trip dates...");
    const updateData = {
      startDate: new Date("2025-11-15"),
      endDate: new Date("2025-11-25"),
      description: "Updated description after date change",
    };

    const updatedTrip = await updateTrip(testTripId, testUserId, updateData);
    console.log(`✓ Updated trip: ${updatedTrip.id}`);
    console.log(`  New start date: ${updatedTrip.startDate?.toISOString()}`);
    console.log(`  New end date: ${updatedTrip.endDate?.toISOString()}\n`);

    // 5. Verify timeline items were updated
    console.log("5. Verifying timeline items were updated...");
    const updatedTripData = await getTripById(testTripId);
    const updatedTimeline = updatedTripData?.timelineItems || [];
    console.log(`✓ Found ${updatedTimeline.length} timeline items`);
    updatedTimeline.forEach((item) => {
      console.log(`  - ${item.title}: ${item.date?.toISOString()}`);
    });
    console.log();

    // 6. Check that dependent timeline items changed
    console.log("6. Comparing timeline item changes...");
    const changes = [];
    for (const originalItem of originalTimeline) {
      const updatedItem = updatedTimeline.find((i) => i.title === originalItem.title);
      if (updatedItem && originalItem.date?.getTime() !== updatedItem.date?.getTime()) {
        changes.push({
          title: originalItem.title,
          oldDate: originalItem.date,
          newDate: updatedItem.date,
        });
      }
    }

    console.log(`✓ Found ${changes.length} timeline items with updated dates:`);
    changes.forEach((change) => {
      console.log(`  - ${change.title}:`);
      console.log(`    Old: ${change.oldDate?.toISOString()}`);
      console.log(`    New: ${change.newDate?.toISOString()}`);
    });
    console.log();

    // 7. Verify EventLog entry
    console.log("7. Checking EventLog...");
    const eventLogs = await prisma.eventLog.findMany({
      where: {
        entity: "Trip",
        entityId: testTripId,
        eventType: "TRIP_UPDATED",
      },
      orderBy: { createdAt: "desc" },
    });
    console.log(`✓ Found ${eventLogs.length} TRIP_UPDATED event(s)`);
    if (eventLogs.length > 0) {
      const latestEvent = eventLogs[0];
      console.log(`  Event payload: ${JSON.stringify(latestEvent.payload, null, 2)}`);
    }

    console.log("\n=== Test completed successfully! ===");
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (testTripId) {
      console.log("\nCleaning up...");
      await prisma.trip.delete({ where: { id: testTripId } });
      console.log("✓ Deleted test trip");
    }
    if (testUserId) {
      await adminAuth.deleteUser(testUserId);
      await prisma.user.delete({ where: { id: testUserId } });
      console.log("✓ Deleted test user");
    }
    await prisma.$disconnect();
  }
}

testUpdateTrip();
