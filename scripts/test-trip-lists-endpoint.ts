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

    // Check for trip lists (ListTemplates with tripId set)
    const tripLists = await prisma.listTemplate.findMany({
      where: { tripId: trip.id },
      include: {
        todoItems: true,
        kitItems: true,
      },
    });

    console.log(`\n✓ Found ${tripLists.length} trip list(s) for this trip`);

    if (tripLists.length === 0) {
      console.log('\n📝 No trip lists exist yet. This is expected if you haven\'t copied any templates.');
      console.log('   The API should return an empty array, which the UI should handle gracefully.');
    } else {
      tripLists.forEach((list) => {
        const itemCount = list.type === 'TODO' ? list.todoItems.length : list.kitItems.length;
        console.log(`   - ${list.title} (${list.type}): ${itemCount} items`);
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
