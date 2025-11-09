/**
 * One-time script to populate empty displayNames with generated names
 */

import { prisma } from "../lib/prisma";

// Fun adjectives and nouns for generating names
const adjectives = [
  "Happy", "Sunny", "Brave", "Clever", "Swift", "Bright", "Wise", "Bold",
  "Cheerful", "Gentle", "Mighty", "Noble", "Quick", "Friendly", "Lively",
  "Daring", "Eager", "Jolly", "Kind", "Merry", "Proud", "Smart", "Witty"
];

const nouns = [
  "Explorer", "Traveler", "Wanderer", "Adventurer", "Voyager", "Nomad",
  "Journeyer", "Ranger", "Pioneer", "Navigator", "Pathfinder", "Trekker",
  "Globetrotter", "Backpacker", "Wayfarer", "Rambler", "Roamer", "Tourist",
  "Pilgrim", "Hiker", "Camper", "Sailor", "Climber"
];

function generateDisplayName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adjective} ${noun} ${number}`;
}

async function main() {
  console.log("🔍 Finding users with empty displayNames...");

  const usersWithoutNames = await prisma.user.findMany({
    where: {
      OR: [
        { displayName: null },
        { displayName: "" }
      ]
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    }
  });

  console.log(`Found ${usersWithoutNames.length} users without display names`);

  if (usersWithoutNames.length === 0) {
    console.log("✅ All users already have display names!");
    return;
  }

  console.log("\n📝 Updating users:");

  for (const user of usersWithoutNames) {
    const newDisplayName = generateDisplayName();

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: newDisplayName }
    });

    console.log(`  ${user.email} → "${newDisplayName}"`);
  }

  console.log(`\n✅ Successfully updated ${usersWithoutNames.length} users!`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
