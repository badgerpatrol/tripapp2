import { DatabaseHelper } from '../helpers/database.helper';
import {
  DEFAULT_TEST_USER,
  ADMIN_TEST_USER,
  SUPERADMIN_TEST_USER,
  SECONDARY_TEST_USER,
  DEFAULT_TEST_TRIP,
  TEST_CATEGORIES,
} from '../config/test-constants';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

/**
 * Script to seed the test database with sample data
 */
async function seedTestData() {
  console.log('🌱 Seeding test database...\n');

  try {
    const db = await DatabaseHelper.getInstance();

    // Create test users
    console.log('Creating test users...');
    await db.createTestUser(DEFAULT_TEST_USER);
    await db.createTestUser(ADMIN_TEST_USER);
    await db.createTestUser(SUPERADMIN_TEST_USER);
    await db.createTestUser(SECONDARY_TEST_USER);
    console.log('  ✓ Users created');

    // Create test categories
    console.log('Creating test categories...');
    for (const category of TEST_CATEGORIES) {
      await db.client.category.upsert({
        where: { id: category.id },
        update: {},
        create: {
          ...category,
          createdById: DEFAULT_TEST_USER.id,
        },
      });
    }
    console.log('  ✓ Categories created');

    // Create default test trip
    console.log('Creating default test trip...');
    const trip = await db.createTestTrip({
      id: DEFAULT_TEST_TRIP.id,
      name: DEFAULT_TEST_TRIP.name,
      description: DEFAULT_TEST_TRIP.description,
      location: DEFAULT_TEST_TRIP.location,
      baseCurrency: DEFAULT_TEST_TRIP.baseCurrency,
      createdById: DEFAULT_TEST_USER.id,
    });

    // Add members to trip
    await db.addTripMember(trip.id, SECONDARY_TEST_USER.id, 'MEMBER');
    console.log('  ✓ Trip created with members');

    // Create sample spends
    console.log('Creating sample spends...');
    const spend1 = await db.createTestSpend({
      tripId: trip.id,
      description: 'Groceries',
      amount: 85.50,
      paidById: DEFAULT_TEST_USER.id,
      categoryId: 'test_cat_food',
    });

    const spend2 = await db.createTestSpend({
      tripId: trip.id,
      description: 'Taxi to airport',
      amount: 45.00,
      paidById: SECONDARY_TEST_USER.id,
      categoryId: 'test_cat_transport',
    });

    // Create assignments
    await db.createSpendAssignment({
      spendId: spend1.id,
      userId: DEFAULT_TEST_USER.id,
      shareAmount: 42.75,
    });

    await db.createSpendAssignment({
      spendId: spend1.id,
      userId: SECONDARY_TEST_USER.id,
      shareAmount: 42.75,
    });

    await db.createSpendAssignment({
      spendId: spend2.id,
      userId: DEFAULT_TEST_USER.id,
      shareAmount: 22.50,
    });

    await db.createSpendAssignment({
      spendId: spend2.id,
      userId: SECONDARY_TEST_USER.id,
      shareAmount: 22.50,
    });
    console.log('  ✓ Spends and assignments created');

    // Create sample choice
    console.log('Creating sample choice/menu...');
    const choice = await db.createTestChoice({
      tripId: trip.id,
      name: 'Dinner Menu',
      description: 'Choose your dinner for the first night',
      createdById: DEFAULT_TEST_USER.id,
    });

    await db.addChoiceItem({
      choiceId: choice.id,
      name: 'Grilled Salmon',
      description: 'With seasonal vegetables',
      price: 24.50,
      course: 'Mains',
    });

    await db.addChoiceItem({
      choiceId: choice.id,
      name: 'Beef Steak',
      description: 'With fries and salad',
      price: 28.00,
      course: 'Mains',
    });

    await db.addChoiceItem({
      choiceId: choice.id,
      name: 'Vegetable Pasta',
      description: 'Vegan option available',
      price: 18.00,
      course: 'Mains',
    });
    console.log('  ✓ Choice and items created');

    // Create sample list template
    console.log('Creating sample list template...');
    await db.createTestListTemplate({
      ownerId: DEFAULT_TEST_USER.id,
      title: 'Packing Checklist',
      description: 'Essential items for the trip',
      type: 'TODO',
      tripId: trip.id,
    });
    console.log('  ✓ List template created');

    // Create sample group
    console.log('Creating sample group...');
    await db.createTestGroup({
      name: 'Travel Buddies',
      description: 'Friends we travel with',
      ownerId: DEFAULT_TEST_USER.id,
    });
    console.log('  ✓ Group created');

    console.log('\n✅ Test database seeded successfully!');
    console.log('\nTest accounts:');
    console.log(`  Default User: ${DEFAULT_TEST_USER.email}`);
    console.log(`  Admin User: ${ADMIN_TEST_USER.email}`);
    console.log(`  Superadmin: ${SUPERADMIN_TEST_USER.email}`);
    console.log(`  Secondary User: ${SECONDARY_TEST_USER.email}`);
    console.log(`\nTest Trip: ${DEFAULT_TEST_TRIP.name} (${DEFAULT_TEST_TRIP.id})`);

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed test database:', error);
    process.exit(1);
  }
}

seedTestData();
