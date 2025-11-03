#!/usr/bin/env tsx
/**
 * Database Seed Script
 *
 * Populates the database with initial/default data.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   pnpm db:seed
 */

import { PrismaClient } from '../lib/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Seed default categories
  console.log('📂 Creating default categories...');

  const categories = [
    { name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B', description: 'Meals, restaurants, groceries' },
    { name: 'Transportation', icon: '🚗', color: '#4ECDC4', description: 'Flights, trains, taxis, car rentals' },
    { name: 'Accommodation', icon: '🏨', color: '#45B7D1', description: 'Hotels, Airbnb, lodging' },
    { name: 'Activities', icon: '🎉', color: '#FFA07A', description: 'Tours, tickets, entertainment' },
    { name: 'Shopping', icon: '🛍️', color: '#DDA15E', description: 'Souvenirs, clothing, misc purchases' },
    { name: 'Health & Medical', icon: '💊', color: '#BC6C25', description: 'Pharmacy, medical expenses' },
    { name: 'Utilities', icon: '💡', color: '#606C38', description: 'Phone, internet, utilities' },
    { name: 'Other', icon: '📌', color: '#6C757D', description: 'Miscellaneous expenses' },
  ];

  for (const category of categories) {
    // Check if category already exists
    const existing = await prisma.category.findFirst({
      where: {
        name: category.name,
        isDefault: true,
      },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          ...category,
          isDefault: true,
          createdById: null, // System-created
        },
      });
      console.log(`  ✓ ${category.icon} ${category.name}`);
    } else {
      console.log(`  ⊘ ${category.icon} ${category.name} (already exists)`);
    }
  }

  console.log('\n✅ Seed complete!');
  console.log('\nCreated:');
  console.log(`  - ${categories.length} default categories`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
