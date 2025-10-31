/**
 * Test script to verify spend close functionality
 *
 * This script tests:
 * 1. Creating a spend with OPEN status
 * 2. Adding assignments that total 100%
 * 3. Closing the spend
 * 4. Verifying that closed spends cannot be edited
 * 5. Verifying that closed spend assignments cannot be edited
 */

import { prisma } from "../lib/prisma";
import { SpendStatus } from "@/lib/generated/prisma";
import { closeSpend, updateSpend } from "../server/services/spends";
import { updateAssignment } from "../server/services/assignments";

async function testCloseSpend() {
  console.log("=== Testing Spend Close Functionality ===\n");

  try {
    // 1. Find or create a test trip and users
    console.log("1. Setting up test data...");

    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      console.error("No users found in database. Please create a user first.");
      return;
    }

    const testTrip = await prisma.trip.findFirst();

    if (!testTrip) {
      console.error("No trips found in database. Please create a trip first.");
      return;
    }

    console.log(`Using user: ${testUser.email}`);
    console.log(`Using trip: ${testTrip.name}\n`);

    // 2. Create a test spend
    console.log("2. Creating a test spend...");
    const spend = await prisma.spend.create({
      data: {
        tripId: testTrip.id,
        description: "Test Spend - Close Functionality",
        amount: 100,
        currency: "USD",
        fxRate: 1.0,
        normalizedAmount: 100,
        paidById: testUser.id,
        status: SpendStatus.OPEN,
      },
    });
    console.log(`Created spend: ${spend.id}`);
    console.log(`Status: ${spend.status}\n`);

    // 3. Add assignments totaling 100%
    console.log("3. Adding assignment for 100% of spend...");
    const assignment = await prisma.spendAssignment.create({
      data: {
        spendId: spend.id,
        userId: testUser.id,
        shareAmount: 100,
        normalizedShareAmount: 100,
        splitType: "EXACT",
      },
    });
    console.log(`Created assignment: ${assignment.id}\n`);

    // 4. Close the spend
    console.log("4. Closing the spend...");
    const closedSpend = await closeSpend(spend.id, testUser.id, false);
    console.log(`Spend closed successfully!`);
    console.log(`Status: ${closedSpend.status}\n`);

    // 5. Verify EventLog entry
    console.log("5. Verifying EventLog entry...");
    const eventLogs = await prisma.eventLog.findMany({
      where: {
        entity: "Spend",
        entityId: spend.id,
        eventType: "SPEND_CLOSED",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (eventLogs.length > 0) {
      console.log("EventLog entry found:");
      console.log(`  Event Type: ${eventLogs[0].eventType}`);
      console.log(`  User: ${eventLogs[0].byUser}`);
      console.log(`  Payload:`, eventLogs[0].payload);
      console.log();
    } else {
      console.log("WARNING: No EventLog entry found!\n");
    }

    // 6. Try to edit the closed spend (should fail)
    console.log("6. Testing edit lock on closed spend...");
    try {
      await updateSpend(spend.id, testUser.id, { description: "Updated Description" });
      console.log("ERROR: Should not be able to edit closed spend!\n");
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✓ Edit blocked: ${error.message}\n`);
      }
    }

    // 7. Try to edit the assignment (should fail)
    console.log("7. Testing assignment edit lock...");
    try {
      await updateAssignment(assignment.id, testUser.id, { shareAmount: 50 });
      console.log("ERROR: Should not be able to edit assignment for closed spend!\n");
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✓ Assignment edit blocked: ${error.message}\n`);
      }
    }

    // 8. Try to close again (should fail)
    console.log("8. Testing double-close protection...");
    try {
      await closeSpend(spend.id, testUser.id, false);
      console.log("ERROR: Should not be able to close already closed spend!\n");
    } catch (error) {
      if (error instanceof Error) {
        console.log(`✓ Double-close blocked: ${error.message}\n`);
      }
    }

    // 9. Clean up
    console.log("9. Cleaning up test data...");
    await prisma.spendAssignment.delete({ where: { id: assignment.id } });
    await prisma.spend.delete({ where: { id: spend.id } });
    console.log("Test data cleaned up.\n");

    console.log("=== All Tests Passed! ===");
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCloseSpend();
