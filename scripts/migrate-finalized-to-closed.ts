import { prisma } from "../lib/prisma";

async function migrateSpendStatus() {
  console.log("Updating all FINALIZED spends to CLOSED status...");

  try {
    // Update all spends with FINALIZED status to CLOSED
    const result = await prisma.$executeRaw`
      UPDATE spends
      SET status = 'CLOSED'
      WHERE status = 'FINALIZED'
    `;

    console.log(`Updated ${result} spends from FINALIZED to CLOSED`);
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSpendStatus();
