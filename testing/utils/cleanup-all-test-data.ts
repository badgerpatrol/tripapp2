import { PrismaClient } from '../../lib/generated/prisma/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

/**
 * Comprehensive Test Data Cleanup Script
 *
 * This script removes ALL test data from the database, including:
 * - Trips with test-related names ([E2E-TEST], E2E Test, API Test, Test Trip, etc.)
 * - List templates with test-related names
 * - Groups with test-related names
 * - Any orphaned data related to deleted test entities
 *
 * Usage:
 *   cd testing
 *   npx tsx utils/cleanup-all-test-data.ts
 */

// Test name patterns to match
const TEST_PATTERNS = [
  '[E2E-TEST]',
  'E2E Test',
  'E2E_',
  'E2E ',
  'API Test',
  'Test Trip',
  'Test List',
  'Test Kit',
  'Test Spend',
  'Test Choice',
  'Test Menu',
  'Test Group',
  'Test Milestone',
  'Test checklist',
];

// ID prefixes for test data
const TEST_ID_PREFIXES = [
  'test_',
  'e2e_',
];

async function cleanupAllTestData() {
  console.log('🧹 Comprehensive Test Data Cleanup\n');
  console.log('=' .repeat(50));

  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ No database URL found. Set TEST_DATABASE_URL or DATABASE_URL.');
    process.exit(1);
  }

  console.log(`📍 Database: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}\n`);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  try {
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Build WHERE conditions for name matching
    const nameConditions = TEST_PATTERNS.map(pattern => ({
      name: { contains: pattern }
    }));

    const titleConditions = TEST_PATTERNS.map(pattern => ({
      title: { contains: pattern }
    }));

    // ========================================
    // 1. DELETE TEST TRIPS (and cascade)
    // ========================================
    console.log('🗑️  Cleaning test trips...');

    // First, find all test trips
    const testTrips = await prisma.trip.findMany({
      where: {
        OR: [
          ...nameConditions,
          { id: { startsWith: 'test_' } },
        ],
      },
      select: { id: true, name: true },
    });

    console.log(`   Found ${testTrips.length} test trips`);

    if (testTrips.length > 0) {
      const tripIds = testTrips.map(t => t.id);

      // Delete in order respecting foreign keys
      // Choices cascade
      const choiceActivities = await prisma.choiceActivity.deleteMany({
        where: { choice: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${choiceActivities.count} choice activities`);

      const choiceSelectionLines = await prisma.choiceSelectionLine.deleteMany({
        where: { selection: { choice: { tripId: { in: tripIds } } } },
      });
      console.log(`   - Deleted ${choiceSelectionLines.count} choice selection lines`);

      const choiceSelections = await prisma.choiceSelection.deleteMany({
        where: { choice: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${choiceSelections.count} choice selections`);

      const choiceItems = await prisma.choiceItem.deleteMany({
        where: { choice: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${choiceItems.count} choice items`);

      const choices = await prisma.choice.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${choices.count} choices`);

      // Spends cascade
      const spendAssignments = await prisma.spendAssignment.deleteMany({
        where: { spend: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${spendAssignments.count} spend assignments`);

      const spendItems = await prisma.spendItem.deleteMany({
        where: { spend: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${spendItems.count} spend items`);

      const spends = await prisma.spend.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${spends.count} spends`);

      // Settlements cascade
      const payments = await prisma.payment.deleteMany({
        where: { settlement: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${payments.count} payments`);

      const settlements = await prisma.settlement.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${settlements.count} settlements`);

      // Checklists cascade
      const checklistItems = await prisma.checklistItem.deleteMany({
        where: { checklist: { tripId: { in: tripIds } } },
      });
      console.log(`   - Deleted ${checklistItems.count} checklist items`);

      const checklists = await prisma.checklist.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${checklists.count} checklists`);

      // Other trip-related
      const timelineItems = await prisma.timelineItem.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${timelineItems.count} timeline items`);

      const invitations = await prisma.invitation.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${invitations.count} invitations`);

      const transportOffers = await prisma.transportOffer.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${transportOffers.count} transport offers`);

      const transportReqs = await prisma.transportRequirement.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${transportReqs.count} transport requirements`);

      const tripMembers = await prisma.tripMember.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${tripMembers.count} trip members`);

      const featureFlags = await prisma.featureFlag.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${featureFlags.count} feature flags`);

      const notifications = await prisma.notification.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${notifications.count} notifications`);

      const eventLogs = await prisma.eventLog.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${eventLogs.count} event logs`);

      // List templates associated with trips
      const kitItemTemplates = await prisma.kitItemTemplate.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${kitItemTemplates.count} kit item templates`);

      const todoItemTemplates = await prisma.todoItemTemplate.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${todoItemTemplates.count} todo item templates`);

      const listTemplates = await prisma.listTemplate.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      console.log(`   - Deleted ${listTemplates.count} list templates (trip)`);

      // Finally delete trips
      const trips = await prisma.trip.deleteMany({
        where: { id: { in: tripIds } },
      });
      console.log(`   ✅ Deleted ${trips.count} trips`);
    }

    // ========================================
    // 2. DELETE STANDALONE LIST TEMPLATES
    // ========================================
    console.log('\n🗑️  Cleaning standalone list templates...');

    const testListTemplates = await prisma.listTemplate.findMany({
      where: {
        OR: titleConditions,
      },
      select: { id: true, title: true },
    });

    console.log(`   Found ${testListTemplates.length} test list templates`);

    if (testListTemplates.length > 0) {
      const templateIds = testListTemplates.map(t => t.id);

      const kitItems = await prisma.kitItemTemplate.deleteMany({
        where: { templateId: { in: templateIds } },
      });
      console.log(`   - Deleted ${kitItems.count} kit item templates`);

      const todoItems = await prisma.todoItemTemplate.deleteMany({
        where: { templateId: { in: templateIds } },
      });
      console.log(`   - Deleted ${todoItems.count} todo item templates`);

      const templates = await prisma.listTemplate.deleteMany({
        where: { id: { in: templateIds } },
      });
      console.log(`   ✅ Deleted ${templates.count} list templates`);
    }

    // ========================================
    // 3. DELETE TEST GROUPS
    // ========================================
    console.log('\n🗑️  Cleaning test groups...');

    const testGroups = await prisma.group.findMany({
      where: {
        OR: [
          ...nameConditions,
          { id: { startsWith: 'test_' } },
        ],
      },
      select: { id: true, name: true },
    });

    console.log(`   Found ${testGroups.length} test groups`);

    if (testGroups.length > 0) {
      const groupIds = testGroups.map(g => g.id);

      const groupMembers = await prisma.groupMember.deleteMany({
        where: { groupId: { in: groupIds } },
      });
      console.log(`   - Deleted ${groupMembers.count} group members`);

      const groups = await prisma.group.deleteMany({
        where: { id: { in: groupIds } },
      });
      console.log(`   ✅ Deleted ${groups.count} groups`);
    }

    // ========================================
    // 4. DELETE TEST USERS (optional - careful!)
    // ========================================
    console.log('\n🗑️  Cleaning test users (with test_ prefix only)...');

    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: { startsWith: 'test_' } },
          { email: { contains: '@tripplanner.test' } },
        ],
      },
      select: { id: true, email: true },
    });

    console.log(`   Found ${testUsers.length} test users`);

    if (testUsers.length > 0) {
      const userIds = testUsers.map(u => u.id);

      // Clean up user-related data first
      const passkeys = await prisma.passkey.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   - Deleted ${passkeys.count} passkeys`);

      const itemTicks = await prisma.itemTick.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   - Deleted ${itemTicks.count} item ticks`);

      // Don't delete test users themselves - they may be needed for future tests
      console.log(`   ⚠️  Skipping user deletion (needed for test authentication)`);
    }

    // ========================================
    // 5. CLEAN UP ORPHANED DATA
    // ========================================
    console.log('\n🗑️  Cleaning orphaned test data...');

    // Categories with test prefix
    const categories = await prisma.category.deleteMany({
      where: { id: { startsWith: 'test_' } },
    });
    console.log(`   - Deleted ${categories.count} test categories`);

    // System logs from test activities
    const systemLogs = await prisma.systemLog.deleteMany({
      where: {
        OR: [
          { eventText: { contains: '[E2E-TEST]' } },
          { eventText: { contains: 'E2E Test' } },
          { eventText: { contains: 'API Test' } },
        ],
      },
    });
    console.log(`   - Deleted ${systemLogs.count} system logs`);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '=' .repeat(50));
    console.log('✅ Cleanup complete!\n');

    // Show remaining counts
    const remainingTrips = await prisma.trip.count();
    const remainingLists = await prisma.listTemplate.count();
    const remainingGroups = await prisma.group.count();
    const remainingUsers = await prisma.user.count();

    console.log('📊 Remaining data:');
    console.log(`   - Trips: ${remainingTrips}`);
    console.log(`   - List templates: ${remainingLists}`);
    console.log(`   - Groups: ${remainingGroups}`);
    console.log(`   - Users: ${remainingUsers}`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

cleanupAllTestData();
