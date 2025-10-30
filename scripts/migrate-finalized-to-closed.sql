-- First, add the CLOSED value to the enum
ALTER TYPE "SpendStatus" ADD VALUE IF NOT EXISTS 'CLOSED';

-- Update all FINALIZED spends to CLOSED
UPDATE spends
SET status = 'CLOSED'
WHERE status = 'FINALIZED';

-- Remove the FINALIZED value from the enum
-- Note: PostgreSQL doesn't support removing enum values directly
-- We need to create a new enum and migrate

-- Create a new enum without FINALIZED (drop if exists first)
DROP TYPE IF EXISTS "SpendStatus_new";
CREATE TYPE "SpendStatus_new" AS ENUM ('OPEN', 'CLOSED');

-- Drop the default temporarily
ALTER TABLE spends ALTER COLUMN status DROP DEFAULT;

-- Update the column to use the new enum
ALTER TABLE spends
  ALTER COLUMN status TYPE "SpendStatus_new"
  USING status::text::"SpendStatus_new";

-- Drop the old enum and rename the new one
DROP TYPE "SpendStatus";
ALTER TYPE "SpendStatus_new" RENAME TO "SpendStatus";

-- Restore the default
ALTER TABLE spends ALTER COLUMN status SET DEFAULT 'OPEN';
