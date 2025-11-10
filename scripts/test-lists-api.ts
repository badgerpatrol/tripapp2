#!/usr/bin/env tsx
/**
 * Lists API Integration Test
 * Tests the core Lists API endpoints
 */

import { PrismaClient, ListType } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Lists API...\n');

  try {
    // Test 1: Browse public templates
    console.log('1️⃣ Testing public templates browse...');
    const publicTemplates = await prisma.listTemplate.findMany({
      where: { visibility: 'PUBLIC' },
      include: {
        todoItems: true,
        kitItems: true,
      },
    });
    console.log(`   ✓ Found ${publicTemplates.length} public templates`);
    publicTemplates.forEach((t) => {
      const itemCount = t.type === 'TODO' ? t.todoItems.length : t.kitItems.length;
      console.log(`     - ${t.title} (${t.type}): ${itemCount} items`);
    });

    // Test 2: Verify Pre-Trip Essentials TODO template
    console.log('\n2️⃣ Verifying Pre-Trip Essentials template...');
    const preTripTodo = await prisma.listTemplate.findFirst({
      where: {
        title: 'Pre-Trip Essentials',
        type: 'TODO',
      },
      include: {
        todoItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!preTripTodo) {
      throw new Error('Pre-Trip Essentials template not found');
    }

    console.log(`   ✓ Found template: ${preTripTodo.title}`);
    console.log(`   ✓ Items: ${preTripTodo.todoItems.length}`);
    console.log(`   ✓ Tags: ${preTripTodo.tags.join(', ')}`);

    const actionsCount = preTripTodo.todoItems.filter((i) => i.actionType).length;
    console.log(`   ✓ Items with actions: ${actionsCount}`);

    // Test 3: Verify Basic Ski Kit template
    console.log('\n3️⃣ Verifying Basic Ski Kit template...');
    const skiKit = await prisma.listTemplate.findFirst({
      where: {
        title: 'Basic Ski Kit',
        type: 'KIT',
      },
      include: {
        kitItems: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!skiKit) {
      throw new Error('Basic Ski Kit template not found');
    }

    console.log(`   ✓ Found template: ${skiKit.title}`);
    console.log(`   ✓ Items: ${skiKit.kitItems.length}`);
    console.log(`   ✓ Tags: ${skiKit.tags.join(', ')}`);

    const categories = [...new Set(skiKit.kitItems.map((i) => i.category).filter(Boolean))];
    console.log(`   ✓ Categories: ${categories.join(', ')}`);

    const totalWeight = skiKit.kitItems.reduce((sum, i) => sum + (i.weightGrams || 0), 0);
    console.log(`   ✓ Total weight: ${(totalWeight / 1000).toFixed(1)}kg`);

    // Test 4: Verify schema integrity
    console.log('\n4️⃣ Verifying schema integrity...');

    // Check that all TODO items have valid action types
    const invalidTodoActions = preTripTodo.todoItems.filter(
      (item) => item.actionType && !['CREATE_CHOICE', 'SET_MILESTONE', 'INVITE_USERS'].includes(item.actionType)
    );
    if (invalidTodoActions.length > 0) {
      throw new Error(`Invalid action types found: ${invalidTodoActions.map(i => i.actionType).join(', ')}`);
    }
    console.log('   ✓ All TODO action types are valid');

    // Check that all KIT items have valid quantities
    const invalidQuantities = skiKit.kitItems.filter((item) => item.quantity <= 0);
    if (invalidQuantities.length > 0) {
      throw new Error(`Invalid quantities found in items: ${invalidQuantities.map(i => i.label).join(', ')}`);
    }
    console.log('   ✓ All KIT quantities are positive');

    // Check indexes
    const todoIndexes = preTripTodo.todoItems.map((i) => i.orderIndex);
    const hasDuplicateTodoIndexes = todoIndexes.length !== new Set(todoIndexes).size;
    if (hasDuplicateTodoIndexes) {
      console.warn('   ⚠️  Warning: Duplicate orderIndex values in TODO items');
    } else {
      console.log('   ✓ TODO items have unique order indexes');
    }

    const kitIndexes = skiKit.kitItems.map((i) => i.orderIndex);
    const hasDuplicateKitIndexes = kitIndexes.length !== new Set(kitIndexes).size;
    if (hasDuplicateKitIndexes) {
      console.warn('   ⚠️  Warning: Duplicate orderIndex values in KIT items');
    } else {
      console.log('   ✓ KIT items have unique order indexes');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Test script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
