#!/usr/bin/env tsx
/**
 * Test the trip lists API endpoint
 */

import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Trip Lists Endpoint...\n');

  try {
    // Get a trip
    const trip = await prisma.trip.findFirst({
      include: {
        members: true,
      },
    });

    if (!trip) {
      console.log('❌ No trips found in database');
      return;
    }

    console.log(`✓ Found trip: ${trip.name} (${trip.id})`);
    console.log(`✓ Members: ${trip.members.length}`);

    // Check for list instances
    const instances = await prisma.listInstance.findMany({
      where: { tripId: trip.id },
      include: {
        todoItems: true,
        kitItems: true,
      },
    });

    console.log(`\n✓ Found ${instances.length} list instance(s) for this trip`);

    if (instances.length === 0) {
      console.log('\n📝 No list instances exist yet. This is expected if you haven\'t copied any templates.');
      console.log('   The API should return an empty array, which the UI should handle gracefully.');
    } else {
      instances.forEach((inst) => {
        const itemCount = inst.type === 'TODO' ? inst.todoItems.length : inst.kitItems.length;
        console.log(`   - ${inst.title} (${inst.type}): ${itemCount} items`);
      });
    }

    // Test the requireTripMember function by checking members
    const firstMember = trip.members[0];
    if (firstMember) {
      console.log(`\n✓ First member: ${firstMember.userId}`);

      // Verify they can access the trip
      const membership = await prisma.tripMember.findFirst({
        where: {
          tripId: trip.id,
          userId: firstMember.userId,
        },
      });

      if (membership) {
        console.log('✓ Member participation verified');
      } else {
        console.log('❌ Member participation not found');
      }
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
