-- AlterEnum: Add new event types for spend items and assignments
ALTER TYPE "EventType" ADD VALUE 'SPEND_ITEM_CREATED';
ALTER TYPE "EventType" ADD VALUE 'SPEND_ITEM_UPDATED';
ALTER TYPE "EventType" ADD VALUE 'SPEND_ITEM_DELETED';
ALTER TYPE "EventType" ADD VALUE 'ASSIGNMENT_CREATED';
ALTER TYPE "EventType" ADD VALUE 'ASSIGNMENT_UPDATED';
ALTER TYPE "EventType" ADD VALUE 'ASSIGNMENT_DELETED';
ALTER TYPE "EventType" ADD VALUE 'ASSIGNMENT_MOVED';

-- CreateTable: Create spend_items table
CREATE TABLE "spend_items" (
    "id" TEXT NOT NULL,
    "spendId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(19,4) NOT NULL,
    "assignedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spend_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Add indexes to spend_items
CREATE INDEX "spend_items_spendId_idx" ON "spend_items"("spendId");
CREATE INDEX "spend_items_assignedUserId_idx" ON "spend_items"("assignedUserId");
CREATE INDEX "spend_items_createdById_idx" ON "spend_items"("createdById");

-- AddForeignKey: Add foreign keys to spend_items
ALTER TABLE "spend_items" ADD CONSTRAINT "spend_items_spendId_fkey" FOREIGN KEY ("spendId") REFERENCES "spends"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spend_items" ADD CONSTRAINT "spend_items_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "spend_items" ADD CONSTRAINT "spend_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add itemId column to spend_assignments
ALTER TABLE "spend_assignments" ADD COLUMN "itemId" TEXT;

-- CreateIndex: Add index for itemId in spend_assignments
CREATE INDEX "spend_assignments_itemId_idx" ON "spend_assignments"("itemId");

-- AddForeignKey: Add foreign key for itemId in spend_assignments
ALTER TABLE "spend_assignments" ADD CONSTRAINT "spend_assignments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "spend_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
