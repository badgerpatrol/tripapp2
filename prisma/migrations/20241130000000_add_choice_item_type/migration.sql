-- CreateEnum
CREATE TYPE "ChoiceItemType" AS ENUM ('NORMAL', 'OTHER', 'NO_PARTICIPATION');

-- AlterTable: Add type column to choice_items
ALTER TABLE "choice_items" ADD COLUMN "type" "ChoiceItemType" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "choice_items_type_idx" ON "choice_items"("type");
