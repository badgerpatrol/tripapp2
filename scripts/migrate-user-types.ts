/**
 * Migration script to set userType for existing users
 *
 * Rules:
 * - Users with .fake emails → SIGNUP
 * - Users with VIEWER role → SYSTEM
 * - All other users → FULL
 *
 * Run with: npx tsx scripts/migrate-user-types.ts
 */

import { prisma } from "../lib/prisma";
import { UserType, UserRole } from "../lib/generated/prisma";

async function migrateUserTypes() {
  console.log("Starting user type migration...\n");

  // Get all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      userType: true,
    },
  });

  console.log(`Found ${users.length} users to process\n`);

  let signupCount = 0;
  let systemCount = 0;
  let fullCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    let newType: UserType;

    // Determine the correct userType
    if (user.email.endsWith(".fake")) {
      newType = UserType.SIGNUP;
      signupCount++;
    } else if (user.role === UserRole.VIEWER) {
      newType = UserType.SYSTEM;
      systemCount++;
    } else {
      newType = UserType.FULL;
      fullCount++;
    }

    // Only update if the type is different (or if it's the default FULL and should be something else)
    if (user.userType !== newType) {
      await prisma.user.update({
        where: { id: user.id },
        data: { userType: newType },
      });
      console.log(`Updated ${user.email}: ${user.userType || 'NULL'} → ${newType}`);
    } else {
      skippedCount++;
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`SIGNUP users (*.fake emails): ${signupCount}`);
  console.log(`SYSTEM users (VIEWER role): ${systemCount}`);
  console.log(`FULL users (regular accounts): ${fullCount}`);
  console.log(`Skipped (already correct): ${skippedCount}`);
  console.log("\nMigration complete!");
}

migrateUserTypes()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
