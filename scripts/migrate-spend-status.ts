import { prisma } from "../lib/prisma";

async function migrateSpendStatus() {
  console.log("Updating all DRAFT spends to OPEN status...");

  try {
    // Update all spends with DRAFT status to OPEN
    const result = await prisma.$executeRaw`
      UPDATE spends
      SET status = 'OPEN'
      WHERE status = 'DRAFT'
    `;

    console.log(`Updated ${result} spends from DRAFT to OPEN`);
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSpendStatus();
