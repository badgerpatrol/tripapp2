/**
 * Backfill tripId on TodoItemTemplate and KitItemTemplate records
 *
 * This script populates the denormalized tripId field on item templates
 * by looking up the tripId from their parent ListTemplate.
 *
 * Run with: npx tsx scripts/backfill-item-tripids.ts
 */

import { prisma } from "../lib/prisma";

async function backfillTripIds() {
  console.log("Starting tripId backfill...\n");

  // Backfill TodoItemTemplate (only where trip exists)
  console.log("Backfilling TodoItemTemplate...");
  const todoResult = await prisma.$executeRaw`
    UPDATE todo_item_templates tit
    SET "tripId" = lt."tripId"
    FROM list_templates lt
    JOIN trips t ON lt."tripId" = t.id
    WHERE tit."templateId" = lt.id
      AND lt."tripId" IS NOT NULL
      AND tit."tripId" IS NULL
  `;
  console.log(`  Updated ${todoResult} TODO items\n`);

  // Backfill KitItemTemplate (only where trip exists)
  console.log("Backfilling KitItemTemplate...");
  const kitResult = await prisma.$executeRaw`
    UPDATE kit_item_templates kit
    SET "tripId" = lt."tripId"
    FROM list_templates lt
    JOIN trips t ON lt."tripId" = t.id
    WHERE kit."templateId" = lt.id
      AND lt."tripId" IS NOT NULL
      AND kit."tripId" IS NULL
  `;
  console.log(`  Updated ${kitResult} KIT items\n`);

  // Verify results - only count items where the trip actually exists
  const todoMissing = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM todo_item_templates tit
    JOIN list_templates lt ON tit."templateId" = lt.id
    JOIN trips t ON lt."tripId" = t.id
    WHERE tit."tripId" IS NULL
      AND lt."tripId" IS NOT NULL
  `;

  const kitMissing = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM kit_item_templates kit
    JOIN list_templates lt ON kit."templateId" = lt.id
    JOIN trips t ON lt."tripId" = t.id
    WHERE kit."tripId" IS NULL
      AND lt."tripId" IS NOT NULL
  `;

  const todoCount = Number(todoMissing[0].count);
  const kitCount = Number(kitMissing[0].count);

  if (todoCount > 0 || kitCount > 0) {
    console.log(`WARNING: Some items on active trips still missing tripId:`);
    console.log(`  TODO items: ${todoCount}`);
    console.log(`  KIT items: ${kitCount}`);
  } else {
    console.log("All trip items now have tripId set.");
  }

  console.log("\nBackfill complete!");
}

backfillTripIds()
  .catch((e) => {
    console.error("Error during backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
