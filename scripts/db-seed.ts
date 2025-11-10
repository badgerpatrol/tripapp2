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

  // Seed public list templates
  console.log('\n📋 Creating public list templates...');

  // 1. PUBLIC Todo: "Pre-Trip Essentials" with actions
  const preTripTodo = await prisma.listTemplate.findFirst({
    where: {
      title: "Pre-Trip Essentials",
      type: "TODO",
      visibility: "PUBLIC",
    },
  });

  if (!preTripTodo) {
    const todoTemplate = await prisma.listTemplate.create({
      data: {
        ownerId: "system", // System-created
        title: "Pre-Trip Essentials",
        description: "Essential tasks to complete before your trip begins",
        type: "TODO",
        visibility: "PUBLIC",
        publishedAt: new Date(),
        tags: ["planning", "essentials", "pre-trip"],
      },
    });

    await prisma.todoItemTemplate.createMany({
      data: [
        {
          templateId: todoTemplate.id,
          label: "Create trip choices/polls for activities",
          notes: "Use the Choices feature to let everyone vote on activities",
          actionType: "CREATE_CHOICE",
          actionData: {},
          orderIndex: 0,
        },
        {
          templateId: todoTemplate.id,
          label: "Set RSVP deadline milestone",
          notes: "Ensure everyone confirms attendance by a specific date",
          actionType: "SET_MILESTONE",
          actionData: { label: "RSVP Deadline", dueDate: "" },
          orderIndex: 1,
        },
        {
          templateId: todoTemplate.id,
          label: "Invite all participants",
          notes: "Send invitations to everyone joining the trip",
          actionType: "INVITE_USERS",
          actionData: { usernames: [] },
          orderIndex: 2,
        },
        {
          templateId: todoTemplate.id,
          label: "Book accommodations",
          notes: "Reserve hotels, Airbnb, or other lodging",
          orderIndex: 3,
        },
        {
          templateId: todoTemplate.id,
          label: "Arrange transportation",
          notes: "Book flights, trains, or rental cars",
          orderIndex: 4,
        },
        {
          templateId: todoTemplate.id,
          label: "Check passport/visa requirements",
          notes: "Ensure all travel documents are valid",
          orderIndex: 5,
        },
        {
          templateId: todoTemplate.id,
          label: "Purchase travel insurance",
          notes: "Protect your trip investment",
          orderIndex: 6,
        },
      ],
    });

    console.log(`  ✓ 📝 Pre-Trip Essentials TODO template`);
  } else {
    console.log(`  ⊘ 📝 Pre-Trip Essentials TODO template (already exists)`);
  }

  // 2. PUBLIC Kit: "Basic Ski Kit" with categories
  const skiKit = await prisma.listTemplate.findFirst({
    where: {
      title: "Basic Ski Kit",
      type: "KIT",
      visibility: "PUBLIC",
    },
  });

  if (!skiKit) {
    const kitTemplate = await prisma.listTemplate.create({
      data: {
        ownerId: "system",
        title: "Basic Ski Kit",
        description: "Essential gear for a ski trip",
        type: "KIT",
        visibility: "PUBLIC",
        publishedAt: new Date(),
        tags: ["ski", "winter", "sports", "packing"],
      },
    });

    await prisma.kitItemTemplate.createMany({
      data: [
        // Boots & Base
        {
          templateId: kitTemplate.id,
          label: "Ski boots",
          notes: "Make sure they're properly fitted",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 2000,
          category: "Footwear",
          orderIndex: 0,
        },
        {
          templateId: kitTemplate.id,
          label: "Ski socks (merino wool)",
          quantity: 3,
          perPerson: true,
          required: true,
          weightGrams: 150,
          category: "Footwear",
          orderIndex: 1,
        },
        // Layers
        {
          templateId: kitTemplate.id,
          label: "Base layer top (thermal)",
          quantity: 2,
          perPerson: true,
          required: true,
          weightGrams: 300,
          category: "Layers",
          orderIndex: 2,
        },
        {
          templateId: kitTemplate.id,
          label: "Base layer bottom (thermal)",
          quantity: 2,
          perPerson: true,
          required: true,
          weightGrams: 300,
          category: "Layers",
          orderIndex: 3,
        },
        {
          templateId: kitTemplate.id,
          label: "Mid-layer fleece",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 500,
          category: "Layers",
          orderIndex: 4,
        },
        {
          templateId: kitTemplate.id,
          label: "Ski jacket",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 1000,
          category: "Layers",
          orderIndex: 5,
        },
        {
          templateId: kitTemplate.id,
          label: "Ski pants",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 800,
          category: "Layers",
          orderIndex: 6,
        },
        // Accessories
        {
          templateId: kitTemplate.id,
          label: "Ski goggles",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 200,
          category: "Accessories",
          orderIndex: 7,
        },
        {
          templateId: kitTemplate.id,
          label: "Ski gloves",
          quantity: 2,
          perPerson: true,
          required: true,
          weightGrams: 300,
          category: "Accessories",
          orderIndex: 8,
        },
        {
          templateId: kitTemplate.id,
          label: "Helmet",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 500,
          category: "Accessories",
          orderIndex: 9,
        },
        {
          templateId: kitTemplate.id,
          label: "Neck warmer/balaclava",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 100,
          category: "Accessories",
          orderIndex: 10,
        },
        {
          templateId: kitTemplate.id,
          label: "Sunscreen (SPF 50+)",
          quantity: 1,
          perPerson: false,
          required: true,
          weightGrams: 100,
          category: "Safety",
          orderIndex: 11,
        },
        {
          templateId: kitTemplate.id,
          label: "Lip balm with SPF",
          quantity: 1,
          perPerson: true,
          required: true,
          weightGrams: 20,
          category: "Safety",
          orderIndex: 12,
        },
        // Avalanche Safety (optional)
        {
          templateId: kitTemplate.id,
          label: "Avalanche beacon",
          notes: "For backcountry skiing only",
          quantity: 1,
          perPerson: true,
          required: false,
          weightGrams: 250,
          category: "Avalanche Safety",
          orderIndex: 13,
        },
        {
          templateId: kitTemplate.id,
          label: "Probe",
          notes: "For backcountry skiing only",
          quantity: 1,
          perPerson: true,
          required: false,
          weightGrams: 300,
          category: "Avalanche Safety",
          orderIndex: 14,
        },
        {
          templateId: kitTemplate.id,
          label: "Shovel",
          notes: "For backcountry skiing only",
          quantity: 1,
          perPerson: true,
          required: false,
          weightGrams: 700,
          category: "Avalanche Safety",
          orderIndex: 15,
        },
      ],
    });

    console.log(`  ✓ 🎿 Basic Ski Kit template`);
  } else {
    console.log(`  ⊘ 🎿 Basic Ski Kit template (already exists)`);
  }

  console.log('\n✅ Seed complete!');
  console.log('\nCreated:');
  console.log(`  - ${categories.length} default categories`);
  console.log(`  - 2 public list templates (TODO + KIT)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
